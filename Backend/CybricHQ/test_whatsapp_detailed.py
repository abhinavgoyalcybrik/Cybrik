#!/usr/bin/env python
"""
Detailed WhatsApp API test with raw request/response logging
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

def test_whatsapp_send():
    """Test WhatsApp message sending with detailed logging"""
    
    phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID
    access_token = settings.WHATSAPP_ACCESS_TOKEN
    
    print("=" * 70)
    print("📱 WhatsApp Message Send Test")
    print("=" * 70)
    
    print(f"\n1. Configuration:")
    print(f"   Phone Number ID: {phone_number_id}")
    print(f"   Token length: {len(access_token)} chars")
    print(f"   Token preview: {access_token[:20]}...")
    
    # Test with different phone number formats
    test_numbers = [
        "918065252687",      # India format without +
        "+918065252687",     # India format with +
        "8065252687",        # Without country code
    ]
    
    url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    
    print(f"\n2. API Endpoint:")
    print(f"   URL: {url}")
    print(f"   Headers: {json.dumps({k: v[:30] + '...' if len(v) > 30 else v for k, v in headers.items()}, indent=6)}")
    
    for test_phone in test_numbers:
        print(f"\n3. Testing with phone: {test_phone}")
        print(f"   " + "-" * 60)
        
        payload = {
            "messaging_product": "whatsapp",
            "to": test_phone,
            "type": "text",
            "text": {
                "body": "Test message from Cybrik CRM - Testing connectivity"
            }
        }
        
        print(f"   Payload:")
        print(f"   {json.dumps(payload, indent=6)}")
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            
            print(f"\n   Response Status: {response.status_code}")
            print(f"   Response Headers: {dict(response.headers)}")
            print(f"   Response Body:")
            
            try:
                result = response.json()
                print(f"   {json.dumps(result, indent=6)}")
                
                if response.ok:
                    message_id = result.get("messages", [{}])[0].get("id")
                    print(f"\n   ✅ SUCCESS! Message ID: {message_id}")
                    return True
                else:
                    error = result.get("error", {})
                    print(f"\n   ❌ ERROR:")
                    print(f"      Code: {error.get('code')}")
                    print(f"      Message: {error.get('message')}")
                    print(f"      Type: {error.get('type')}")
                    print(f"      Subcode: {error.get('error_subcode')}")
                    print(f"      Details: {error.get('error_user_title')} - {error.get('error_user_msg')}")
                    
            except json.JSONDecodeError:
                print(f"   {response.text}")
                
        except requests.RequestException as e:
            print(f"   ❌ Request failed: {str(e)}")
        
        print(f"   " + "-" * 60)
    
    return False

def check_account_status():
    """Check WhatsApp Business Account status"""
    
    phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID
    access_token = settings.WHATSAPP_ACCESS_TOKEN
    
    print("\n" + "=" * 70)
    print("🏢 WhatsApp Business Account Status")
    print("=" * 70)
    
    # Get phone number info
    url = f"https://graph.facebook.com/v18.0/{phone_number_id}"
    params = {
        "access_token": access_token,
        "fields": "verified_name,display_phone_number,quality_rating,account_mode,is_official_business_account"
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        result = response.json()
        
        print(f"\nPhone Number Details:")
        print(f"   {json.dumps(result, indent=3)}")
        
        if "account_mode" in result:
            mode = result["account_mode"]
            print(f"\n📊 Account Mode: {mode}")
            if mode == "SANDBOX":
                print(f"   ⚠️  WARNING: Account is in SANDBOX mode")
                print(f"      - Can only send messages to verified test numbers")
                print(f"      - Need to complete business verification for production")
            elif mode == "LIVE":
                print(f"   ✅ Account is LIVE - can send to any number")
        
        if "quality_rating" in result:
            print(f"\n⭐ Quality Rating: {result['quality_rating']}")
            
    except Exception as e:
        print(f"❌ Failed to check account status: {e}")

def main():
    print("\n" + "🚀 WhatsApp Detailed Diagnostic\n")
    
    check_account_status()
    test_whatsapp_send()
    
    print("\n" + "=" * 70)
    print("✅ Test Complete")
    print("=" * 70)
    
    print("\n💡 Troubleshooting:")
    print("   1. If account is in SANDBOX mode:")
    print("      - Complete business verification at business.facebook.com")
    print("      - Add payment method")
    print("      - Wait 24-48 hours for approval")
    print("\n   2. If getting 'Invalid parameter' errors:")
    print("      - Check phone number format (use country code without +)")
    print("      - Ensure 24-hour message window is active")
    print("      - Verify account is not restricted")
    print("\n   3. Check Meta Business Manager:")
    print("      https://business.facebook.com/settings/whatsapp-business-accounts")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Test cancelled")
    except Exception as e:
        print(f"\n\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
