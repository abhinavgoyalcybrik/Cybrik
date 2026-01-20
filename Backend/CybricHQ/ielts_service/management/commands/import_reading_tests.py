"""
Django Management Command: Import IELTS Reading Tests from JSON files

Usage: python manage.py import_reading_tests --path "path/to/reading_tests.json"
"""

from django.core.management.base import BaseCommand
from ielts_service.models import IELTSTest, TestModule, QuestionGroup, Question
from django.conf import settings
import json
import os
from pathlib import Path

class Command(BaseCommand):
    help = 'Imports IELTS Reading tests from JSON files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--path',
            type=str,
            default=None,
            help='Path to the reading_tests.json file'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be imported without actually saving'
        )

    def handle(self, *args, **options):
        base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
        
        target_path = None
        if options['path']:
            target_path = Path(options['path'])
        else:
            # Default: look for public/data/reading_tests.json
            potential_paths = [
                base_dir / 'ielts-portal' / 'public' / 'data' / 'reading_tests.json',
            ]
            for p in potential_paths:
                if p.exists():
                    target_path = p
                    break
        
        if not target_path or not target_path.exists():
            self.stdout.write(self.style.ERROR(f'File not found: {target_path or "defaults"}'))
            return

        self.stdout.write(f'Importing from: {target_path}')
        
        if options['dry_run']:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made'))

        with open(target_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        tests_to_import = []
        if isinstance(data, dict) and 'tests' in data:
            tests_to_import = data['tests']
        elif isinstance(data, list):
            tests_to_import = data
        else:
            tests_to_import = [data]

        self.stdout.write(f'Found {len(tests_to_import)} tests in file')

        imported = 0
        skipped = 0

        for test_data in tests_to_import:
            try:
                result = self.import_test_data(test_data, dry_run=options['dry_run'])
                if result:
                    imported += 1
                    self.stdout.write(self.style.SUCCESS(f"✓ Imported: {test_data.get('title', 'Unknown')}"))
                else:
                    skipped += 1
                    self.stdout.write(self.style.WARNING(f"⊘ Skipped (exists): {test_data.get('title', 'Unknown')}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'✗ Error importing test: {e}'))

        self.stdout.write(self.style.SUCCESS(f'\nDone! Imported: {imported}, Skipped: {skipped}'))

    def import_test_data(self, data: dict, dry_run: bool = False) -> bool:
        title = data.get('title', 'Untitled Reading Test')
        test_id = data.get('id', 0) # Fallback ID

        # Check if exists
        if IELTSTest.objects.filter(title=title).exists():
            return False

        if dry_run:
            self.stdout.write(f'  Would create: {title}')
            return True

        # Create or Get Test
        test, created = IELTSTest.objects.get_or_create(
            title=title,
            defaults={
                'description': data.get('description', 'Imported Reading Test'),
                'test_type': 'academic',
                'active': True
            }
        )
        
        # Clear existing reading module to avoid duplicates if updating logic used
        # (Though we check exists above, so this is just safe fallback if we remove that check)
        TestModule.objects.filter(test=test, module_type='reading').delete()

        # Create Reading Module
        module = TestModule.objects.create(
            test=test,
            module_type='reading',
            duration_minutes=60,
            order=2
        )

        global_order = 1
        
        # Process Passages (Assuming structure matches reading_tests.json which matches Cambridge 13 hopefully)
        # Check source structure: "passages" vs "sections"
        # If reading_tests.json uses "passages", good.
        # If it uses "sections" like listening, we adapt.
        
        content_sections = data.get('passages', [])
        if not content_sections:
            content_sections = data.get('sections', []) # Fallback

        for p_idx, content in enumerate(content_sections):
            section_title = content.get('title', f'Passage {p_idx + 1}')
            section_text = content.get('text', '')
            
            # Process Groups within Passage
            groups = content.get('groups', [])
            # Also handle if questions are directly in section like listening? Listening had section->questions
            # Reading usually has passage -> groups -> items.
            
            # If no groups but 'questions', maybe simpler structure?
            if not groups and 'questions' in content:
                 # Create a single group for this passage
                 groups = [{
                     'items': content['questions'],
                     'instructions': content.get('question_type', 'Answer the questions')
                 }]

            for g_idx, group in enumerate(groups):
                q_group = QuestionGroup.objects.create(
                    module=module,
                    title=f"{section_title} - Group {g_idx + 1}",
                    content=section_text, # Attach text to group or module? Usually group refers to text.
                    instructions=group.get('instructions', ''),
                    order=global_order
                )
                global_order += 1
                
                # Process Items (Questions)
                items = group.get('items', [])
                if not items and 'questions' in group:
                    items = group['questions']

                for item in items:
                    # Determine Question Type
                    json_type = group.get('type', 'TEXT') # Often type is on group level
                    if 'type' in item:
                        json_type = item['type']
                        
                    db_type = 'text_input' # default
                    options_list = []
                    
                    if json_type in ['TRUE_FALSE_NOT_GIVEN', 'YES_NO_NOT_GIVEN', 'mcq']:
                        db_type = 'multiple_choice'
                        if json_type == 'TRUE_FALSE_NOT_GIVEN':
                             options_list = ['TRUE', 'FALSE', 'NOT GIVEN']
                        elif json_type == 'YES_NO_NOT_GIVEN':
                             options_list = ['YES', 'NO', 'NOT GIVEN']
                        elif 'options' in item:
                             options_list = item['options'] # Simple list or objects?
                             if options_list and isinstance(options_list[0], dict):
                                 options_list = [opt.get('value', opt.get('key')) for opt in options_list]

                    elif json_type in ['MATCHING_HEADINGS', 'MULTIPLE_CHOICE']:
                        db_type = 'multiple_choice'
                        if 'options' in group:
                             group_options = group['options']
                             options_list = [opt.get('key') for opt in group_options]
                        elif 'options' in item:
                             item_options = item['options']
                             options_list = [opt.get('value') for opt in item_options]
                    
                    # Construct Prompt
                    prompt = item.get('prompt', item.get('question', ''))
                    if not prompt and 'number' in item:
                        prompt = f"Question {item['number']}"
                    if not prompt and 'q' in item:
                        prompt = f"Question {item['q']}"
                    
                    # Correct Answer
                    correct = ''
                    if 'answer' in item:
                        if isinstance(item['answer'], dict):
                            correct = item['answer'].get('value', '')
                        else:
                            correct = str(item['answer'])
                    elif 'correct_answer' in item:
                         correct = item['correct_answer']
                    
                    # If answer is in a separate answer key dict at root?
                    # reading_tests.json structure might need answer key lookup if not in items.
                    
                    Question.objects.create(
                        group=q_group,
                        question_text=prompt,
                        question_type=db_type,
                        options=options_list,
                        correct_answer=correct,
                        order=item.get('number', item.get('q', 0))
                    )
        
        return True
