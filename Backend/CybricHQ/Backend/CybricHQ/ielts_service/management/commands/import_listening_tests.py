"""
Django Management Command: Import IELTS Listening Tests from JSON files

Usage: python manage.py import_listening_tests
"""

from django.core.management.base import BaseCommand
from ielts_service.models import IELTSTest, TestModule, QuestionGroup, Question
import json
import os
from pathlib import Path


class Command(BaseCommand):
    help = 'Import IELTS Listening tests from JSON files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--path',
            type=str,
            default=None,
            help='Path to the listening.json directory'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be imported without actually saving'
        )

    def handle(self, *args, **options):
        # Find the listening.json directory
        base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
        
        if options['path']:
            json_dir = Path(options['path'])
        else:
            # Default: look for listening.json/listening.json/
            json_dir = base_dir / 'listening.json' / 'listening.json'
            
            if not json_dir.exists():
                # Alternative: check at project root
                json_dir = base_dir.parent / 'listening.json' / 'listening.json'
        
        if not json_dir.exists():
            self.stdout.write(self.style.ERROR(f'Directory not found: {json_dir}'))
            return
        
        self.stdout.write(f'Looking for tests in: {json_dir}')
        
        # Get all JSON files
        json_files = sorted(json_dir.glob('*.json'))
        self.stdout.write(f'Found {len(json_files)} test files')
        
        if options['dry_run']:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made'))
        
        imported = 0
        skipped = 0
        
        for json_file in json_files:
            try:
                result = self.import_test(json_file, dry_run=options['dry_run'])
                if result:
                    imported += 1
                    self.stdout.write(self.style.SUCCESS(f'✓ Imported: {json_file.name}'))
                else:
                    skipped += 1
                    self.stdout.write(self.style.WARNING(f'⊘ Skipped (exists): {json_file.name}'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'✗ Error importing {json_file.name}: {e}'))
        
        self.stdout.write(self.style.SUCCESS(f'\nDone! Imported: {imported}, Skipped: {skipped}'))
    
    def import_test(self, json_file: Path, dry_run: bool = False) -> bool:
        """Import a single listening test from JSON file."""
        
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        test_id = data.get('test_id', json_file.stem)
        
        # Check if test already exists
        title = f"IELTS Listening - {test_id}"
        if IELTSTest.objects.filter(title=title).exists():
            return False
        
        if dry_run:
            self.stdout.write(f'  Would create: {title} with {len(data.get("sections", []))} sections')
            return True
        
        # Create IELTSTest
        ielts_test = IELTSTest.objects.create(
            title=title,
            description=f"IELTS Listening Test {test_id} - Imported from JSON",
            test_type='academic',
            active=True
        )
        
        # Create TestModule (Listening)
        test_module = TestModule.objects.create(
            test=ielts_test,
            module_type='listening',
            duration_minutes=30,  # Standard IELTS listening is ~30 mins
            order=1
        )
        
        # Get answer key
        answer_key = data.get('answer_key', {})
        
        # Create QuestionGroups for each section
        for section_data in data.get('sections', []):
            section_num = section_data.get('section', 1)
            
            # Create QuestionGroup
            question_group = QuestionGroup.objects.create(
                module=test_module,
                title=f"Section {section_num}",
                instructions=section_data.get('question_type', ''),
                content='',  # Audio transcript can be added later
                order=section_num
            )
            
            # Create Questions
            for q_data in section_data.get('questions', []):
                q_num = q_data.get('q', 0)
                q_type = q_data.get('type', 'text')
                
                # Map type to model type
                if q_type == 'mcq':
                    question_type = 'multiple_choice'
                else:
                    question_type = 'text_input'
                
                # Get options for MCQ
                options = q_data.get('options', [])
                
                # Get correct answer from answer_key
                correct_answers = answer_key.get(str(q_num), [])
                if isinstance(correct_answers, list):
                    correct_answer = json.dumps(correct_answers)
                else:
                    correct_answer = str(correct_answers)
                
                Question.objects.create(
                    group=question_group,
                    question_text=q_data.get('question', f'Question {q_num}'),
                    question_type=question_type,
                    options=options,
                    correct_answer=correct_answer,
                    order=q_num
                )
        
        return True
