
import json
import os
from django.core.management.base import BaseCommand
from ielts_service.models import IELTSTest, TestModule, QuestionGroup, Question
from django.conf import settings

class Command(BaseCommand):
    help = 'Imports IELTS Reading tests from JSON files'

    def handle(self, *args, **options):
        # Path to the JSON file
        # JSON is at d:\CybricHQ\CybricHQ\Cambridge 13 Reading Test 3.json
        # BASE_DIR is d:\CybricHQ\CybricHQ\Backend\CybricHQ
        json_path = os.path.abspath(os.path.join(settings.BASE_DIR, '..', '..', 'Cambridge 13 Reading Test 3.json'))
        
        if not os.path.exists(json_path):
            self.stdout.write(self.style.ERROR(f'File not found: {json_path}'))
            return

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Create or Get Test
        test_title = "Cambridge 13 Reading Test 3"
        test, created = IELTSTest.objects.get_or_create(
            title=test_title,
            defaults={
                'description': 'Imported Reading Test',
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

        global_order = 1
        
        # Process Passages
        for p_idx, passage in enumerate(data.get('passages', [])):
            passage_title = passage.get('title', f'Passage {p_idx + 1}')
            passage_text = passage.get('text', '')
            
            # Process Groups within Passage
            for g_idx, group in enumerate(passage.get('groups', [])):
                q_group = QuestionGroup.objects.create(
                    module=module,
                    title=f"{passage_title} - Section {g_idx + 1}",
                    content=passage_text,
                    instructions=group.get('instructions', ''),
                    order=global_order
                )
                global_order += 1
                
                # Process Items (Questions)
                for item in group.get('items', []):
                    # Determine Question Type
                    json_type = group.get('type', 'TEXT')
                    db_type = 'text_input' # default
                    options_list = []
                    
                    if json_type == 'TRUE_FALSE_NOT_GIVEN' or json_type == 'YES_NO_NOT_GIVEN':
                        db_type = 'multiple_choice' # approximate
                        options_list = ['TRUE', 'FALSE', 'NOT GIVEN'] if json_type == 'TRUE_FALSE_NOT_GIVEN' else ['YES', 'NO', 'NOT GIVEN']
                    elif json_type == 'MATCHING_HEADINGS':
                        db_type = 'multiple_choice'
                        # Options might be in the group 'options'
                        group_options = group.get('options', [])
                        options_list = [opt.get('key') for opt in group_options]
                    elif json_type == 'MULTIPLE_CHOICE':
                        db_type = 'multiple_choice'
                        # Options usually in item
                        item_options = item.get('options', [])
                        options_list = [opt.get('value') for opt in item_options]
                    
                    # Construct Prompt
                    prompt = item.get('prompt', '')
                    if not prompt and json_type == 'TABLE_COMPLETION':
                        prompt = f"Question {item.get('number')}"
                    
                    Question.objects.create(
                        group=q_group,
                        question_text=prompt,
                        question_type=db_type,
                        options=options_list,
                        correct_answer=item.get('answer', {}).get('value', ''),
                        order=item.get('number', 0)
                    )
        
        self.stdout.write(self.style.SUCCESS(f'Successfully imported Reading Test with {global_order-1} question groups'))
