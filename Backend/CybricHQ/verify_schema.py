#!/usr/bin/env python
"""
Verify database schema columns exist
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from crm_app.models import Lead
from django.db import connection

print("Checking database schema...")

# Check columns exist in database
cursor = connection.cursor()

# Check is_manual_only column
cursor.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'crm_app_lead' AND column_name = 'is_manual_only'
""")
if cursor.fetchone():
    print("✅ is_manual_only column exists in database")
else:
    print("❌ is_manual_only column missing")
    sys.exit(1)

# Check walked_in_at column (optional)
cursor.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'crm_app_lead' AND column_name = 'walked_in_at'
""")
if cursor.fetchone():
    print("✅ walked_in_at column exists in database")
else:
    print("⚠️  walked_in_at column missing (optional)")

# Check receptionist_id column (optional)
cursor.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'crm_app_lead' AND column_name = 'receptionist_id'
""")
if cursor.fetchone():
    print("✅ receptionist_id column exists in database")
else:
    print("⚠️  receptionist_id column missing (optional)")

# Try to access the field via model (only if column exists)
try:
    # Use raw SQL to avoid model field access issues
    cursor.execute("SELECT id, name, is_manual_only FROM crm_app_lead LIMIT 1")
    result = cursor.fetchone()
    if result:
        lead_id, name, is_manual_only = result
        print(f"✅ Can access is_manual_only via SQL: Lead ID {lead_id}, is_manual_only={is_manual_only}")
    else:
        print("✅ is_manual_only column accessible but no leads in database")
    print("\n✅ SUCCESS: Critical database schema is correct!")
except Exception as e:
    print(f"❌ ERROR accessing is_manual_only: {e}")
    sys.exit(1)
