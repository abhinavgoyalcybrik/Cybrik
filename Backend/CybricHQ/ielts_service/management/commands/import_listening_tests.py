"""
Django Management Command: Import IELTS Listening Tests from JSON files

Usage: python manage.py import_listening_tests --path "path/to/listening_tests.json"
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
            help='Path to the listening_tests.json file or directory'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be imported without actually saving'
        )

    def handle(self, *args, **options):
        # Find the listening.json file/directory
        base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
        
        target_path = None
        if options['path']:
            target_path = Path(options['path'])
        else:
            # Default: look for public/data/listening_tests.json
            potential_paths = [
                base_dir / 'ielts-portal' / 'public' / 'data' / 'listening_tests.json',
                base_dir / 'listening.json' / 'listening.json', # Original default
            ]
            for p in potential_paths:
                if p.exists():
                    target_path = p
                    break
        
        if not target_path or not target_path.exists():
            self.stdout.write(self.style.ERROR(f'File/Directory not found: {target_path or "defaults"}'))
            return
        
        self.stdout.write(f'Importing from: {target_path}')
        
        if options['dry_run']:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made'))
        
        imported = 0
        skipped = 0
        
        # Check if it's a file (aggregated JSON) or directory
        if target_path.is_file():
            try:
                with open(target_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                tests_to_import = []
                if isinstance(data, dict) and 'tests' in data:
                    tests_to_import = data['tests']
                elif isinstance(data, list):
                    tests_to_import = data
                else:
                    # Maybe single test object?
                    tests_to_import = [data]
                
                self.stdout.write(f'Found {len(tests_to_import)} tests in file')
                
                for test_data in tests_to_import:
                    result = self.import_test_data(test_data, dry_run=options['dry_run'])
                    if result:
                        imported += 1
                        self.stdout.write(self.style.SUCCESS(f"✓ Imported: {test_data.get('title', 'Unknown')}"))
                    else:
                        skipped += 1
                        self.stdout.write(self.style.WARNING(f"⊘ Skipped (exists): {test_data.get('title', 'Unknown')}"))
                        
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'✗ Error reading file {target_path}: {e}'))
                
        else:
            # It's a directory, iterate files
            json_files = sorted(target_path.glob('*.json'))
            self.stdout.write(f'Found {len(json_files)} test files in directory')
            
            for json_file in json_files:
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    # Handle if file contains 'tests' array or single object
                    tests_in_file = []
                    if isinstance(data, dict) and 'tests' in data:
                        tests_in_file = data['tests']
                    else:
                        tests_in_file = [data]
                        
                    for test_data in tests_in_file:
                        # Ensure we use filename stem as fallback for ID only if needed
                        if 'test_id' not in test_data:
                            test_data['_filename_id'] = json_file.stem 
                            
                        result = self.import_test_data(test_data, dry_run=options['dry_run'])
                        if result:
                            imported += 1
                            self.stdout.write(self.style.SUCCESS(f'✓ Imported from: {json_file.name}'))
                        else:
                            skipped += 1
                            self.stdout.write(self.style.WARNING(f'⊘ Skipped (exists) from: {json_file.name}'))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'✗ Error importing {json_file.name}: {e}'))
        
        self.stdout.write(self.style.SUCCESS(f'\nDone! Imported: {imported}, Skipped: {skipped}'))
    
    def import_test_data(self, data: dict, dry_run: bool = False) -> bool:
        """Import a single listening test from dictionary data."""
        
        test_id = data.get('test_id', data.get('_filename_id', 'Unknown'))
        title = data.get('title', f"IELTS Listening - {test_id}")
        
        # Check if test already exists
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
                # Handling integer keys in answer_key which might be strings in JSON
                correct_answers = answer_key.get(str(q_num)) or answer_key.get(q_num) or []
                
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
