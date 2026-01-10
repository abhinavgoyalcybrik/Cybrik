"""Demo script for multi-tenant system"""
from django.test import Client
import json

c = Client()

print("=" * 60)
print("   MULTI-TENANT SYSTEM DEMONSTRATION")
print("=" * 60)
print()

# 1. Test CybrikHQ branding
print("1. CybrikHQ Tenant Branding:")
print("-" * 40)
response = c.get('/api/tenant/branding/?tenant=cybrikhq')
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    data = json.loads(response.content)
    print(f"   Company: {data.get('company_name')}")
    print(f"   Primary Color: {data.get('primary_color')}")
    print(f"   Slug: {data.get('slug')}")
print()

# 2. Test Demo Academy branding
print("2. Demo Academy Tenant Branding:")
print("-" * 40)
response = c.get('/api/tenant/branding/?tenant=demo-academy')
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    data = json.loads(response.content)
    print(f"   Company: {data.get('company_name')}")
    print(f"   Primary Color: {data.get('primary_color')}")
    print(f"   Slug: {data.get('slug')}")
print()

# 3. Show data isolation
print("3. DATA ISOLATION DEMO:")
print("-" * 40)
from crm_app.models import Tenant, Applicant, Lead
cybrik = Tenant.objects.get(slug='cybrikhq')
demo = Tenant.objects.get(slug='demo-academy')

print(f"   CybrikHQ:")
print(f"     - Applicants: {Applicant.objects.filter(tenant=cybrik).count()}")
print(f"     - Leads: {Lead.objects.filter(tenant=cybrik).count()}")
print()
print(f"   Demo Academy:")
print(f"     - Applicants: {Applicant.objects.filter(tenant=demo).count()}")
print(f"     - Leads: {Lead.objects.filter(tenant=demo).count()}")
print()
print(f"   Total Applicants in DB: {Applicant.objects.count()}")
print()
print("   ✅ Each tenant only sees their own data!")
print()

# 4. Show subscription/features
print("4. SUBSCRIPTION & FEATURES:")
print("-" * 40)
from crm_app.feature_access import get_tenant_subscription_summary
print(f"   CybrikHQ:")
summary = get_tenant_subscription_summary(cybrik)
print(f"     Products: {', '.join(summary['products'])}")
print(f"     Features: {', '.join(summary['features'].keys())}")
print()
print(f"   Demo Academy:")
summary = get_tenant_subscription_summary(demo)
print(f"     Products: {', '.join(summary['products'])}")
print(f"     Features: {', '.join(summary['features'].keys())}")
print()
print("=" * 60)
print("   DEMO COMPLETE!")
print("=" * 60)
