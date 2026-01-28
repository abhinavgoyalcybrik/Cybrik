# crm_app/views_whatsapp.py
"""
WhatsApp Business API views for webhooks and sending messages.
"""
import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.http import HttpResponse

from .models import Lead, WhatsAppMessage
from .services.whatsapp_client import (
    send_template_message,
    send_text_message,
    send_welcome_message,
    send_document_request,
    send_followup_reminder,
    verify_webhook,
    parse_webhook_message,
    get_whatsapp_config,
)

logger = logging.getLogger(__name__)


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def whatsapp_webhook(request):
    """
    Meta WhatsApp webhook endpoint.
    GET: Webhook verification (hub.mode, hub.verify_token, hub.challenge)
    POST: Incoming messages and status updates
    """
    if request.method == "GET":
        # Webhook verification
        mode = request.GET.get("hub.mode")
        token = request.GET.get("hub.verify_token")
        challenge = request.GET.get("hub.challenge")
        
        result = verify_webhook(mode, token, challenge)
        if result:
            return HttpResponse(result, content_type="text/plain")
        return HttpResponse("Verification failed", status=403)
    
    # POST - incoming message or status update
    try:
        payload = request.data
        logger.info(f"WhatsApp webhook received: {payload}")
        
        parsed = parse_webhook_message(payload)
        if not parsed:
            return Response({"status": "ignored"})
        
        if parsed["type"] == "message":
            # Incoming message from user
            handle_incoming_message(parsed)
        elif parsed["type"] == "status":
            # Message status update (sent, delivered, read)
            handle_status_update(parsed)
        
        return Response({"status": "ok"})
        
    except Exception as e:
        logger.exception(f"WhatsApp webhook error: {e}")
        # Always return 200 to Meta to avoid retries
        return Response({"status": "error", "message": str(e)})


def handle_incoming_message(parsed: dict):
    """Handle incoming WhatsApp message from user."""
    from_phone = parsed.get("from_phone", "")
    text = parsed.get("text", "")
    message_id = parsed.get("message_id")
    
    logger.info(f"Incoming WhatsApp from {from_phone}: {text}")
    
    # Find associated lead by phone number (last 10 digits)
    phone_suffix = from_phone[-10:] if len(from_phone) >= 10 else from_phone
    lead = Lead.objects.filter(phone__icontains=phone_suffix).first()
    
    # Log the message
    msg_record = WhatsAppMessage.objects.create(
        lead=lead,
        tenant=lead.tenant if lead else None,
        direction="inbound",
        message_type="text",
        from_phone=from_phone,
        to_phone=settings.WHATSAPP_PHONE_NUMBER_ID or "",
        message_body=text,
        message_id=message_id,
        status="delivered",
        metadata=parsed,
    )
    
    # Only trigger AI reply if we have a known lead
    if lead:
        logger.info(f"Queuing AI reply handler for WhatsApp message {msg_record.id}")
        from .tasks import handle_incoming_whatsapp_with_ai_task
        handle_incoming_whatsapp_with_ai_task.delay(msg_record.id)
    else:
        logger.warning(f"No lead found for phone {from_phone} - skipping AI reply")


def handle_status_update(parsed: dict):
    """Handle WhatsApp message status update (sent, delivered, read)."""
    message_id = parsed.get("message_id")
    new_status = parsed.get("status", "")
    
    # Update existing message record
    try:
        msg = WhatsAppMessage.objects.filter(message_id=message_id).first()
        if msg:
            msg.status = new_status
            if parsed.get("errors"):
                msg.error_message = str(parsed["errors"])
                msg.status = "failed"
            msg.save(update_fields=["status", "error_message", "updated_at"])
            logger.info(f"WhatsApp message {message_id} status updated to {new_status}")
    except Exception as e:
        logger.error(f"Failed to update WhatsApp status: {e}")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_whatsapp_message(request):
    """
    Send WhatsApp message to a lead/applicant.
    
    Body:
    - lead_id or applicant_id (required)
    - template_name (required for outbound)
    - message (optional, for text within 24hr window)
    - variables (optional, list of template variables)
    """
    lead_id = request.data.get("lead_id")
    applicant_id = request.data.get("applicant_id")
    template_name = request.data.get("template_name")
    message = request.data.get("message")
    variables = request.data.get("variables", [])
    
    # Get target
    target = None
    phone = None
    name = "there"
    
    if lead_id:
        try:
            target = Lead.objects.get(id=lead_id)
            phone = target.phone
            name = target.name
        except Lead.DoesNotExist:
            return Response({"error": "Lead not found"}, status=404)
    elif applicant_id:
        try:
            target = Applicant.objects.get(id=applicant_id)
            phone = target.phone
            name = target.first_name
        except Applicant.DoesNotExist:
            return Response({"error": "Applicant not found"}, status=404)
    else:
        return Response({"error": "lead_id or applicant_id required"}, status=400)
    
    if not phone:
        return Response({"error": "No phone number available"}, status=400)
    
    # Build components if variables provided
    components = None
    if variables:
        components = [{
            "type": "body",
            "parameters": [{"type": "text", "text": v} for v in variables]
        }]
    
    # Send message
    if template_name:
        result = send_template_message(phone, template_name, components=components)
    elif message:
        result = send_text_message(phone, message)
    else:
        return Response({"error": "template_name or message required"}, status=400)
    
    # Log the message
    msg_record = WhatsAppMessage.objects.create(
        lead=target if isinstance(target, Lead) else None,
        applicant=target if isinstance(target, Applicant) else None,
        tenant=getattr(target, 'tenant', None),
        direction="outbound",
        message_type="template" if template_name else "text",
        template_name=template_name,
        from_phone=settings.WHATSAPP_PHONE_NUMBER_ID or "",
        to_phone=phone,
        message_body=message or f"Template: {template_name}",
        message_id=result.get("message_id"),
        status="sent" if result.get("success") else "failed",
        error_message=result.get("error") if not result.get("success") else None,
        metadata={"variables": variables, "response": result},
    )
    
    if result.get("success"):
        return Response({
            "success": True,
            "message_id": result.get("message_id"),
            "record_id": msg_record.id,
        })
    else:
        return Response({
            "success": False,
            "error": result.get("error"),
        }, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_document_upload_request(request):
    """
    Send document upload request via WhatsApp.
    
    Body:
    - lead_id or applicant_id (required)
    """
    lead_id = request.data.get("lead_id")
    applicant_id = request.data.get("applicant_id")
    
    target = None
    if lead_id:
        try:
            target = Lead.objects.get(id=lead_id)
        except Lead.DoesNotExist:
            return Response({"error": "Lead not found"}, status=404)
    elif applicant_id:
        try:
            target = Applicant.objects.get(id=applicant_id)
        except Applicant.DoesNotExist:
            return Response({"error": "Applicant not found"}, status=404)
    else:
        return Response({"error": "lead_id or applicant_id required"}, status=400)
    
    phone = target.phone
    name = target.name if hasattr(target, 'name') else target.first_name
    
    if not phone:
        return Response({"error": "No phone number"}, status=400)
    
    # Generate upload link
    from .views import generate_upload_token
    token = generate_upload_token(target.id if isinstance(target, Lead) else None, target.tenant_id if hasattr(target, 'tenant_id') else None)
    upload_link = f"{settings.FRONTEND_URL}/upload?token={token}"
    
    result = send_document_request(phone, name, upload_link)
    
    # Log
    WhatsAppMessage.objects.create(
        lead=target if isinstance(target, Lead) else None,
        applicant=target if isinstance(target, Applicant) else None,
        tenant=getattr(target, 'tenant', None),
        direction="outbound",
        message_type="template",
        template_name="document_upload_request",
        from_phone=settings.WHATSAPP_PHONE_NUMBER_ID or "",
        to_phone=phone,
        message_body=f"Document upload request sent with link: {upload_link}",
        message_id=result.get("message_id"),
        status="sent" if result.get("success") else "failed",
        error_message=result.get("error") if not result.get("success") else None,
    )
    
    return Response({
        "success": result.get("success", False),
        "message_id": result.get("message_id"),
        "error": result.get("error"),
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def whatsapp_config_status(request):
    """Check if WhatsApp is configured."""
    config = get_whatsapp_config()
    
    is_configured = bool(config["phone_number_id"] and config["access_token"])
    
    return Response({
        "configured": is_configured,
        "phone_number_id_set": bool(config["phone_number_id"]),
        "access_token_set": bool(config["access_token"]),
        "business_account_id_set": bool(config["business_account_id"]),
    })
