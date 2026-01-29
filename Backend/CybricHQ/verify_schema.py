#!/usr/bin/env python
"""
Verify is_manual_only column exists
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from crm_app.models import Lead
from django.db import connection

print("Checking is_manual_only column...")

# Try to query a lead
try:
    lead = Lead.objects.first()
    if lead:
        print(f"✅ Column exists - Value: {lead.is_manual_only}")
        print(f"✅ Lead ID {lead.id}: name={lead.name}, is_manual_only={lead.is_manual_only}")
    else:
        print("✅ Column exists but no leads in database")
    print("\n✅ SUCCESS: Database schema is correct!")
except Exception as e:
    print(f"❌ ERROR: {e}")
    print("\n⚠️  The migration may not have been applied to the production database")
