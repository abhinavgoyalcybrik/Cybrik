# crm_app/management/commands/fix_tenant_data.py
"""
Management command to diagnose and fix tenant assignments for leads and other data.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

class Command(BaseCommand):
    help = 'Diagnose and fix tenant assignments for leads, applicants, etc.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Actually fix the data (without this flag, just reports issues)',
        )
        parser.add_argument(
            '--tenant-slug',
            type=str,
            help='Tenant slug to assign orphaned data to (e.g., "cybrik")',
        )

    def handle(self, *args, **options):
        from crm_app.models import Lead, Applicant, Application, CallRecord, FollowUp, Tenant, UserProfile
        from django.contrib.auth.models import User
        
        fix_mode = options['fix']
        target_tenant_slug = options.get('tenant_slug')
        
        self.stdout.write("\n" + "="*60)
        self.stdout.write("TENANT DATA DIAGNOSIS REPORT")
        self.stdout.write("="*60 + "\n")
        
        # List all tenants
        tenants = list(Tenant.objects.all())
        self.stdout.write(f"\n📋 Existing Tenants ({len(tenants)}):")
        for t in tenants:
            self.stdout.write(f"   - {t.name} (slug: {t.slug}, id: {t.id}, active: {t.is_active})")
        
        # Check Leads
        self.stdout.write(f"\n\n📊 LEADS:")
        total_leads = Lead.objects.count()
        null_tenant_leads = Lead.objects.filter(tenant__isnull=True).count()
        self.stdout.write(f"   Total: {total_leads}")
        self.stdout.write(f"   Without tenant (NULL): {null_tenant_leads}")
        
        for t in tenants:
            count = Lead.objects.filter(tenant=t).count()
            self.stdout.write(f"   Tenant '{t.slug}': {count}")
        
        # Check Applicants
        self.stdout.write(f"\n📊 APPLICANTS:")
        total_applicants = Applicant.objects.count()
        null_tenant_applicants = Applicant.objects.filter(tenant__isnull=True).count()
        self.stdout.write(f"   Total: {total_applicants}")
        self.stdout.write(f"   Without tenant (NULL): {null_tenant_applicants}")
        
        for t in tenants:
            count = Applicant.objects.filter(tenant=t).count()
            self.stdout.write(f"   Tenant '{t.slug}': {count}")
        
        # Check UserProfiles
        self.stdout.write(f"\n📊 USER PROFILES:")
        total_profiles = UserProfile.objects.count()
        null_tenant_profiles = UserProfile.objects.filter(tenant__isnull=True).count()
        self.stdout.write(f"   Total: {total_profiles}")
        self.stdout.write(f"   Without tenant (NULL): {null_tenant_profiles}")
        
        for t in tenants:
            count = UserProfile.objects.filter(tenant=t).count()
            self.stdout.write(f"   Tenant '{t.slug}': {count}")
        
        # Check CallRecords
        self.stdout.write(f"\n📊 CALL RECORDS:")
        total_calls = CallRecord.objects.count()
        null_tenant_calls = CallRecord.objects.filter(tenant__isnull=True).count()
        self.stdout.write(f"   Total: {total_calls}")
        self.stdout.write(f"   Without tenant (NULL): {null_tenant_calls}")
        
        # Check FollowUps
        self.stdout.write(f"\n📊 FOLLOW-UPS:")
        total_followups = FollowUp.objects.count()
        null_tenant_followups = FollowUp.objects.filter(tenant__isnull=True).count()
        self.stdout.write(f"   Total: {total_followups}")
        self.stdout.write(f"   Without tenant (NULL): {null_tenant_followups}")
        
        # Summary
        orphan_count = null_tenant_leads + null_tenant_applicants + null_tenant_profiles + null_tenant_calls + null_tenant_followups
        self.stdout.write(f"\n\n⚠️  TOTAL ORPHANED RECORDS (no tenant): {orphan_count}")
        
        if orphan_count > 0 and not fix_mode:
            self.stdout.write(self.style.WARNING(
                f"\n💡 To fix, run: python manage.py fix_tenant_data --fix --tenant-slug=<slug>"
            ))
        
        # FIX MODE
        if fix_mode and target_tenant_slug:
            try:
                target_tenant = Tenant.objects.get(slug=target_tenant_slug)
            except Tenant.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"\n❌ Tenant '{target_tenant_slug}' not found!"))
                return
            
            self.stdout.write(f"\n\n🔧 FIXING: Assigning orphaned data to tenant '{target_tenant.name}'...\n")
            
            with transaction.atomic():
                # Fix Leads
                fixed_leads = Lead.objects.filter(tenant__isnull=True).update(tenant=target_tenant)
                self.stdout.write(f"   ✅ Fixed {fixed_leads} leads")
                
                # Fix Applicants
                fixed_applicants = Applicant.objects.filter(tenant__isnull=True).update(tenant=target_tenant)
                self.stdout.write(f"   ✅ Fixed {fixed_applicants} applicants")
                
                # Fix CallRecords
                fixed_calls = CallRecord.objects.filter(tenant__isnull=True).update(tenant=target_tenant)
                self.stdout.write(f"   ✅ Fixed {fixed_calls} call records")
                
                # Fix FollowUps
                fixed_followups = FollowUp.objects.filter(tenant__isnull=True).update(tenant=target_tenant)
                self.stdout.write(f"   ✅ Fixed {fixed_followups} follow-ups")
            
            self.stdout.write(self.style.SUCCESS(f"\n✅ All orphaned data assigned to '{target_tenant.name}'"))
        
        elif fix_mode and not target_tenant_slug:
            self.stdout.write(self.style.ERROR("\n❌ --tenant-slug is required when using --fix"))
        
        self.stdout.write("\n" + "="*60 + "\n")
