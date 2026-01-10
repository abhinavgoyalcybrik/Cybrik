# crm_app/services/sms_service.py
"""
SMS OTP Service for document upload portal.
Pluggable provider - configure via settings.

Supported providers:
- mock (console logging for development)
- msg91 (Indian SMS provider)
- twilio (International)
"""
import random
import logging
import hashlib
from datetime import timedelta
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def generate_otp(length=6) -> str:
    """Generate a random numeric OTP"""
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])


def hash_otp(otp: str) -> str:
    """Hash OTP for secure storage"""
    return hashlib.sha256(otp.encode()).hexdigest()


def verify_otp_hash(otp: str, hashed: str) -> bool:
    """Verify OTP against stored hash"""
    return hash_otp(otp) == hashed


class SMSProvider:
    """Base SMS provider interface"""
    
    def send(self, phone: str, message: str) -> dict:
        raise NotImplementedError


class MockSMSProvider(SMSProvider):
    """Mock provider for development - logs to console"""
    
    def send(self, phone: str, message: str) -> dict:
        logger.info(f"[MOCK SMS] To: {phone} | Message: {message}")
        print(f"\n📱 SMS to {phone}: {message}\n")
        return {"success": True, "provider": "mock", "message_id": "mock-123"}


class MSG91Provider(SMSProvider):
    """MSG91 provider for production (Indian SMS)"""
    
    def __init__(self):
        self.api_key = getattr(settings, 'MSG91_API_KEY', None)
        self.sender_id = getattr(settings, 'MSG91_SENDER_ID', 'CYBRIC')
        self.template_id = getattr(settings, 'MSG91_OTP_TEMPLATE_ID', None)
    
    def send(self, phone: str, message: str) -> dict:
        if not self.api_key:
            logger.error("MSG91_API_KEY not configured")
            return {"success": False, "error": "MSG91 not configured"}
        
        import requests
        
        # MSG91 Flow API endpoint
        url = "https://control.msg91.com/api/v5/flow/"
        
        headers = {
            "authkey": self.api_key,
            "Content-Type": "application/json"
        }
        
        # Extract OTP from message for template
        # Template should have {{otp}} placeholder
        otp = ''.join(filter(str.isdigit, message))[:6]
        
        payload = {
            "flow_id": self.template_id,
            "sender": self.sender_id,
            "mobiles": phone.replace("+", ""),
            "otp": otp
        }
        
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.ok:
                return {"success": True, "provider": "msg91", "response": resp.json()}
            else:
                logger.error(f"MSG91 error: {resp.status_code} - {resp.text}")
                return {"success": False, "error": resp.text}
        except Exception as e:
            logger.exception(f"MSG91 request failed: {e}")
            return {"success": False, "error": str(e)}


class TwilioProvider(SMSProvider):
    """Twilio provider for international SMS"""
    
    def __init__(self):
        self.account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', None)
        self.auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', None)
        self.from_number = getattr(settings, 'TWILIO_PHONE_NUMBER', None)
    
    def send(self, phone: str, message: str) -> dict:
        if not all([self.account_sid, self.auth_token, self.from_number]):
            logger.error("Twilio credentials not configured")
            return {"success": False, "error": "Twilio not configured"}
        
        try:
            from twilio.rest import Client
            client = Client(self.account_sid, self.auth_token)
            
            msg = client.messages.create(
                body=message,
                from_=self.from_number,
                to=phone
            )
            return {"success": True, "provider": "twilio", "message_sid": msg.sid}
        except Exception as e:
            logger.exception(f"Twilio send failed: {e}")
            return {"success": False, "error": str(e)}


def get_sms_provider() -> SMSProvider:
    """Get configured SMS provider"""
    provider_name = getattr(settings, 'SMS_PROVIDER', 'mock')
    
    providers = {
        'mock': MockSMSProvider,
        'msg91': MSG91Provider,
        'twilio': TwilioProvider,
    }
    
    provider_class = providers.get(provider_name, MockSMSProvider)
    return provider_class()


def send_otp_sms(phone: str, otp: str) -> dict:
    """
    Send OTP to phone number.
    
    Args:
        phone: Phone number with country code (e.g., +919876543210)
        otp: The OTP code to send
        
    Returns:
        dict with success status and provider response
    """
    message = f"Your CybricHQ verification code is: {otp}. Valid for 10 minutes. Do not share."
    
    provider = get_sms_provider()
    result = provider.send(phone, message)
    
    logger.info(f"OTP SMS sent to {phone[-4:]}: {'success' if result.get('success') else 'failed'}")
    return result


def send_upload_link_sms(phone: str, link: str, name: str = "") -> dict:
    """
    Send document upload link to lead.
    
    Args:
        phone: Phone number
        link: Upload portal URL
        name: Lead's name (optional)
    """
    greeting = f"Hi {name}," if name else "Hi,"
    message = f"{greeting} Please upload your documents using this link: {link}"
    
    provider = get_sms_provider()
    return provider.send(phone, message)
