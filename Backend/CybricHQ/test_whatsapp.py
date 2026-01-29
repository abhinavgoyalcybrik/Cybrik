#!/usr/bin/env python
"""
WhatsApp Diagnostic Script
Tests WhatsApp configuration and connectivity
"""
import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from django.conf import settings
from crm_app.services.whatsapp_client import get_whatsapp_config, send_text_message
from crm_app.models import WhatsAppMessage, Lead
import requests

def test_configuration():
    """Test WhatsApp configuration"""
    print("\n" + "="*60)
    print("📱 WhatsApp Configuration Test")
    print("="*60)
    
    config = get_whatsapp_config()
    
    print("\n1. Configuration Status:")
    print(f"   Phone Number ID: {'✅ SET' if config['phone_number_id'] else '❌ MISSING'}")
    if config['phone_number_id']:
        print(f"      Value: {config['phone_number_id']}")
    
    print(f"   Access Token: {'✅ SET' if config['access_token'] else '❌ MISSING'}")
    if config['access_token']:
        print(f"      Length: {len(config['access_token'])} chars")
        print(f"      Preview: {config['access_token'][:20]}...")
    
    print(f"   Business Account ID: {'✅ SET' if config['business_account_id'] else '❌ MISSING'}")
    if config['business_account_id']:
        print(f"      Value: {config['business_account_id']}")
    
    verify_token = getattr(settings, 'WHATSAPP_VERIFY_TOKEN', None)
    print(f"   Verify Token: {'✅ SET' if verify_token else '❌ MISSING'}")
    if verify_token:
        print(f"      Value: {verify_token}")
    
    return bool(config['phone_number_id'] and config['access_token'])


def test_api_connection():
    """Test connection to WhatsApp API"""
    print("\n2. API Connection Test:")
    
    config = get_whatsapp_config()
    if not config['phone_number_id'] or not config['access_token']:
        print("   ⚠️  SKIPPED - Configuration incomplete")
        return False
    
    try:
        # Test API by getting phone number info
        url = f"https://graph.facebook.com/v18.0/{config['phone_number_id']}"
        headers = {
            "Authorization": f"Bearer {config['access_token']}"
        }
        
        print(f"   Testing connection to: {url}")
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ API Connection Successful")
            print(f"      Phone: {data.get('display_phone_number', 'N/A')}")
            print(f"      Quality: {data.get('quality_rating', 'N/A')}")
            return True
        else:
            print(f"   ❌ API Error: {response.status_code}")
            print(f"      Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Connection Failed: {str(e)}")
        return False


def test_webhook_url():
    """Check webhook URL configuration"""
    print("\n3. Webhook Configuration:")
    
    # Common webhook URL patterns
    webhook_url = f"{getattr(settings, 'BACKEND_URL', 'http://localhost:8000')}/api/whatsapp/webhook/"
    
    print(f"   Expected Webhook URL: {webhook_url}")
    print(f"   Verify Token: {getattr(settings, 'WHATSAPP_VERIFY_TOKEN', 'cybrik_wa_verify')}")
    print("\n   📋 Meta Configuration Steps:")
    print("   1. Go to Meta Developer Portal > WhatsApp > Configuration")
    print("   2. Add Webhook URL and Verify Token")
    print("   3. Subscribe to: messages, message_status")
    print(f"   4. Test with: GET {webhook_url}?hub.mode=subscribe&hub.verify_token={getattr(settings, 'WHATSAPP_VERIFY_TOKEN', 'cybrik_wa_verify')}&hub.challenge=test")


def check_database_messages():
    """Check recent WhatsApp messages in database"""
    print("\n4. Database Messages:")
    
    try:
        recent_messages = WhatsAppMessage.objects.all().order_by('-created_at')[:5]
        
        if recent_messages:
            print(f"   Found {WhatsAppMessage.objects.count()} total messages")
            print(f"\n   Recent 5 messages:")
            for msg in recent_messages:
                direction_icon = "📤" if msg.direction == "outbound" else "📥"
                print(f"   {direction_icon} {msg.direction.upper()} - {msg.to_phone if msg.direction == 'outbound' else msg.from_phone}")
                print(f"      Status: {msg.status} | Type: {msg.message_type}")
                print(f"      Created: {msg.created_at}")
                if msg.message_body:
                    preview = msg.message_body[:50] + "..." if len(msg.message_body) > 50 else msg.message_body
                    print(f"      Message: {preview}")
                print()
        else:
            print("   ⚠️  No messages found in database")
            
    except Exception as e:
        print(f"   ❌ Database Error: {str(e)}")


def test_send_message():
    """Test sending a message (interactive)"""
    print("\n5. Send Test Message:")
    
    config = get_whatsapp_config()
    if not config['phone_number_id'] or not config['access_token']:
        print("   ⚠️  SKIPPED - Configuration incomplete")
        return
    
    # Find a lead with phone number
    lead = Lead.objects.filter(phone__isnull=False).exclude(phone="").first()
    
    if not lead:
        print("   ⚠️  No leads with phone numbers found")
        return
    
    print(f"   Found test lead: {lead.name} ({lead.phone})")
    
    choice = input("\n   Do you want to send a test message to this lead? (yes/no): ").strip().lower()
    
    if choice == 'yes':
        test_msg = "This is a test message from Cybrik CRM WhatsApp integration."
        print(f"\n   Sending test message...")
        
        result = send_text_message(lead.phone, test_msg)
        
        if result.get('success'):
            print(f"   ✅ Message sent successfully!")
            print(f"      Message ID: {result.get('message_id')}")
        else:
            print(f"   ❌ Failed to send message")
            print(f"      Error: {result.get('error')}")
    else:
        print("   Test message sending skipped")


def main():
    print("\n" + "🔍 Starting WhatsApp Diagnostic Tests...\n")
    
    # Run all tests
    config_ok = test_configuration()
    
    if config_ok:
        api_ok = test_api_connection()
    
    test_webhook_url()
    check_database_messages()
    
    if config_ok:
        test_send_message()
    
    print("\n" + "="*60)
    print("✅ Diagnostic Complete")
    print("="*60)
    
    if not config_ok:
        print("\n⚠️  ACTION REQUIRED:")
        print("   Set environment variables in your .env file or system:")
        print("   - WHATSAPP_PHONE_NUMBER_ID")
        print("   - WHATSAPP_ACCESS_TOKEN")
        print("   - WHATSAPP_BUSINESS_ACCOUNT_ID (optional)")
        print("   - WHATSAPP_VERIFY_TOKEN (optional, defaults to 'cybrik_wa_verify')")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Test cancelled by user")
    except Exception as e:
        print(f"\n\n❌ Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
