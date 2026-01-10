"""
Management command to import speaking tests from JSON file.

Usage:
    python manage.py import_speaking_tests path/to/speaking_tests.json
"""

import json
from django.core.management.base import BaseCommand
from ielts_service.models import IELTSTest, TestModule, QuestionGroup, Question


class Command(BaseCommand):
    help = 'Import IELTS Speaking tests from JSON file'

    def add_arguments(self, parser):
        parser.add_argument(
            'json_file',
            type=str,
            help='Path to the speaking tests JSON file'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing speaking tests before importing'
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
        
        self.stdout.write(f"Found {len(tests)} speaking tests to import")
        self.stdout.write(f"Format: {metadata.get('format', 'Unknown')}")
        
        if options['clear']:
            # Clear existing speaking tests
            speaking_modules = TestModule.objects.filter(module_type='speaking')
            count = speaking_modules.count()
            speaking_modules.delete()
            self.stdout.write(self.style.WARNING(f'Cleared {count} existing speaking modules'))
        
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
            self.style.SUCCESS(f'Successfully imported {imported} speaking tests!')
        )

    def _import_test(self, test_data):
        """Import a single speaking test."""
        test_id = test_data.get('test_id', 0)
        difficulty = test_data.get('difficulty', 'medium')
        
        # Create or get the parent IELTSTest
        test_name = f"Speaking Practice Test {test_id}"
        ielts_test, created = IELTSTest.objects.get_or_create(
            title=test_name,  # Use 'title' not 'name'
            defaults={
                'test_type': 'academic',
                'description': f"Speaking test #{test_id} - {difficulty} difficulty",
                'active': True,
            }
        )
        
        if created:
            self.stdout.write(f"Created test: {test_name}")
        
        # Create Speaking Module
        module, _ = TestModule.objects.get_or_create(
            test=ielts_test,
            module_type='speaking',
            defaults={
                'duration_minutes': 14,  # Standard IELTS Speaking duration
                'order': 4,  # Speaking is usually the 4th module
            }
        )
        
        # Clear existing question groups for this module
        module.question_groups.all().delete()
        
        # Import Part 1 (Introduction and Interview)
        part_1 = test_data.get('part_1', {})
        if part_1:
            self._create_part_1(module, part_1)
        
        # Import Part 2 (Long Turn / Cue Card)
        part_2 = test_data.get('part_2', {})
        if part_2:
            self._create_part_2(module, part_2)
        
        # Import Part 3 (Two-way Discussion)
        part_3 = test_data.get('part_3', {})
        if part_3:
            self._create_part_3(module, part_3)

    def _create_part_1(self, module, part_1_data):
        """Create Part 1 question group."""
        topic = part_1_data.get('topic', 'General Questions')
        questions = part_1_data.get('questions', [])
        
        # Create question group
        group = QuestionGroup.objects.create(
            module=module,
            title=f"Part 1: {topic}",
            instructions=(
                "In this part, the examiner asks you about yourself, your home, "
                "work or studies and other familiar topics. Answer each question "
                "in 2-3 sentences."
            ),
            group_type='standard',
            order=1,
        )
        
        # Create questions
        for idx, q_text in enumerate(questions):
            Question.objects.create(
                group=group,
                question_text=q_text,
                question_type='speech',
                order=idx + 1,
            )

    def _create_part_2(self, module, part_2_data):
        """Create Part 2 question group (Cue Card)."""
        title = part_2_data.get('title', 'Describe something')
        prompts = part_2_data.get('prompts', [])
        
        # Format the cue card text
        cue_card_text = title + "\n\nYou should say:\n"
        for prompt in prompts:
            cue_card_text += f"• {prompt}\n"
        
        # Create question group
        group = QuestionGroup.objects.create(
            module=module,
            title="Part 2: Cue Card",
            instructions=(
                "You will have 1 minute to prepare your answer. Then speak for "
                "1-2 minutes on the topic. The examiner will tell you when to stop."
            ),
            content=cue_card_text,  # Use 'content' not 'context_text'
            group_type='standard',  # Use standard since speaking types not in choices
            order=2,
        )
        
        # Create single question with cue card
        Question.objects.create(
            group=group,
            question_text=title,
            question_type='speech',  # Use 'speech' which is in QUESTION_TYPES
            options=json.dumps({'prompts': prompts}),
            order=1,
        )

    def _create_part_3(self, module, part_3_data):
        """Create Part 3 question groups (Discussion)."""
        discussion_topics = part_3_data.get('discussion_topics', [])
        
        for topic_idx, topic_data in enumerate(discussion_topics):
            topic = topic_data.get('topic', 'Discussion')
            questions = topic_data.get('questions', [])
            
            # Create question group for this discussion topic
            group = QuestionGroup.objects.create(
                module=module,
                title=f"Part 3: {topic}",
                instructions=(
                    "In this part, the examiner will ask you deeper questions related "
                    "to the topic in Part 2. Give detailed answers with examples and reasons."
                ),
                group_type='standard',
                order=3 + topic_idx,
            )
            
            # Create questions
            for idx, q_text in enumerate(questions):
                Question.objects.create(
                    group=group,
                    question_text=q_text,
                    question_type='speech',
                    order=idx + 1,
                )
