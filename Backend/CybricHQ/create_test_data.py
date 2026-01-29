import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from crm_app.models import Lead, Applicant, Application
from django.contrib.auth import get_user_model

User = get_user_model()

# Get or create a user for assignment
user = User.objects.first()
if not user:
    print("No users found. Please create a user first.")
    exit()

# Create test leads with countries
countries_data = [
    {"name": "John Netherlands", "email": "john@test.com", "phone": "+31123456789", "country": "Netherlands"},
    {"name": "Sarah Zealand", "email": "sarah@test.com", "phone": "+64123456789", "country": "New Zealand"},
    {"name": "Mike Australia", "email": "mike@test.com", "phone": "+61123456789", "country": "Australia"},
]

created_leads = []
for data in countries_data:
    lead, created = Lead.objects.get_or_create(
        email=data["email"],
        defaults={
            "name": data["name"],
            "phone": data["phone"],
            "country": data["country"],
            "source": "Website",
            "assigned_to": user,
        }
    )
    if created:
        print(f"✅ Created lead: {lead.name} - {lead.country}")
        created_leads.append(lead)
    else:
        # Update existing lead with country
        lead.country = data["country"]
        lead.save()
        print(f"✅ Updated lead: {lead.name} - {lead.country}")
        created_leads.append(lead)

# Create applicants from leads
for lead in created_leads:
    applicant, created = Applicant.objects.get_or_create(
        email=lead.email,
        defaults={
            "name": lead.name,
            "phone": lead.phone,
            "preferred_country": lead.country,
            "assigned_to": user,
        }
    )
    if created:
        print(f"✅ Created applicant: {applicant.name} - {applicant.preferred_country}")
        
        # Create an application for some applicants (for conversion funnel)
        if lead.country in ["Netherlands", "New Zealand"]:
            app, created = Application.objects.get_or_create(
                applicant=applicant,
                defaults={
                    "status": "submitted",
                    "assigned_to": user,
                }
            )
            if created:
                print(f"   ✅ Created application for {applicant.name}")

print("\n" + "="*50)
print(f"Total leads with country: {Lead.objects.exclude(country__isnull=True).exclude(country='').count()}")
print(f"Total applicants with preferred_country: {Applicant.objects.exclude(preferred_country__isnull=True).exclude(preferred_country='').count()}")
print(f"Total applications: {Application.objects.count()}")
