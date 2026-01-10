"""
Management command to create a default tenant for existing deployments.
Usage: python manage.py create_default_tenant
"""
from django.core.management.base import BaseCommand
from crm_app.models import Tenant, TenantSettings, UserProfile


class Command(BaseCommand):
    help = 'Create a default tenant and assign all existing users to it'

    def add_arguments(self, parser):
        parser.add_argument(
            '--name',
            default='CybrikHQ',
            help='Name of the default tenant'
        )
        parser.add_argument(
            '--slug',
            default='cybrikhq',
            help='URL slug for the default tenant'
        )
        parser.add_argument(
            '--primary-color',
            default='#6366f1',
            help='Primary brand color (hex)'
        )

    def handle(self, *args, **options):
        # Check if default tenant exists
        tenant, created = Tenant.objects.get_or_create(
            slug=options['slug'],
            defaults={
                'name': options['name'],
                'is_active': True,
            }
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f'Created tenant: {tenant.name} ({tenant.slug})'))
        else:
            self.stdout.write(self.style.WARNING(f'Tenant already exists: {tenant.name}'))

        # Create or update settings
        settings, settings_created = TenantSettings.objects.get_or_create(
            tenant=tenant,
            defaults={
                'company_name': options['name'],
                'primary_color': options['primary_color'],
                'secondary_color': '#4f46e5',
                'accent_color': '#8b5cf6',
            }
        )

        if settings_created:
            self.stdout.write(self.style.SUCCESS(f'Created settings for tenant: {tenant.name}'))
        else:
            self.stdout.write(self.style.WARNING(f'Settings already exist for tenant: {tenant.name}'))

        # Assign all existing users without a tenant to this default tenant
        unassigned_profiles = UserProfile.objects.filter(tenant__isnull=True)
        count = unassigned_profiles.count()
        
        if count > 0:
            unassigned_profiles.update(tenant=tenant)
            self.stdout.write(self.style.SUCCESS(f'Assigned {count} users to tenant: {tenant.name}'))
        else:
            self.stdout.write(self.style.SUCCESS('All users already have a tenant assigned'))

        self.stdout.write(self.style.SUCCESS('\n✅ Default tenant setup complete!'))
        self.stdout.write(f'   Tenant ID: {tenant.id}')
        self.stdout.write(f'   Tenant Name: {tenant.name}')
        self.stdout.write(f'   Tenant Slug: {tenant.slug}')
