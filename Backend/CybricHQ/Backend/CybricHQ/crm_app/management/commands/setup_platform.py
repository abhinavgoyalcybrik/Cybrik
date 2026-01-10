"""
Management command to initialize the platform with a superadmin user and initial products.
Usage: python manage.py setup_platform
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from billing.models import Product, Plan


class Command(BaseCommand):
    help = 'Set up platform with superadmin and initial products for tenant provisioning'

    def add_arguments(self, parser):
        parser.add_argument(
            '--admin-username',
            type=str,
            default='superadmin',
            help='Username for the superadmin user (default: superadmin)'
        )
        parser.add_argument(
            '--admin-password',
            type=str,
            default='admin123',
            help='Password for the superadmin user (default: admin123)'
        )
        parser.add_argument(
            '--admin-email',
            type=str,
            default='admin@cybrik.com',
            help='Email for the superadmin user'
        )

    def handle(self, *args, **options):
        User = get_user_model()
        
        username = options['admin_username']
        password = options['admin_password']
        email = options['admin_email']
        
        # 1. Create or update superadmin user
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': email,
                'is_staff': True,
                'is_superuser': True,
            }
        )
        
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f'✓ Created superadmin user: {username}'))
        else:
            # Update password for existing user
            user.set_password(password)
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(self.style.WARNING(f'✓ Updated existing superadmin: {username}'))
        
        self.stdout.write(f'  Username: {username}')
        self.stdout.write(f'  Password: {password}')
        self.stdout.write('')
        
        # 2. Create initial products if they don't exist
        products_created = 0
        plans_created = 0
        
        # CRM Product
        crm_product, created = Product.objects.get_or_create(
            code='crm',
            defaults={
                'name': 'CybrikHQ CRM',
                'description': 'Complete CRM solution with applicant management, calls, leads, and analytics.',
                'active': True,
                'feature_flags': {
                    'crm': True,
                    'calls': True,
                    'leads': True,
                    'analytics': True,
                    'ai_calls': True,
                    'whatsapp': True,
                }
            }
        )
        if created:
            products_created += 1
            self.stdout.write(self.style.SUCCESS(f'✓ Created product: CybrikHQ CRM'))
            
            # Create plans for CRM
            plans_data = [
                {'name': 'Starter', 'price_cents': 4999, 'interval': 'month', 'currency': 'USD'},
                {'name': 'Professional', 'price_cents': 9999, 'interval': 'month', 'currency': 'USD'},
                {'name': 'Enterprise', 'price_cents': 24999, 'interval': 'month', 'currency': 'USD'},
            ]
            for plan_data in plans_data:
                plan, plan_created = Plan.objects.get_or_create(
                    product=crm_product,
                    name=plan_data['name'],
                    defaults=plan_data
                )
                if plan_created:
                    plans_created += 1
                    self.stdout.write(f'  + Plan: {plan.name} (${plan.price_cents/100}/{plan.interval})')
        else:
            self.stdout.write(self.style.WARNING(f'  Product already exists: CybrikHQ CRM'))
        
        # IELTS Product
        ielts_product, created = Product.objects.get_or_create(
            code='ielts',
            defaults={
                'name': 'IELTS Prep Portal',
                'description': 'AI-powered IELTS preparation platform with speaking, listening, reading, and writing tests.',
                'active': True,
                'feature_flags': {
                    'ielts': True,
                    'speaking_ai': True,
                    'writing_grading': True,
                    'listening_tests': True,
                    'reading_tests': True,
                }
            }
        )
        if created:
            products_created += 1
            self.stdout.write(self.style.SUCCESS(f'✓ Created product: IELTS Prep Portal'))
            
            # Create plans for IELTS
            plans_data = [
                {'name': 'Basic', 'price_cents': 1999, 'interval': 'month', 'currency': 'USD'},
                {'name': 'Premium', 'price_cents': 3999, 'interval': 'month', 'currency': 'USD'},
            ]
            for plan_data in plans_data:
                plan, plan_created = Plan.objects.get_or_create(
                    product=ielts_product,
                    name=plan_data['name'],
                    defaults=plan_data
                )
                if plan_created:
                    plans_created += 1
                    self.stdout.write(f'  + Plan: {plan.name} (${plan.price_cents/100}/{plan.interval})')
        else:
            self.stdout.write(self.style.WARNING(f'  Product already exists: IELTS Prep Portal'))
        
        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(self.style.SUCCESS('Platform Setup Complete!'))
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write('')
        self.stdout.write(f'Products created: {products_created}')
        self.stdout.write(f'Plans created: {plans_created}')
        self.stdout.write('')
        self.stdout.write('You can now:')
        self.stdout.write('  1. Login to Admin Panel at http://localhost:3000/login')
        self.stdout.write(f'     Username: {username}')
        self.stdout.write(f'     Password: {password}')
        self.stdout.write('  2. Create tenants and assign subscriptions')
        self.stdout.write('')
