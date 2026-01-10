import os
import sys
import django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from crm_app.smartflo_api import get_smartflo_credentials
from django.conf import settings

print("\n--- KEY SELECTION DEBUG ---")
voicebot_key = getattr(settings, 'SMARTFLO_VOICEBOT_API_KEY', '')
regular_key = getattr(settings, 'SMARTFLO_API_KEY', '')

print(f"SMARTFLO_VOICEBOT_API_KEY in settings: '{voicebot_key[:4]}...{voicebot_key[-4:]}'" if voicebot_key else "SMARTFLO_VOICEBOT_API_KEY: (empty)")
print(f"SMARTFLO_API_KEY in settings:          '{regular_key[:4]}...{regular_key[-4:]}'" if regular_key else "SMARTFLO_API_KEY: (empty)")

selected_key, _, _ = get_smartflo_credentials()
print(f"\nACTUAL KEY BEING USED: '{selected_key[:4]}...{selected_key[-4:]}'")

if voicebot_key and regular_key and selected_key == voicebot_key:
    print("\n>>> WARNING: Code is prioritizing the VOICEBOT key. If this is the old one, update it!")
print("---------------------------\n")
