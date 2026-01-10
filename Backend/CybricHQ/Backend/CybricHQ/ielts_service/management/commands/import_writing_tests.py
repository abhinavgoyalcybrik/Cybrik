"""
Management command to import writing tests from JSON file.

Usage:
    python manage.py import_writing_tests path/to/writing_tests.json
"""

import json
from django.core.management.base import BaseCommand
from ielts_service.models import IELTSTest, TestModule, QuestionGroup, Question


class Command(BaseCommand):
    help = 'Import IELTS Writing tests from JSON file'

    def add_arguments(self, parser):
        parser.add_argument(
            'json_file',
            type=str,
            help='Path to the writing tests JSON file'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing writing tests before importing'
        )

    def handle(self, *args, **options):
        json_file = options['json_file']
        
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except FileNotFoundError:
            self.stderr.write(self.style.ERROR(f'File not found: {json_file}'))
            return
        except json.JSONDecodeError as e:
            self.stderr.write(self.style.ERROR(f'Invalid JSON: {e}'))
            return
        
        tests = data.get('tests', [])
        metadata = data.get('metadata', {})
        
        self.stdout.write(f"Found {len(tests)} writing tests to import")
        self.stdout.write(f"Format: {metadata.get('format', 'Unknown')}")
        
        if options['clear']:
            # Clear existing writing tests
            writing_modules = TestModule.objects.filter(module_type='writing')
            count = writing_modules.count()
            writing_modules.delete()
            self.stdout.write(self.style.WARNING(f'Cleared {count} existing writing modules'))
        
        imported = 0
        
        for test_data in tests:
            try:
                self._import_test(test_data)
                imported += 1
                if imported % 10 == 0:
                    self.stdout.write(f"Imported {imported} tests...")
            except Exception as e:
                self.stderr.write(
                    self.style.ERROR(f"Error importing test {test_data.get('test_id')}: {e}")
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully imported {imported} writing tests!')
        )

    def _import_test(self, test_data):
        """Import a single writing test."""
        test_id = test_data.get('test_id', 0)
        difficulty = test_data.get('difficulty', 'medium')
        
        # Create or get the parent IELTSTest
        test_name = f"Writing Practice Test {test_id}"
        ielts_test, created = IELTSTest.objects.get_or_create(
            title=test_name,
            defaults={
                'test_type': 'academic',
                'description': f"Writing test #{test_id} - {difficulty} difficulty",
                'active': True,
            }
        )
        
        if created:
            self.stdout.write(f"Created test: {test_name}")
        
        # Create Writing Module
        module, _ = TestModule.objects.get_or_create(
            test=ielts_test,
            module_type='writing',
            defaults={
                'duration_minutes': 60,  # Standard IELTS Writing duration
                'order': 3,  # Writing is usually the 3rd module
            }
        )
        
        # Clear existing question groups for this module
        module.question_groups.all().delete()
        
        # Import Task 1
        task_1 = test_data.get('task_1', {})
        if task_1:
            self._create_task_1(module, task_1)
        
        # Import Task 2
        task_2 = test_data.get('task_2', {})
        if task_2:
            self._create_task_2(module, task_2)

    def _create_task_1(self, module, task_1_data):
        """Create Task 1 question group."""
        task_type = task_1_data.get('type', 'chart')
        question = task_1_data.get('question', '')
        word_limit = task_1_data.get('word_limit', 150)
        
        # Map task types to group types
        type_mapping = {
            'chart': 'standard',
            'process': 'standard',
            'map': 'standard',
            'table': 'standard',
        }
        group_type = type_mapping.get(task_type, 'standard')
        
        # Create question group
        group = QuestionGroup.objects.create(
            module=module,
            title=f"Task 1: {task_type.capitalize()} Description",
            instructions=(
                f"You should spend about 20 minutes on this task.\n\n"
                f"Write at least {word_limit} words."
            ),
            group_type=group_type,
            order=1,
        )
        
        # Create the question
        Question.objects.create(
            group=group,
            question_text=question,
            question_type='essay',
            options=json.dumps({
                'task_type': task_type,
                'word_limit': word_limit,
                'time_limit': 20,
            }),
            order=1,
        )

    def _create_task_2(self, module, task_2_data):
        """Create Task 2 question group (Essay)."""
        question = task_2_data.get('question', '')
        word_limit = task_2_data.get('word_limit', 250)
        
        # Create question group
        group = QuestionGroup.objects.create(
            module=module,
            title="Task 2: Essay",
            instructions=(
                f"You should spend about 40 minutes on this task.\n\n"
                f"Write at least {word_limit} words.\n\n"
                f"Give reasons for your answer and include any relevant examples "
                f"from your own knowledge or experience."
            ),
            group_type='standard',
            order=2,
        )
        
        # Create the question
        Question.objects.create(
            group=group,
            question_text=question,
            question_type='essay',
            options=json.dumps({
                'word_limit': word_limit,
                'time_limit': 40,
            }),
            order=1,
        )
