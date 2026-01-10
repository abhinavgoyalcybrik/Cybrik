# crm_app/services/whatsapp_service.py
"""
WhatsApp Cloud API Integration with AI Chatbot.
Handles sending messages, receiving webhooks, and AI auto-replies.
"""
import os
import json
import logging
import requests
from typing import Optional, Dict, Any
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class WhatsAppClient:
    """WhatsApp Cloud API Client"""
    
    def __init__(self):
        self.access_token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', os.getenv('WHATSAPP_ACCESS_TOKEN'))
        self.phone_number_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', os.getenv('WHATSAPP_PHONE_NUMBER_ID'))
        self.api_url = "https://graph.facebook.com/v18.0"
        self.is_configured = bool(self.access_token and self.phone_number_id)
    
    def _format_phone(self, phone: str) -> str:
        """Format phone to WhatsApp format (no + prefix, no spaces)"""
        return phone.replace('+', '').replace(' ', '').replace('-', '')
    
    def send_text(self, to: str, text: str) -> Dict[str, Any]:
        """
        Send a text message via WhatsApp.
        
        Args:
            to: Phone number with country code (e.g., +919876543210)
            text: Message text
        
        Returns:
            dict with success status and message_id
        """
        if not self.is_configured:
            # Mock mode for development
            logger.info(f"[MOCK WHATSAPP] To: {to} | Message: {text}")
            print(f"\n💬 WhatsApp to {to}: {text}\n")
            return {"success": True, "mock": True, "message_id": f"mock_{timezone.now().timestamp()}"}
        
        url = f"{self.api_url}/{self.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": self._format_phone(to),
            "type": "text",
            "text": {"body": text}
        }
        
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            data = resp.json()
            
            if resp.ok and "messages" in data:
                message_id = data["messages"][0].get("id")
                logger.info(f"WhatsApp sent to {to}: {message_id}")
                return {"success": True, "message_id": message_id, "response": data}
            else:
                error = data.get("error", {}).get("message", "Unknown error")
                logger.error(f"WhatsApp send failed: {error}")
                return {"success": False, "error": error, "response": data}
                
        except Exception as e:
            logger.exception(f"WhatsApp API error: {e}")
            return {"success": False, "error": str(e)}
    
    def send_template(self, to: str, template_name: str, language: str = "en", 
                      params: Optional[list] = None) -> Dict[str, Any]:
        """
        Send a template message (for business-initiated conversations).
        
        Args:
            to: Phone number
            template_name: Approved template name
            language: Template language code
            params: List of parameter values for template placeholders
        """
        if not self.is_configured:
            logger.info(f"[MOCK WHATSAPP TEMPLATE] To: {to} | Template: {template_name}")
            return {"success": True, "mock": True}
        
        url = f"{self.api_url}/{self.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        template = {
            "name": template_name,
            "language": {"code": language}
        }
        
        if params:
            template["components"] = [{
                "type": "body",
                "parameters": [{"type": "text", "text": p} for p in params]
            }]
        
        payload = {
            "messaging_product": "whatsapp",
            "to": self._format_phone(to),
            "type": "template",
            "template": template
        }
        
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            data = resp.json()
            
            if resp.ok:
                return {"success": True, "response": data}
            else:
                return {"success": False, "error": data.get("error", {}).get("message")}
        except Exception as e:
            return {"success": False, "error": str(e)}


class WhatsAppAIChatbot:
    """AI Chatbot for WhatsApp conversations."""
    
    def __init__(self):
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
    
    def generate_response(self, message: str, lead_context: Optional[Dict] = None) -> str:
        """
        Generate AI response for incoming WhatsApp message.
        
        Args:
            message: User's incoming message
            lead_context: Optional context about the lead (name, interests, etc.)
        """
        if not self.openai_api_key:
            # Fallback responses when OpenAI not configured
            return self._fallback_response(message)
        
        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.openai_api_key)
            
            # Build context
            context = ""
            if lead_context:
                name = lead_context.get('name', '')
                country = lead_context.get('country', '')
                service = lead_context.get('interested_service', '')
                context = f"\nLead: {name}, Interested in: {service}, Country: {country}"
            
            system_prompt = f"""You are Jess, a friendly education counselor at CybricHQ.
You help students interested in studying abroad with questions about:
- Fees and costs for different countries/programs
- Admission requirements and eligibility
- Visa processes
- IELTS/PTE requirements
- Available courses and universities

Be conversational, helpful, and brief (1-3 sentences max).
If asked something you don't know, offer to connect them with a human counselor.
{context}"""
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                max_tokens=150,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"AI response generation failed: {e}")
            return self._fallback_response(message)
    
    def _fallback_response(self, message: str) -> str:
        """Fallback responses when AI is not available."""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['fee', 'cost', 'price', 'charge']):
            return "Thanks for asking about fees! Our counselor will share detailed fee structures shortly. Can I help with anything else?"
        
        if any(word in message_lower for word in ['ielts', 'pte', 'english', 'test']):
            return "For most countries, you'll need IELTS 6.0+ or PTE 50+. We also offer IELTS preparation courses. Would you like more details?"
        
        if any(word in message_lower for word in ['visa', 'document']):
            return "We provide complete visa assistance including document preparation. A counselor will guide you through the entire process."
        
        if any(word in message_lower for word in ['hi', 'hello', 'hey']):
            return "Hello! 👋 I'm Jess from CybricHQ. How can I help you with your study abroad plans today?"
        
        return "Thanks for your message! A counselor will get back to you shortly. Is there anything specific I can help with?"


def send_whatsapp_message(to: str, text: str, lead_id: Optional[int] = None, 
                          is_ai: bool = False) -> Dict[str, Any]:
    """
    Send WhatsApp message and record in database.
    
    Args:
        to: Phone number
        text: Message text
        lead_id: Optional lead ID to link message
        is_ai: Whether this is an AI-generated response
    """
    from crm_app.models import OutboundMessage, Lead
    
    client = WhatsAppClient()
    result = client.send_text(to, text)
    
    # Record in database
    lead = None
    if lead_id:
        lead = Lead.objects.filter(id=lead_id).first()
    
    message = OutboundMessage.objects.create(
        lead=lead,
        channel='whatsapp',
        direction='outbound',
        provider='whatsapp_cloud',
        to_number=to,
        body=text,
        status='sent' if result.get('success') else 'failed',
        external_id=result.get('message_id'),
        is_from_ai=is_ai,
        error_message=result.get('error') if not result.get('success') else None,
        sent_at=timezone.now() if result.get('success') else None,
        data=result
    )
    
    return {
        **result,
        "message_db_id": message.id
    }


def process_incoming_webhook(payload: Dict) -> Optional[Dict]:
    """
    Process incoming WhatsApp webhook from Meta.
    Handles text messages and media attachments (documents, images).
    
    Args:
        payload: Webhook payload from Meta
        
    Returns:
        Dict with message info if valid message, None otherwise
    """
    from crm_app.models import OutboundMessage, Lead, Applicant, Document
    
    try:
        entry = payload.get('entry', [{}])[0]
        changes = entry.get('changes', [{}])[0]
        value = changes.get('value', {})
        messages = value.get('messages', [])
        
        if not messages:
            return None
        
        msg = messages[0]
        from_number = msg.get('from')
        message_id = msg.get('id')
        message_type = msg.get('type', 'text')
        
        if not from_number:
            return None
        
        # Find lead and applicant by phone
        lead = Lead.objects.filter(phone__icontains=from_number[-10:]).first()
        applicant = Applicant.objects.filter(phone__icontains=from_number[-10:]).first()
        
        # If no applicant, check if lead has linked applicant
        if not applicant and lead:
            applicant = lead.applicants.first()
        
        # Handle media attachments (document, image, video, audio)
        media_info = None
        if message_type in ['document', 'image', 'video', 'audio']:
            media_data = msg.get(message_type, {})
            media_id = media_data.get('id')
            filename = media_data.get('filename', f'{message_type}_{message_id}')
            mime_type = media_data.get('mime_type', 'application/octet-stream')
            caption = media_data.get('caption', '')
            
            if media_id:
                # Download and save the file
                saved_doc = download_and_save_media(
                    media_id=media_id,
                    filename=filename,
                    mime_type=mime_type,
                    applicant=applicant,
                    lead=lead,
                    from_number=from_number,
                    caption=caption
                )
                
                if saved_doc:
                    media_info = {
                        'document_id': saved_doc.id,
                        'filename': filename,
                        'type': message_type
                    }
                    logger.info(f"Saved WhatsApp document {saved_doc.id} from {from_number}")
        
        # Get text content (could be caption or text message)
        text = ''
        if message_type == 'text':
            text = msg.get('text', {}).get('body', '')
        elif message_type in ['document', 'image', 'video']:
            text = msg.get(message_type, {}).get('caption', '')
        
        # Record incoming message
        incoming = OutboundMessage.objects.create(
            lead=lead,
            applicant=applicant,
            channel='whatsapp',
            direction='inbound',
            provider='whatsapp_cloud',
            from_number=from_number,
            body=text or f"[{message_type.upper()}]",
            status='delivered',
            external_id=message_id,
            data={'media': media_info} if media_info else None,
            created_at=timezone.now()
        )
        
        # Generate and send AI response (only for text messages or captions)
        ai_response = None
        ai_sent = False
        
        if text:
            chatbot = WhatsAppAIChatbot()
            lead_context = None
            if lead:
                lead_context = {
                    'name': lead.name,
                    'country': lead.country,
                    'interested_service': lead.interested_service
                }
            elif applicant:
                lead_context = {
                    'name': f"{applicant.first_name} {applicant.last_name or ''}".strip()
                }
            
            ai_response = chatbot.generate_response(text, lead_context)
            
            # Send AI response
            send_result = send_whatsapp_message(
                to=from_number,
                text=ai_response,
                lead_id=lead.id if lead else None,
                is_ai=True
            )
            ai_sent = send_result.get('success', False)
        elif media_info:
            # Acknowledge document receipt
            ack_message = "Thank you for sending your document! 📄 We've received it and it's now linked to your application."
            if applicant:
                ack_message += f"\n\n📋 Reference: APP-{applicant.id}"
            
            send_result = send_whatsapp_message(
                to=from_number,
                text=ack_message,
                lead_id=lead.id if lead else None,
                is_ai=True
            )
            ai_response = ack_message
            ai_sent = send_result.get('success', False)
        
        return {
            "incoming_message_id": incoming.id,
            "from": from_number,
            "text": text,
            "message_type": message_type,
            "lead_id": lead.id if lead else None,
            "applicant_id": applicant.id if applicant else None,
            "media_info": media_info,
            "ai_response": ai_response,
            "ai_response_sent": ai_sent
        }
        
    except Exception as e:
        logger.exception(f"Error processing WhatsApp webhook: {e}")
        return None


def download_and_save_media(
    media_id: str,
    filename: str,
    mime_type: str,
    applicant=None,
    lead=None,
    from_number: str = '',
    caption: str = ''
) -> Optional['Document']:
    """
    Download media from Meta's CDN and save as Document.
    
    Args:
        media_id: Meta's media ID
        filename: Original filename
        mime_type: MIME type of the file
        applicant: Optional Applicant to link to
        lead: Optional Lead to link to
        from_number: Sender's phone number
        caption: Optional caption/description
    
    Returns:
        Document instance if saved successfully, None otherwise
    """
    from crm_app.models import Document, Applicant
    from django.core.files.base import ContentFile
    import os
    
    client = WhatsAppClient()
    
    if not client.is_configured:
        logger.warning("WhatsApp not configured, cannot download media")
        return None
    
    try:
        # Step 1: Get media URL from Meta
        media_url_endpoint = f"{client.api_url}/{media_id}"
        headers = {"Authorization": f"Bearer {client.access_token}"}
        
        resp = requests.get(media_url_endpoint, headers=headers, timeout=10)
        if not resp.ok:
            logger.error(f"Failed to get media URL: {resp.text}")
            return None
        
        media_url = resp.json().get('url')
        if not media_url:
            logger.error("No URL in media response")
            return None
        
        # Step 2: Download the file
        file_resp = requests.get(media_url, headers=headers, timeout=30)
        if not file_resp.ok:
            logger.error(f"Failed to download media: {file_resp.status_code}")
            return None
        
        file_content = file_resp.content
        
        # Step 3: Create applicant if none exists
        if not applicant and from_number:
            # Try to find or create applicant
            applicant = Applicant.objects.filter(phone__icontains=from_number[-10:]).first()
            
            if not applicant and lead:
                applicant = lead.applicants.first()
            
            if not applicant:
                # Create placeholder applicant
                applicant = Applicant.objects.create(
                    first_name="WhatsApp User",
                    phone=from_number,
                    stage="new",
                    counseling_notes=f"Created from WhatsApp document upload. Phone: {from_number}"
                )
                logger.info(f"Created placeholder applicant {applicant.id} for {from_number}")
        
        # Step 4: Determine document type from mime type
        doc_type = 'other'
        if 'image' in mime_type:
            doc_type = 'other'
        elif 'pdf' in mime_type:
            doc_type = 'other'
        
        # Add extension if missing
        if '.' not in filename:
            ext_map = {
                'image/jpeg': '.jpg',
                'image/png': '.png',
                'image/webp': '.webp',
                'application/pdf': '.pdf',
                'application/msword': '.doc',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            }
            filename += ext_map.get(mime_type, '.bin')
        
        # Step 5: Save document
        document = Document(
            applicant=applicant,
            document_type=doc_type,
            status='pending',
            notes=f"Received via WhatsApp from {from_number}. {caption}".strip()
        )
        
        # Save file
        document.file.save(filename, ContentFile(file_content), save=True)
        
        logger.info(f"Saved WhatsApp document: {document.id} ({filename}) for applicant {applicant.id if applicant else 'unknown'}")
        
        return document
        
    except Exception as e:
        logger.exception(f"Error downloading/saving WhatsApp media: {e}")
        return None
