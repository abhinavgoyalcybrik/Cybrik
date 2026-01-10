"""
Management command to create sample products for CRM, IELTS, and Portal.
Usage: python manage.py create_sample_products
"""
from django.core.management.base import BaseCommand
from billing.models import Product, Plan


class Command(BaseCommand):
    help = 'Create sample products (CRM, IELTS Prep, Application Portal) with feature flags'

    def handle(self, *args, **options):
        products_data = [
            {
                'code': 'crm',
                'name': 'CybrikHQ CRM',
                'description': 'Full-featured CRM with lead management, applicant tracking, calls, and analytics.',
                'feature_flags': {'crm': True},
            },
            {
                'code': 'ielts',
                'name': 'IELTS Prep Module',
                'description': 'IELTS preparation system with practice tests, speaking mock tests, and progress tracking.',
                'feature_flags': {'ielts_module': True},
            },
            {
                'code': 'portal',
                'name': 'Application Portal',
                'description': 'White-label application portal for students to submit applications and track status.',
                'feature_flags': {'application_portal': True},
            },
            {
                'code': 'complete',
                'name': 'CybrikHQ Complete',
                'description': 'All-in-one bundle with CRM, IELTS Prep, and Application Portal.',
                'feature_flags': {'crm': True, 'ielts_module': True, 'application_portal': True},
            },
        ]
        
        for data in products_data:
            product, created = Product.objects.update_or_create(
                code=data['code'],
                defaults={
                    'name': data['name'],
                    'description': data['description'],
                    'feature_flags': data['feature_flags'],
                    'active': True,
                }
            )
            status = 'Created' if created else 'Updated'
            self.stdout.write(self.style.SUCCESS(f'{status} product: {product.name}'))
            
            # Create default monthly plan if doesn't exist
            plan, plan_created = Plan.objects.get_or_create(
                product=product,
                name='Monthly',
                defaults={
                    'price_cents': 4999 if data['code'] != 'complete' else 9999,
                    'currency': 'USD',
                    'interval': 'month',
                    'interval_count': 1,
                    'active': True,
                }
            )
            if plan_created:
                self.stdout.write(f'  - Created plan: {plan.name} (${plan.price_cents/100}/month)')
        
        self.stdout.write(self.style.SUCCESS('\n✅ Sample products created!'))
        self.stdout.write('\nProducts available:')
        for product in Product.objects.all():
            features = ', '.join(k for k, v in product.feature_flags.items() if v) or 'None'
            self.stdout.write(f'  - {product.name} ({product.code}): Features = [{features}]')
