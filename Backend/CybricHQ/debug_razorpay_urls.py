import os
import sys
import django
from django.urls import resolve, reverse, get_resolver

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

print("\n--- Checking URL Configuration ---")

try:
    # 1. Try to import the billing views directly (checks dependencies)
    print("1. Attempting to import billing.views...")
    from billing import views
    print("   ✅ billing.views imported successfully.")

    # Check URL Order
    from CybricHQ.urls import urlpatterns
    print("\n   Checking URL Pattern Order:")
    for i, p in enumerate(urlpatterns):
        print(f"   [{i}] {p.pattern}")
        # We want to see 'api/billing/' BEFORE 'api/'

except ImportError as e:
    print(f"   ❌ FAILED to import billing.views: {e}")
    print("   ⚠️  Likely missing 'razorpay' library. Run: pip install razorpay")
    sys.exit(1)

try:
    # 2. Check if the URL resolves
    print("\n2. resolving /api/billing/razorpay/initiate_payment/ ...")
    target_url = "/api/billing/razorpay/initiate_payment/"
    match = resolve(target_url)
    print(f"   ✅ URL resolves to: {match.func.__name__} in {match.app_name}")
except Exception as e:
    print(f"   ❌ URL Resolution FAILED: {e}")
    
    # List all billing urls to help debug
    print("\n   Dumping active patterns in api/billing/:")
    resolver = get_resolver()
    for pattern in resolver.url_patterns:
        if str(pattern.pattern) == 'api/':
            for sub in pattern.url_patterns:
                if str(sub.pattern) == 'billing/':
                    print(f"   Found billing include: {sub}")
                    # This is deep nesting, might need recursion, but this is a shallow check

print("\n--- Summary ---")
print("If this script runs successfully with ✅, then your CODE is correct.")
print("If you still get 404 in the browser/app, it means the RUNNING SERVER is outdated.")
print("SOLUTION: Restart Gunicorn/Supervisor process.")
