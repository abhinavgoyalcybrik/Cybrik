import os
import django
import sys
import traceback

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from crm_app import views_public
from crm_app.views_public import PublicUploadView
from django.conf import settings

print(f"DEBUG: SECRET_KEY (start): {settings.SECRET_KEY[:5]}...")
print(f"DEBUG: UPLOAD_TOKEN_SALT: {getattr(views_public, 'UPLOAD_TOKEN_SALT', 'NOT FOUND')}")

# Token from your error log
token = "84:1vggTX:kgGbpwCSzO1AwGhMlo-8ugjxZB-f5IzybJ9A2oww0Eg"
print(f"Testing token: {token}")

view = PublicUploadView()

try:
    print("Calling _validate_token...")
    lead_id, error_response = view._validate_token(token)
    
    if lead_id:
        print(f"SUCCESS! Lead ID: {lead_id}")
    elif error_response:
        print("VALIDATION ERROR (Handled):")
        # Check if response has rendered content or data
        if hasattr(error_response, 'data'):
            print(f"Response Data: {error_response.data}")
        else:
            print(f"Response: {error_response}")
    else:
        print("Unknown state: both None?")
        
except Exception:
    print("CRASHED during _validate_token!")
    traceback.print_exc()

print("Done.")
