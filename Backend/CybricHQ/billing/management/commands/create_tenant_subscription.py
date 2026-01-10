"""
Management command to create a sample subscription for a tenant.
Usage: python manage.py create_tenant_subscription --tenant cybrikhq --product complete
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from crm_app.models import Tenant
from billing.models import Product, Plan, Subscription


class Command(BaseCommand):
    help = 'Create a subscription for a tenant'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant',
            default='cybrikhq',
            help='Tenant slug'
        )
        parser.add_argument(
            '--product',
            default='complete',
            help='Product code (crm, ielts, portal, complete)'
        )

    def handle(self, *args, **options):
        tenant_slug = options['tenant']
        product_code = options['product']
        
        # Get tenant
        try:
            tenant = Tenant.objects.get(slug=tenant_slug)
        except Tenant.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Tenant not found: {tenant_slug}'))
            return
        
        # Get product
        try:
            product = Product.objects.get(code=product_code)
        except Product.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Product not found: {product_code}'))
            return
        
        # Get monthly plan
        plan = Plan.objects.filter(product=product, interval='month').first()
        if not plan:
            self.stdout.write(self.style.ERROR(f'No monthly plan found for product: {product_code}'))
            return
        
        # Create subscription
        now = timezone.now()
        subscription, created = Subscription.objects.get_or_create(
            tenant=tenant,
            plan=plan,
            defaults={
                'status': 'active',
                'start_date': now,
                'current_period_start': now,
                'current_period_end': now + relativedelta(months=1),
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(
                f'Created subscription: {tenant.name} → {product.name} ({plan.name})'
            ))
        else:
            self.stdout.write(self.style.WARNING(
                f'Subscription already exists: {tenant.name} → {product.name}'
            ))
        
        # Show tenant access summary
        from crm_app.feature_access import get_tenant_subscription_summary
        summary = get_tenant_subscription_summary(tenant)
        
        self.stdout.write(f'\n✅ Tenant Access Summary for {tenant.name}:')
        self.stdout.write(f'   Products: {", ".join(summary["products"])}')
        self.stdout.write(f'   Features: {", ".join(summary["features"].keys())}')
