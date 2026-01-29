#!/usr/bin/env python
"""
Check WhatsApp Business API account status and billing
"""
import os
import sys
import django
import requests

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from django.conf import settings

def check_whatsapp_account():
    """Check WhatsApp account status and billing"""
    print("="*60)
    print("🔍 WhatsApp Account & Billing Check")
    print("="*60)

    config = {
        'phone_number_id': getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', None),
        'access_token': getattr(settings, 'WHATSAPP_ACCESS_TOKEN', None),
    }

    if not config['phone_number_id'] or not config['access_token']:
        print("❌ WhatsApp not configured")
        return

    headers = {'Authorization': f'Bearer {config["access_token"]}'}

    # Check phone number status
    print("\n1. Phone Number Status:")
    url = f'https://graph.facebook.com/v18.0/{config["phone_number_id"]}'
    response = requests.get(url, headers=headers, timeout=10)

    print(f"   Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Display Phone: {data.get('display_phone_number', 'N/A')}")
        print(f"   Quality Rating: {data.get('quality_rating', 'N/A')}")
        print(f"   Account Mode: {data.get('account_mode', 'N/A')}")
        print(f"   Certificate: {'✅ Valid' if data.get('certificate') else '❌ Invalid/Missing'}")
        print(f"   Verified: {'✅ Yes' if data.get('verified') else '❌ No'}")
    else:
        print(f"   ❌ Error: {response.json()}")

    # Check balance (if accessible)
    print("\n2. Balance Check:")
    try:
        balance_url = f'https://graph.facebook.com/v18.0/{config["phone_number_id"]}/balance'
        balance_response = requests.get(balance_url, headers=headers, timeout=10)

        print(f"   Status Code: {balance_response.status_code}")
        if balance_response.status_code == 200:
            balance_data = balance_response.json()
            print(f"   ✅ Balance Info: {balance_data}")
        else:
            print(f"   ⚠️  Balance check failed: {balance_response.json()}")
            print("   💡 This is normal - balance info may not be accessible with all token types")
    except Exception as e:
        print(f"   ⚠️  Balance check error: {e}")

    # Check business account info
    print("\n3. Business Account Info:")
    try:
        # Try to get business account info
        account_url = f'https://graph.facebook.com/v18.0/{config["phone_number_id"]}?fields=account_mode,business_account'
        account_response = requests.get(account_url, headers=headers, timeout=10)

        print(f"   Status Code: {account_response.status_code}")
        if account_response.status_code == 200:
            account_data = account_response.json()
            print(f"   Account Mode: {account_data.get('account_mode', 'N/A')}")
            business_info = account_data.get('business_account', {})
            print(f"   Business ID: {business_info.get('id', 'N/A')}")
        else:
            print(f"   ⚠️  Account info failed: {account_response.json()}")
    except Exception as e:
        print(f"   ⚠️  Account check error: {e}")

    print("\n" + "="*60)
    print("💡 TROUBLESHOOTING TIPS:")
    print("="*60)
    print("1. Go to Meta Business Manager: https://business.facebook.com")
    print("2. Check your WhatsApp account billing/payment methods")
    print("3. Ensure you have sufficient balance for message delivery")
    print("4. Verify your business verification status")
    print("5. Check if your payment method is active/valid")
    print("\n6. For testing, try sending to a number that recently messaged you")
    print("7. Template messages require Meta approval before use")

if __name__ == "__main__":
    check_whatsapp_account()