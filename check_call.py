import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybrikHQ.settings')
django.setup()

from crm_app.models import CallRecord, Lead

# Get the latest lead
lead = Lead.objects.latest('received_at')
print(f'Lead ID: {lead.id}')
print(f'Lead Name: {lead.name}')
print(f'Phone: {lead.phone}')

# Get calls for this lead
calls = CallRecord.objects.filter(lead=lead)
print(f'\nTotal call records: {calls.count()}')

for call in calls:
    print(f'\nCall ID: {call.id}')
    print(f'Status: {call.status}')
    print(f'External ID: {call.external_call_id}')
    print(f'Provider: {call.provider}')
    print(f'Metadata: {call.metadata}')
