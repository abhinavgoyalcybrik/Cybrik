import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from django.contrib.auth import get_user_model
from crm_app.models import Tenant

User = get_user_model()

def list_users(schema_name):
    print(f"\n--- Users in schema: {schema_name} ---")
    try:
        with connection.cursor() as cursor:
            cursor.execute(f'SET search_path TO "{schema_name}"')
        
        users = User.objects.all().order_by('id')
        if not users.exists():
            print("  (No users found)")
        for user in users:
            print(f"  ID: {user.id} | Username: {user.username} | Email: {user.email} | Superuser: {user.is_superuser} | Active: {user.is_active}")
            
    except Exception as e:
        print(f"  Error accessing schema {schema_name}: {e}")

# 1. Check Public Schema (where users SHOULD be for login)
list_users('public')

# 2. Check all Tenant Schemas (where users might ACCIDENTALLY be)
tenants = Tenant.objects.all()
for tenant in tenants:
    schema = tenant.database_schema
    if schema:
        list_users(schema)
    else:
        print(f"\n--- Tenant {tenant.slug} has no schema defined ---")

print("\n--- End of Report ---")
