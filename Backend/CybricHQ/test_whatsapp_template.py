#!/usr/bin/env python
"""
Test WhatsApp template message sending
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

def send_template_message(to_phone: str, template_name: str, language_code: str = "en", body_params: list = None):
    """Send a WhatsApp template message"""
    
    phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID
    access_token = settings.WHATSAPP_ACCESS_TOKEN
    
    url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    
    # Clean phone number
    clean_phone = to_phone.replace(" ", "").replace("-", "").replace("+", "")
    
    # Build template structure
    template_obj = {
        "name": template_name,
        "language": {
            "code": language_code
        }
    }
    
    # Add body parameters if provided
    if body_params:
        template_obj["components"] = [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": str(param)} for param in body_params
                ]
            }
        ]
    
    payload = {
        "messaging_product": "whatsapp",
        "to": clean_phone,
        "type": "template",
        "template": template_obj
    }
    
    print("=" * 70)
    print("📤 Sending WhatsApp Template Message")
    print("=" * 70)
    print(f"\nTemplate: {template_name}")
    print(f"Language: {language_code}")
    print(f"To: {clean_phone}")
    print(f"\nPayload:")
    print(json.dumps(payload, indent=2))
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        result = response.json()
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Body:")
        print(json.dumps(result, indent=2))
        
        if response.ok:
            message_id = result.get("messages", [{}])[0].get("id")
            print(f"\n✅ SUCCESS! Message sent!")
            print(f"   Message ID: {message_id}")
            return {"success": True, "message_id": message_id}
        else:
            error = result.get("error", {})
            print(f"\n❌ ERROR:")
            print(f"   Code: {error.get('code')}")
            print(f"   Message: {error.get('message')}")
            print(f"   Type: {error.get('type')}")
            
            if error.get('error_data'):
                print(f"   Details: {error.get('error_data')}")
            
            return {"success": False, "error": error.get('message')}
            
    except requests.RequestException as e:
        print(f"\n❌ Request failed: {str(e)}")
        return {"success": False, "error": str(e)}


def test_hello_world():
    """Test the hello_world template"""
    
    print("\n" + "🚀 Testing hello_world Template\n")
    
    # hello_world template has no parameters
    phone = "916284219729"
    
    print(f"\nTesting with phone: {phone}")
    print(f"Language code: en_US")
    print(f"Template: hello_world (no parameters)")
    print("-" * 70)
    
    result = send_template_message(
        to_phone=phone,
        template_name="hello_world",
        language_code="en_US",
        body_params=None  # No parameters for hello_world
    )
    
    if result.get("success"):
        print("\n✅ Template message sent successfully!")
        print(f"   You should receive a WhatsApp message on {phone}")
    else:
        print(f"\n❌ Failed: {result.get('error')}")
    
    print("\n" + "=" * 70)
    print("Test Complete")
    print("=" * 70)
    
    print("\n💡 Notes:")
    print("   - Template messages can be sent anytime (no 24-hour window)")
    print("   - Templates must be approved by Meta before use")
    print("   - Check template status at: business.facebook.com")


def list_templates():
    """List all available templates"""
    
    business_account_id = settings.WHATSAPP_BUSINESS_ACCOUNT_ID
    access_token = settings.WHATSAPP_ACCESS_TOKEN
    
    if not business_account_id:
        print("⚠️  WHATSAPP_BUSINESS_ACCOUNT_ID not set")
        print("   Cannot list templates without Business Account ID")
        return
    
    url = f"https://graph.facebook.com/v18.0/{business_account_id}/message_templates"
    
    params = {
        "access_token": access_token
    }
    
    print("\n" + "=" * 70)
    print("📋 Available WhatsApp Templates")
    print("=" * 70)
    
    try:
        response = requests.get(url, params=params, timeout=30)
        result = response.json()
        
        if response.ok:
            templates = result.get("data", [])
            
            if templates:
                print(f"\nFound {len(templates)} template(s):\n")
                
                for template in templates:
                    print(f"   📄 Name: {template.get('name')}")
                    print(f"      Status: {template.get('status')}")
                    print(f"      Language: {template.get('language')}")
                    print(f"      Category: {template.get('category')}")
                    print()
            else:
                print("\n⚠️  No templates found")
                print("   Create templates at: business.facebook.com")
        else:
            error = result.get("error", {})
            print(f"\n❌ Error: {error.get('message')}")
            
    except Exception as e:
        print(f"\n❌ Failed: {str(e)}")


if __name__ == "__main__":
    try:
        # List available templates first
        list_templates()
        
        # Test sending the hello_world template
        test_hello_world()
        
    except KeyboardInterrupt:
        print("\n\n❌ Test cancelled")
    except Exception as e:
        print(f"\n\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
