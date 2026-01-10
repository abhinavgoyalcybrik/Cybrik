import os
import django
import sys

# Setup Django environment
sys.path.append(r'd:\CybricHQ\CybricHQ\Backend\CybricHQ')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from ielts_service.models import IELTSTest, TestModule, QuestionGroup, Question

def create_sample_data():
    print("Creating sample IELTS test data...")
    
    # 1. Create Test
    test, created = IELTSTest.objects.get_or_create(
        title="IELTS Academic Mock Test 1",
        defaults={
            'description': "Full length academic test suitable for band 7+ practice.",
            'test_type': 'academic'
        }
    )
    if not created:
        print("Test already exists. Cleaning up...")
        # Optional: delete to start fresh or just append? Let's clear logic children if needed or just return
        # test.modules.all().delete()
    
    print(f"Test: {test.title}")

    # 2. Create Modules
    modules = {}
    for m_type in ['listening', 'reading', 'writing', 'speaking']:
        mod, _ = TestModule.objects.get_or_create(
            test=test,
            module_type=m_type,
            defaults={'duration_minutes': 60 if m_type in ['reading', 'writing'] else 30}
        )
        modules[m_type] = mod

    # 3. Add Content to Reading Module
    reading_mod = modules['reading']
    
    # Passage 1
    p1, _ = QuestionGroup.objects.get_or_create(
        module=reading_mod,
        title="Passage 1: The Life of Bees",
        order=1,
        defaults={
            'content': """
            Bees are winged insects closely related to wasps and ants, known for their roles in pollination and, in the case of the best-known bee species, the western honey bee, for producing honey. Bees are a monophyletic lineage within the superfamily Apoidea. They are presently considered a clade, called Anthophila. There are over 16,000 known species of bees in seven recognized biological families. Some species – including honey bees, bumblebees, and stingless bees – live socially in colonies while some species – including mason bees, carpenter bees, leafcutter bees, and sweat bees – are solitary.
            
            Bees are found on every continent except Antarctica, in every habitat on the planet that contains insect-pollinated flowering plants. The most common bees in the Northern Hemisphere are the Halictidae, or sweat bees, but they are small and often mistaken for wasps or flies. Vertebrate predators of bees include birds such as bee-eaters; insect predators include beewolves and dragonflies.
            """
        }
    )
    
    # Questions for Passage 1
    Question.objects.get_or_create(
        group=p1,
        order=1,
        question_text="How many known species of bees are there?",
        question_type="multiple_choice",
        defaults={
            'options': ["Over 10,000", "Over 16,000", "Under 5,000", "Exactly 7"],
            'correct_answer': "Over 16,000"
        }
    )
    
    Question.objects.get_or_create(
        group=p1,
        order=2,
        question_text="Which continent are bees NOT found on?",
        question_type="text_input",
        defaults={
            'correct_answer': "Antarctica"
        }
    )

    print("Sample data created successfully!")

if __name__ == "__main__":
    create_sample_data()
