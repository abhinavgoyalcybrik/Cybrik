"""
Management command to assign all existing data to the default tenant.
Usage: python manage.py assign_data_to_tenant --tenant cybrikhq
"""
from django.core.management.base import BaseCommand
from crm_app.models import Tenant, Applicant, Lead, Application, CallRecord, FollowUp, Notification


class Command(BaseCommand):
    help = 'Assign all existing data (without tenant) to a specified tenant'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant',
            default='cybrikhq',
            help='Tenant slug to assign data to'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes'
        )

    def handle(self, *args, **options):
        tenant_slug = options['tenant']
        dry_run = options['dry_run']
        
        # Get tenant
        try:
            tenant = Tenant.objects.get(slug=tenant_slug)
        except Tenant.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Tenant not found: {tenant_slug}'))
            return
        
        self.stdout.write(f'Assigning data to tenant: {tenant.name} ({tenant.slug})')
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made'))
        
        # Models to update
        models_to_update = [
            ('Applicant', Applicant),
            ('Lead', Lead),
            ('Application', Application),
            ('CallRecord', CallRecord),
            ('FollowUp', FollowUp),
            ('Notification', Notification),
        ]
        
        total_updated = 0
        
        for model_name, model_class in models_to_update:
            # Count records without tenant
            unassigned = model_class.objects.filter(tenant__isnull=True)
            count = unassigned.count()
            
            if count > 0:
                if not dry_run:
                    updated = unassigned.update(tenant=tenant)
                    self.stdout.write(self.style.SUCCESS(
                        f'  {model_name}: {updated} records assigned to {tenant.name}'
                    ))
                    total_updated += updated
                else:
                    self.stdout.write(f'  {model_name}: {count} records would be assigned')
                    total_updated += count
            else:
                self.stdout.write(f'  {model_name}: All records already have a tenant')
        
        if dry_run:
            self.stdout.write(self.style.WARNING(f'\nDRY RUN: {total_updated} total records would be updated'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\n✅ {total_updated} total records assigned to {tenant.name}'))
