import os
import django
import sys

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from billing.models import Plan, Product

def setup():
    print("--- Setting up Billing Plans ---")
    
    # 1. Ensure Product Exists
    product, created = Product.objects.get_or_create(
        name='IELTS Premium',
        defaults={
            'description': 'Premium IELTS Preparation Package',
            'active': True
        }
    )
    if created:
        print(f"✅ Created Product: {product.name}")
    else:
        print(f"ℹ️  Product exists: {product.name}")

    # 2. Ensure Plan Exists
    # Price: 1000 INR (100000 paise)
    plan, created = Plan.objects.get_or_create(
        name='Premium Plan',
        defaults={
            'product': product,
            'price_cents': 100000,  # 1000 INR
            'currency': 'INR',
            'interval': 'month',
            'active': True
        }
    )
    
    if created:
        print(f"✅ Created Plan: {plan.name}")
    else:
        print(f"ℹ️  Plan exists: {plan.name}")
        # Update price if needed to match UI? 
        # plan.price_cents = 100000
        # plan.save()

    print("\n---------------------------------------------------")
    print(f"🎉 PREMIUM PLAN ID: {plan.id}")
    print("---------------------------------------------------")
    print("👉 Copy this ID and send it to the developer!")

if __name__ == '__main__':
    setup()
