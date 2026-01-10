
import json
import os
from django.core.management.base import BaseCommand
from ielts_service.models import IELTSTest, TestModule, QuestionGroup, Question
from django.conf import settings

class Command(BaseCommand):
    help = 'Imports IELTS Reading tests from JSON files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            help='Path to the JSON file (relative to project root)',
            default=None
        )
        parser.add_argument(
            '--title',
            type=str,
            help='Custom title for the test',
            default=None
        )

    def handle(self, *args, **options):
        # Get file path
        file_arg = options.get('file')
        
        if file_arg:
            # Handle relative paths
            if not os.path.isabs(file_arg):
                json_path = os.path.abspath(os.path.join(settings.BASE_DIR, '..', '..', file_arg))
            else:
                json_path = file_arg
        else:
            # Default to the old behavior
            json_path = os.path.abspath(os.path.join(settings.BASE_DIR, '..', '..', 'Cambridge 13 Reading Test 3.json'))
        
        if not os.path.exists(json_path):
            self.stdout.write(self.style.ERROR(f'File not found: {json_path}'))
            return

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Create or Get Test
        test_title = options.get('title') or os.path.splitext(os.path.basename(json_path))[0].replace('_', ' ')
        test, created = IELTSTest.objects.get_or_create(
            title=test_title,
            defaults={
                'description': f'IELTS Academic Reading Test - Imported from {os.path.basename(json_path)}',
                'test_type': 'academic',
                'active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created test: {test.title}'))
        else:
            self.stdout.write(f'Updating test: {test.title}')
            # Clear existing reading module to avoid duplicates
            TestModule.objects.filter(test=test, module_type='reading').delete()

        # Create Reading Module
        module = TestModule.objects.create(
            test=test,
            module_type='reading',
            duration_minutes=60,
            order=2
        )

        total_questions = 0
        
        # Map JSON types to DB group_type
        TYPE_MAP = {
            'SUMMARY_COMPLETION': 'summary_completion',
            'TABLE_COMPLETION': 'table_completion',
            'MATCHING_FEATURES': 'matching_features',
            'MATCHING_HEADINGS': 'matching_headings',
            'TRUE_FALSE_NOT_GIVEN': 'true_false_ng',
            'YES_NO_NOT_GIVEN': 'yes_no_ng',
            'MULTIPLE_CHOICE': 'multiple_choice',
            'SENTENCE_COMPLETION': 'sentence_completion',
        }
        
        # Process Passages
        for p_idx, passage in enumerate(data.get('passages', [])):
            passage_id = passage.get('passage_id', f'P{p_idx + 1}')
            passage_title = passage.get('title', f'Passage {p_idx + 1}')
            passage_text = passage.get('text', '')
            
            self.stdout.write(f'Processing passage: {passage_title}')
            
            # Process Groups within Passage
            for g_idx, group in enumerate(passage.get('groups', [])):
                group_id = group.get('group_id', f'{passage_id}-G{g_idx + 1}')
                json_type = group.get('type', 'TEXT')
                instructions = group.get('instructions', '')
                
                # Get container (rich text with slots) if present
                container = group.get('container', {})
                
                # Get options (word bank or matching options)
                group_options = group.get('options', [])
                
                # Get image URL if present (for diagram/flowchart questions)
                image_url = group.get('image', '')
                
                # Determine group_type
                group_type = TYPE_MAP.get(json_type, 'standard')
                
                # Create the question group
                q_group = QuestionGroup.objects.create(
                    module=module,
                    title=passage_title,
                    content=passage_text,
                    instructions=instructions,
                    group_type=group_type,
                    container=container,
                    options=group_options,
                    image=image_url,
                    order=p_idx * 10 + g_idx  # Unique ordering
                )
                
                # Process Items (Questions)
                for item in group.get('items', []):
                    item_id = item.get('item_id', '')
                    question_number = item.get('number', 0)
                    prompt = item.get('prompt', '')
                    answer_data = item.get('answer', {})
                    correct_answer = answer_data.get('value', '')
                    
                    # Determine Question Type and Options
                    db_type = 'text_input'  # default
                    options_list = []
                    
                    if json_type == 'TRUE_FALSE_NOT_GIVEN':
                        db_type = 'true_false'
                        options_list = ['TRUE', 'FALSE', 'NOT GIVEN']
                        
                    elif json_type == 'YES_NO_NOT_GIVEN':
                        db_type = 'true_false'
                        options_list = ['YES', 'NO', 'NOT GIVEN']
                        
                    elif json_type == 'MATCHING_FEATURES' or json_type == 'MATCHING_HEADINGS':
                        db_type = 'matching'
                        # Options are at group level - stored in question group
                        options_list = [opt.get('key') for opt in group_options]
                        
                    elif json_type == 'MULTIPLE_CHOICE':
                        db_type = 'multiple_choice'
                        # Options can be at item level or group level
                        item_options = item.get('options', [])
                        # Handle options - Keep full object structure {key, text} for frontend
                        if item_options:
                            options_list = item_options
                        else:
                            # For group level options (like matching), we might need keys or full objects depending on usage
                            # For Multi-Select (Choose N), we keep full objects
                            options_list = group_options
                            
                    elif json_type in ['SUMMARY_COMPLETION', 'TABLE_COMPLETION', 'SENTENCE_COMPLETION']:
                        db_type = 'text_input'
                        # Options are word bank - stored in question group
                    
                    # For questions with prompts in items (YES/NO, MATCHING, MCQ)
                    question_text = prompt if prompt else f"Question {question_number}"
                    
                    Question.objects.create(
                        group=q_group,
                        question_text=question_text,
                        question_type=db_type,
                        options=options_list,
                        correct_answer=str(correct_answer),
                        order=question_number
                    )
                    total_questions += 1
        
        self.stdout.write(self.style.SUCCESS(
            f'Successfully imported "{test.title}" with {len(data.get("passages", []))} passages and {total_questions} questions'
        ))
        self.stdout.write(self.style.SUCCESS(f'Test ID: {test.id}'))
