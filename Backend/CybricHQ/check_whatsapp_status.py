#!/usr/bin/env python
"""
Check WhatsApp phone number registration and account status
"""
import os
import sys
import django
import requests
import json

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from django.conf import settings

def check_phone_registration(phone: str):
    """Check if a phone number is registered on WhatsApp"""
    
    phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID
    access_token = settings.WHATSAPP_ACCESS_TOKEN
    
    # Clean phone number
    clean_phone = phone.replace(" ", "").replace("-", "").replace("+", "")
    
    # Check via messages endpoint (will tell us if number is valid)
    url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    
    # Try to send hello_world template
    payload = {
        "messaging_product": "whatsapp",
        "to": clean_phone,
        "type": "template",
        "template": {
            "name": "hello_world",
            "language": {
                "code": "en_US"
            }
        }
    }
    
    print("=" * 70)
    print(f"📱 Checking WhatsApp Registration: {clean_phone}")
    print("=" * 70)
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        result = response.json()
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response:")
        print(json.dumps(result, indent=2))
        
        if response.ok:
            wa_id = result.get("contacts", [{}])[0].get("wa_id")
            message_status = result.get("messages", [{}])[0].get("message_status")
            
            print(f"\n✅ Phone is registered on WhatsApp!")
            print(f"   WhatsApp ID: {wa_id}")
            print(f"   Message Status: {message_status}")
            
            if message_status == "accepted":
                print(f"\n⏳ Message accepted by WhatsApp")
                print(f"   Check your WhatsApp on {clean_phone}")
                print(f"   Note: Message might take a few seconds to deliver")
            
            return True
        else:
            error = result.get("error", {})
            error_code = error.get("code")
            error_msg = error.get("message")
            
            print(f"\n❌ Failed to send message")
            print(f"   Error Code: {error_code}")
            print(f"   Error: {error_msg}")
            
            # Check for specific error codes
            if error_code == 131026:
                print(f"\n⚠️  This phone number is NOT registered on WhatsApp!")
            elif error_code == 131047:
                print(f"\n⚠️  This phone number has opted out or blocked messages!")
            elif error_code == 131051:
                print(f"\n⚠️  Message delivery failed - number might be invalid!")
            
            return False
            
    except Exception as e:
        print(f"\n❌ Request failed: {str(e)}")
        return False


def check_business_account():
    """Check WhatsApp Business Account details"""
    
    phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID
    access_token = settings.WHATSAPP_ACCESS_TOKEN
    
    url = f"https://graph.facebook.com/v18.0/{phone_number_id}"
    
    params = {
        "access_token": access_token,
        "fields": "verified_name,display_phone_number,quality_rating,account_mode,id"
    }
    
    print("\n" + "=" * 70)
    print("🏢 WhatsApp Business Account Status")
    print("=" * 70)
    
    try:
        response = requests.get(url, params=params, timeout=30)
        result = response.json()
        
        if response.ok:
            print(f"\n✅ Account Active")
            print(f"   Business Name: {result.get('verified_name')}")
            print(f"   Phone Number: {result.get('display_phone_number')}")
            print(f"   Quality Rating: {result.get('quality_rating')}")
            print(f"   Account Mode: {result.get('account_mode')}")
            print(f"   Phone Number ID: {result.get('id')}")
        else:
            print(f"\n❌ Error: {result.get('error', {}).get('message')}")
            
    except Exception as e:
        print(f"\n❌ Failed: {str(e)}")


if __name__ == "__main__":
    # Check business account
    check_business_account()
    
    print("\n")
    
    # Test numbers to check
    test_numbers = [
        "916284219729",   # User's number
        "918065252687",   # Business number
    ]
    
    for phone in test_numbers:
        check_phone_registration(phone)
        print("\n")
