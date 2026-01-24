
import os
import sys
import django

print("--- Environment Check ---")
print(f"Python: {sys.version}")

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
try:
    django.setup()
    print("✅ Django setup successful")
except Exception as e:
    print(f"❌ Django setup FAILED: {e}")
    sys.exit(1)

from django.conf import settings

print(f"KEY_ID from settings: {getattr(settings, 'RAZORPAY_KEY_ID', 'NOT_SET')}")
print(f"KEY_SECRET from settings: {'PRESENT' if getattr(settings, 'RAZORPAY_KEY_SECRET', None) else 'MISSING'}")

print("\n--- Import Check ---")
try:
    import razorpay
    print(f"✅ razorpay imported. Version: {razorpay.__version__ if hasattr(razorpay, '__version__') else 'Unknown'}")
except ImportError as e:
    print(f"❌ FAILED to import razorpay: {e}")
    print("   👉 ACTION REQUIRED: Run 'pip install razorpay'")
    sys.exit(1)

print("\n--- Service Init Check ---")
try:
    from billing.services.razorpay_service import RazorpayService
    print("✅ RazorpayService class imported")
    
    try:
        service = RazorpayService()
        print("✅ RazorpayService initialized successfully")
    except Exception as e:
        print(f"❌ RazorpayService initialization FAILED: {e}")

except Exception as e:
    print(f"❌ Check Failed: {e}")
