
import os
import django
import sys

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "CybricHQ.settings")
django.setup()

from crm_app.models import Applicant, Tenant, Lead

def inspect_data():
    print("--- Tenants ---")
    tenants = Tenant.objects.all()
    for t in tenants:
        print(f"ID: {t.id}, Name: {t.name}, Slug: {t.slug}")

    print("\n--- Recent Applicants (Last 10) ---")
    applicants = Applicant.objects.all().order_by('-created_at')[:10]
    if not applicants:
        print("No applicants found.")
    for a in applicants:
        t_name = a.tenant.name if a.tenant else "NONE"
        print(f"ID: {a.id}, Name: {a.first_name} {a.last_name}, Tenant: {t_name} (ID: {a.tenant_id if a.tenant else 'None'}), Phone: {a.phone}")

    print("\n--- Recent Leads (Last 5) ---")
    leads = Lead.objects.all().order_by('-created_at')[:5]
    for l in leads:
        t_name = l.tenant.name if l.tenant else "NONE"
        print(f"ID: {l.id}, Name: {l.name}, Tenant: {t_name} (ID: {l.tenant_id if l.tenant else 'None'}), Status: {l.status}")

if __name__ == "__main__":
    inspect_data()
