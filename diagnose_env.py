import os
import sys
import django
from django.conf import settings

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from crm_app.models import Lead, CallRecord

print("\n--- DIAGNOSTIC REPORT ---")

# 1. Check API Key Visibility
api_key = getattr(settings, 'SMARTFLO_API_KEY', None)
print(f"SMARTFLO_API_KEY loaded: {'YES' if api_key else 'NO'}")
if api_key:
    print(f"Key start: {api_key[:5]}...")
    print(f"Key end: ...{api_key[-5:]}")

# 2. Check Latest Lead & Call
try:
    lead = Lead.objects.latest('received_at')
    print(f"\nLatest Lead ID: {lead.id} ({lead.name})")
    print(f"Created at: {lead.received_at}")
    
    call = CallRecord.objects.filter(lead=lead).first()
    if call:
        print(f"Call Status: {call.status}")
        print(f"Call Metadata: {call.metadata}")
    else:
        print("No CallRecord found for this lead.")
except Exception as e:
    print(f"Error checking lead: {e}")

print("-------------------------\n")
