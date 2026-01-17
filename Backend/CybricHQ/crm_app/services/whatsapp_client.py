# crm_app/services/whatsapp_client.py
"""
Meta WhatsApp Business API client for sending messages.
Uses Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
"""
import logging
import requests
from django.conf import settings
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Meta WhatsApp Cloud API base URL
WHATSAPP_API_BASE = "https://graph.facebook.com/v18.0"


def get_whatsapp_config():
    """Get WhatsApp configuration from settings."""
    return {
        "phone_number_id": getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', None),
        "access_token": getattr(settings, 'WHATSAPP_ACCESS_TOKEN', None),
        "business_account_id": getattr(settings, 'WHATSAPP_BUSINESS_ACCOUNT_ID', None),
    }


def send_template_message(
    to_phone: str,
    template_name: str,
    language_code: str = "en",
    components: Optional[list] = None
) -> Dict[str, Any]:
    """
    Send a pre-approved template message.
    
    Args:
        to_phone: Recipient phone number with country code (e.g., "919876543210")
        template_name: Name of the approved template
        language_code: Language code (default "en")
        components: Template components with variables
        
    Returns:
        API response dict with message_id or error
    """
    config = get_whatsapp_config()
    
    if not config["phone_number_id"] or not config["access_token"]:
        logger.error("WhatsApp not configured - missing credentials")
        return {"success": False, "error": "WhatsApp not configured"}
    
    url = f"{WHATSAPP_API_BASE}/{config['phone_number_id']}/messages"
    
    headers = {
        "Authorization": f"Bearer {config['access_token']}",
        "Content-Type": "application/json",
    }
    
    # Clean phone number (remove spaces, dashes, + prefix)
    clean_phone = to_phone.replace(" ", "").replace("-", "").replace("+", "")
    
    payload = {
        "messaging_product": "whatsapp",
        "to": clean_phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
        }
    }
    
    if components:
        payload["template"]["components"] = components
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        result = response.json()
        
        if response.ok:
            message_id = result.get("messages", [{}])[0].get("id")
            logger.info(f"WhatsApp template '{template_name}' sent to {clean_phone}, message_id: {message_id}")
            return {"success": True, "message_id": message_id, "response": result}
        else:
            error = result.get("error", {})
            logger.error(f"WhatsApp send failed: {error.get('message', 'Unknown error')}")
            return {"success": False, "error": error.get("message", "Unknown error"), "response": result}
            
    except requests.RequestException as e:
        logger.exception(f"WhatsApp API request failed: {e}")
        return {"success": False, "error": str(e)}


def send_text_message(to_phone: str, message: str) -> Dict[str, Any]:
    """
    Send a free-form text message.
    NOTE: Only works within 24-hour window after user-initiated message.
    
    Args:
        to_phone: Recipient phone number with country code
        message: Text message to send
        
    Returns:
        API response dict
    """
    config = get_whatsapp_config()
    
    if not config["phone_number_id"] or not config["access_token"]:
        return {"success": False, "error": "WhatsApp not configured"}
    
    url = f"{WHATSAPP_API_BASE}/{config['phone_number_id']}/messages"
    
    headers = {
        "Authorization": f"Bearer {config['access_token']}",
        "Content-Type": "application/json",
    }
    
    clean_phone = to_phone.replace(" ", "").replace("-", "").replace("+", "")
    
    payload = {
        "messaging_product": "whatsapp",
        "to": clean_phone,
        "type": "text",
        "text": {"body": message}
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        result = response.json()
        
        if response.ok:
            message_id = result.get("messages", [{}])[0].get("id")
            logger.info(f"WhatsApp text sent to {clean_phone}, message_id: {message_id}")
            return {"success": True, "message_id": message_id}
        else:
            error = result.get("error", {})
            return {"success": False, "error": error.get("message", "Unknown error")}
            
    except requests.RequestException as e:
        logger.exception(f"WhatsApp text send failed: {e}")
        return {"success": False, "error": str(e)}


def send_welcome_message(to_phone: str, name: str) -> Dict[str, Any]:
    """
    Send welcome message after first call.
    Uses template: welcome_after_call
    """
    components = [
        {
            "type": "body",
            "parameters": [
                {"type": "text", "text": name or "there"}
            ]
        }
    ]
    
    return send_template_message(
        to_phone=to_phone,
        template_name="welcome_after_call",
        components=components
    )


def send_document_request(to_phone: str, name: str, upload_link: str) -> Dict[str, Any]:
    """
    Send document upload request with link.
    Uses template: document_upload_request
    """
    components = [
        {
            "type": "body",
            "parameters": [
                {"type": "text", "text": name or "there"},
                {"type": "text", "text": upload_link}
            ]
        }
    ]
    
    return send_template_message(
        to_phone=to_phone,
        template_name="document_upload_request",
        components=components
    )


def send_followup_reminder(to_phone: str, name: str, reminder_text: str) -> Dict[str, Any]:
    """
    Send follow-up reminder.
    Uses template: followup_reminder
    """
    components = [
        {
            "type": "body",
            "parameters": [
                {"type": "text", "text": name or "there"},
                {"type": "text", "text": reminder_text}
            ]
        }
    ]
    
    return send_template_message(
        to_phone=to_phone,
        template_name="followup_reminder",
        components=components
    )


def send_status_update(to_phone: str, name: str, status: str) -> Dict[str, Any]:
    """
    Send application status update.
    Uses template: application_status
    """
    components = [
        {
            "type": "body",
            "parameters": [
                {"type": "text", "text": name or "there"},
                {"type": "text", "text": status}
            ]
        }
    ]
    
    return send_template_message(
        to_phone=to_phone,
        template_name="application_status",
        components=components
    )


def verify_webhook(mode: str, token: str, challenge: str) -> Optional[str]:
    """
    Verify Meta webhook subscription.
    
    Args:
        mode: hub.mode from query params
        token: hub.verify_token from query params
        challenge: hub.challenge from query params
        
    Returns:
        challenge string if valid, None otherwise
    """
    verify_token = getattr(settings, 'WHATSAPP_VERIFY_TOKEN', 'cybrik_wa_verify')
    
    if mode == "subscribe" and token == verify_token:
        logger.info("WhatsApp webhook verified successfully")
        return challenge
    
    logger.warning(f"WhatsApp webhook verification failed - mode: {mode}, token mismatch")
    return None


def parse_webhook_message(payload: dict) -> Optional[Dict[str, Any]]:
    """
    Parse incoming WhatsApp webhook message.
    
    Returns:
        Dict with from_phone, message_id, message_text, timestamp, etc.
    """
    try:
        entry = payload.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        
        # Check for incoming messages
        messages = value.get("messages", [])
        if messages:
            msg = messages[0]
            return {
                "type": "message",
                "from_phone": msg.get("from"),
                "message_id": msg.get("id"),
                "timestamp": msg.get("timestamp"),
                "message_type": msg.get("type"),
                "text": msg.get("text", {}).get("body") if msg.get("type") == "text" else None,
                "contacts": value.get("contacts", []),
            }
        
        # Check for status updates
        statuses = value.get("statuses", [])
        if statuses:
            status = statuses[0]
            return {
                "type": "status",
                "message_id": status.get("id"),
                "status": status.get("status"),  # sent, delivered, read, failed
                "timestamp": status.get("timestamp"),
                "recipient_id": status.get("recipient_id"),
                "errors": status.get("errors", []),
            }
        
        return None
        
    except Exception as e:
        logger.exception(f"Error parsing WhatsApp webhook: {e}")
        return None
