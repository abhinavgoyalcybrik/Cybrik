import os
import django
import json
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
try:
    django.setup()
except Exception as e:
    print(f"Error setting up Django: {e}")
    sys.exit(1)

from ielts_service.models import IELTSTest, TestModule, QuestionGroup, Question

def import_reading_test(file_path):
    print(f"Importing test from {file_path}...")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 1. Create or Get Test
    test_title = "IELTS Reading Test 01RT01"
    test, created = IELTSTest.objects.get_or_create(
        title=test_title,
        defaults={
            'description': 'Imported from 01RT01.json',
            'test_type': 'academic',
            'active': True
        }
    )
    if created:
        print(f"Created new test: {test.title}")
    else:
        print(f"Updating existing test: {test.title}")

    # 2. Create or Get Module
    module, created = TestModule.objects.get_or_create(
        test=test,
        module_type='reading',
        defaults={'duration_minutes': 60, 'order': 2}
    )

    # Clear existing data for this module to avoid duplicates/conflicts on re-run
    print("Clearing existing questions/groups...")
    module.question_groups.all().delete()

    # 3. Process Passages
    for p_idx, passage in enumerate(data.get('passages', [])):
        print(f"Processing Passage {p_idx + 1}: {passage.get('title')}")
        
        group = QuestionGroup.objects.create(
            module=module,
            title=passage.get('title', f"Passage {p_idx + 1}"),
            content=passage.get('text', ''),
            order=p_idx + 1
        )

        # 4. Process Question Groups inside Passage
        for g_idx, q_group_data in enumerate(passage.get('groups', [])):
            group_type = q_group_data.get('type')
            instructions = q_group_data.get('instructions', '')
            
            # Append instructions to Group instructions if multiple? 
            # Or assume instructions apply to the questions.
            # Since QuestionGroup in DB is per-passage, we might lose per-question-group instructions 
            # if we don't store them. 
            # Ideally, detailed instructions should be part of the Question text or stored loosely.
            # For now, we'll prepend instructions to the question text or ignore if redundant.
            
            items = q_group_data.get('items', [])
            
            # Handle Options for Matching
            options_map = {}
            if 'options' in q_group_data:
                # Store options in a way we can lookup, or store in Question.options
                raw_options = q_group_data['options'] # List of {key, text}
                # For Matching Features, we might want to store 'A: Mark VanDam', etc.
                # We'll store this in the Question.options field.
                pass

            for item in items:
                q_number = item.get('number')
                q_item_id = item.get('item_id')
                
                # Determine Question Type and Answer
                db_q_type = 'text_input' # default
                correct_answer = ''
                options_list = []

                # Answer Extraction
                answer_data = item.get('answer', {})
                if isinstance(answer_data, dict):
                    ans_type = answer_data.get('type')
                    ans_val = answer_data.get('value')
                    
                    if ans_type == 'ENUM': # True/False
                        db_q_type = 'true_false'
                        correct_answer = ans_val
                    elif ans_type == 'OPTION': # Matching (A, B, C) or MCQ
                        db_q_type = 'matching' if 'MATCHING' in group_type else 'multiple_choice'
                        correct_answer = ans_val
                        # Add options from group if available
                        if 'options' in q_group_data:
                             options_list = q_group_data['options']
                    elif ans_type == 'TEXT':
                        db_q_type = 'text_input'
                        correct_answer = ans_val

                # Prompt / Question Text Extraction
                prompt = item.get('prompt')
                
                # If no prompt (e.g. Table Completion), try to build one
                if not prompt:
                    # Generic fallback
                    prompt = f"Question {q_number}"
                    
                    # Try to find context from container slots
                    container = q_group_data.get('container')
                    if container and container.get('kind') == 'table':
                         # Complex to parse, stick to generic or instructions
                         pass
                    elif container and container.get('kind') == 'richtext':
                         # Try to find surrounding text for the slot
                         # Very complex, skip for MVP
                         pass

                    # If instructions exist, maybe prepend them?
                    # "Complete the table... Question 1"
                    # prompt = f"{instructions}\n\nQuestion {q_number}" 
                
                # Create Question
                Question.objects.create(
                    group=group,
                    question_text=prompt,
                    question_type=db_q_type,
                    order=q_number,
                    correct_answer=correct_answer,
                    options=options_list
                )
                print(f"  - Added Q{q_number} ({db_q_type}): {correct_answer}")

    print("Import complete!")

if __name__ == "__main__":
    file_path = r"d:\CybricHQ\CybricHQ\01RT01.json"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
    else:
        import_reading_test(file_path)
