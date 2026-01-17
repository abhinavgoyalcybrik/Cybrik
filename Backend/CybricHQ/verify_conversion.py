import os
import django
import sys
import logging
from django.conf import settings

# Setup Path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# Load .env file
from dotenv import load_dotenv
load_dotenv(os.path.join(current_dir, '.env'))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from crm_app.models import Lead, Application, Applicant, Tenant

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def verify_lead_conversion():
    with open("verify_result.txt", "w") as f:
        f.write("--- Starting Lead Conversion Verification ---\n")
        try:
            # 1. Get or Create a Tenant
            tenant, _ = Tenant.objects.get_or_create(name="Test Tenant", defaults={"slug": "test-tenant-verify"})
            f.write(f"Tenant: {tenant.id}\n")

            # 2. Create a Test Lead
            lead_email = "test.convert.file@example.com"
            lead, created = Lead.objects.get_or_create(
                email=lead_email,
                defaults={
                    "tenant": tenant,
                    "name": "Test Conversion Lead File",
                    "first_name": "Test",
                    "last_name": "ConversionFile",
                    "phone": "+919876543210",
                    "status": "new",
                    "interested_service": "Visa Application",
                    "external_id": "test_verification_linked_id"
                }
            )
            if not created:
                lead.status = "new"
                lead.save()
            
            f.write(f"Lead Created: {lead.id} - Status: {lead.status}\n")

            # 3. Simulate Conversion
            f.write("converting lead...\n")
            lead.status = "converted"
            lead.save()
            f.write("Lead saved with status 'converted'.\n")

            # 4. Verification
            applicant = Applicant.objects.filter(email=lead_email).first()
            if applicant:
                f.write(f"SUCCESS: Applicant Created: {applicant.id}\n")
            else:
                f.write("FAILURE: Applicant NOT created.\n")

            application = Application.objects.filter(lead=lead).first()
            if application:
                f.write(f"SUCCESS: Application Created: {application.id}\n")
            else:
                f.write("FAILURE: Application NOT created.\n")

            # Cleanup
            if application:
                application.delete()
            if applicant:
                applicant.delete()
            lead.delete()
            f.write("Test data cleaned up.\n")
        except Exception as e:
            import traceback
            f.write(f"ERROR: {str(e)}\n")
            f.write(traceback.format_exc())

# Run Verification
verify_lead_conversion()
