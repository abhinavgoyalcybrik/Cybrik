# crm_app/services/post_call_messaging.py
"""
Post-call messaging service.
Sends WhatsApp messages after AI calls end using customizable templates.
"""
import logging
from typing import Optional, Dict, Any
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def get_applicant_context(call_record) -> Dict[str, Any]:
    """
    Build context dictionary from a call record for template rendering.
    """
    context = {
        'name': '',
        'first_name': '',
        'phone': '',
        'application_id': '',
        'upload_link': '',
        'call_date': timezone.now().strftime('%B %d, %Y'),
    }
    
    # Get applicant info
    applicant = call_record.applicant
    if applicant:
        context['name'] = f"{applicant.first_name} {applicant.last_name or ''}".strip()
        context['first_name'] = applicant.first_name
        context['phone'] = applicant.phone or ''
        
        # Get application ID if available
        application = applicant.applications.first()
        if application:
            context['application_id'] = f"APP-{application.id}"
    
    # Try lead if no applicant
    if not applicant and call_record.lead:
        lead = call_record.lead
        context['name'] = lead.name or ''
        context['first_name'] = (lead.name or '').split()[0] if lead.name else ''
        context['phone'] = lead.phone or ''
    
    # Get phone from metadata if still not found
    if not context['phone'] and call_record.metadata:
        metadata = call_record.metadata
        context['phone'] = (
            metadata.get('phone') or 
            metadata.get('phone_number') or 
            metadata.get('to') or 
            metadata.get('customer_phone') or
            ''
        )
    
    # Generate upload link if we have an ID
    base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5000')
    if applicant:
        context['upload_link'] = f"{base_url}/upload-documents?applicant={applicant.id}"
    elif call_record.lead:
        context['upload_link'] = f"{base_url}/upload-documents?lead={call_record.lead.id}"
    
    # Call date from call record
    if call_record.created_at:
        context['call_date'] = call_record.created_at.strftime('%B %d, %Y')
    
    return context


def send_postcall_whatsapp(call_record, template_trigger: str = 'post_call') -> Dict[str, Any]:
    """
    Send a post-call WhatsApp message using Meta's approved template.
    
    Args:
        call_record: CallRecord instance
        template_trigger: Which template trigger to use (default: 'post_call')
    
    Returns:
        Dict with success status and message details
    """
    from ..services.whatsapp_service import WhatsAppClient
    
    result = {
        'success': False,
        'error': None,
        'message_id': None,
        'phone': None,
    }
    
    try:
        # Build context
        context = get_applicant_context(call_record)
        
        # Check if we have a phone number
        if not context['phone']:
            result['error'] = 'No phone number found for post-call message'
            logger.warning(result['error'])
            return result
        
        result['phone'] = context['phone']
        
        # Use Meta's approved template: post_call_followup
        # Variables: {{1}} = name, {{2}} = application_id, {{3}} = upload_link
        client = WhatsAppClient()
        
        template_params = [
            context.get('name') or 'there',  # {{1}} - name
            context.get('application_id') or 'N/A',  # {{2}} - reference number
            context.get('upload_link') or 'https://cybrichq.com/upload',  # {{3}} - upload link
        ]
        
        send_result = client.send_template(
            to=context['phone'],
            template_name='post_call_followup',
            language='en',
            params=template_params
        )
        
        if send_result.get('success'):
            result['success'] = True
            result['message_id'] = send_result.get('response', {}).get('messages', [{}])[0].get('id')
            logger.info(
                "Sent post-call WhatsApp template to %s (call_record=%s)",
                context['phone'], call_record.id
            )
        else:
            result['error'] = send_result.get('error', 'Unknown error sending WhatsApp template')
            logger.error("Failed to send post-call WhatsApp: %s", result['error'])
        
        return result
        
    except Exception as e:
        result['error'] = str(e)
        logger.exception("Error in send_postcall_whatsapp: %s", e)
        return result


def send_template_message(
    phone: str,
    template_trigger: str,
    context: Optional[Dict[str, Any]] = None,
    tenant=None
) -> Dict[str, Any]:
    """
    Send a templated message to any phone number.
    
    Args:
        phone: Phone number to send to
        template_trigger: Which template to use
        context: Variables for template rendering
        tenant: Optional tenant for template lookup
    
    Returns:
        Dict with success status
    """
    from ..models import MessageTemplate
    from ..services.whatsapp_service import send_whatsapp_message
    
    result = {'success': False, 'error': None}
    
    try:
        template = MessageTemplate.get_active_template(template_trigger, tenant)
        
        if not template:
            result['error'] = f'No template found for: {template_trigger}'
            return result
        
        # Use provided context or empty dict
        ctx = context or {}
        message = template.render(ctx)
        
        send_result = send_whatsapp_message(to=phone, text=message)
        
        if send_result.get('success'):
            result['success'] = True
            result['message_id'] = send_result.get('message_id')
        else:
            result['error'] = send_result.get('error')
        
        return result
        
    except Exception as e:
        result['error'] = str(e)
        logger.exception("send_template_message error: %s", e)
        return result
