# crm_app/views_whatsapp.py
"""
WhatsApp API Views.
Handles sending messages, receiving webhooks, and message history.
"""
import json
import logging
from django.conf import settings
from django.http import HttpResponse
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .models import OutboundMessage, Lead
from .services.whatsapp_service import (
    send_whatsapp_message, 
    process_incoming_webhook,
    WhatsAppClient
)

logger = logging.getLogger(__name__)


class SendWhatsAppMessageView(APIView):
    """Send a WhatsApp message to a lead."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        phone = request.data.get('phone')
        message = request.data.get('message')
        lead_id = request.data.get('lead_id')
        
        if not phone or not message:
            return Response(
                {"error": "phone and message are required"}, 
                status=400
            )
        
        result = send_whatsapp_message(
            to=phone,
            text=message,
            lead_id=lead_id,
            is_ai=False
        )
        
        if result.get('success'):
            return Response({
                "message": "Message sent successfully",
                "message_id": result.get('message_db_id'),
                "external_id": result.get('message_id')
            })
        else:
            return Response(
                {"error": result.get('error', 'Failed to send message')},
                status=500
            )


class MessageHistoryView(APIView):
    """Get message history with filters."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Filters
        lead_id = request.query_params.get('lead_id')
        channel = request.query_params.get('channel')  # whatsapp, sms
        direction = request.query_params.get('direction')  # inbound, outbound
        status_filter = request.query_params.get('status')
        limit_raw = request.query_params.get('limit', '50')
        try:
            # Strip trailing slashes and whitespace
            limit = int(str(limit_raw).rstrip('/').strip())
        except (ValueError, TypeError):
            limit = 50
        
        queryset = OutboundMessage.objects.all()
        
        if lead_id:
            queryset = queryset.filter(lead_id=lead_id)
        if channel:
            queryset = queryset.filter(channel=channel)
        if direction:
            queryset = queryset.filter(direction=direction)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        messages = queryset[:limit]
        
        data = [{
            "id": m.id,
            "channel": m.channel,
            "direction": m.direction,
            "to_number": m.to_number,
            "from_number": m.from_number,
            "body": m.body[:100] + "..." if m.body and len(m.body) > 100 else m.body,
            "status": m.status,
            "is_from_ai": m.is_from_ai,
            "lead_id": m.lead_id,
            "lead_name": m.lead.name if m.lead else None,
            "created_at": m.created_at.isoformat(),
            "sent_at": m.sent_at.isoformat() if m.sent_at else None,
        } for m in messages]
        
        # Stats
        total = OutboundMessage.objects.count()
        today_sent = OutboundMessage.objects.filter(
            direction='outbound',
            created_at__date=__import__('django.utils.timezone', fromlist=['now']).now().date()
        ).count()
        
        return Response({
            "messages": data,
            "stats": {
                "total": total,
                "sent_today": today_sent,
                "limit": limit
            }
        })


class LeadConversationView(APIView):
    """Get conversation thread for a specific lead."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, lead_id):
        try:
            lead = Lead.objects.get(id=lead_id)
        except Lead.DoesNotExist:
            return Response({"error": "Lead not found"}, status=404)
        
        messages = OutboundMessage.objects.filter(lead=lead).order_by('created_at')
        
        conversation = [{
            "id": m.id,
            "direction": m.direction,
            "body": m.body,
            "status": m.status,
            "is_from_ai": m.is_from_ai,
            "created_at": m.created_at.isoformat(),
        } for m in messages]
        
        return Response({
            "lead": {
                "id": lead.id,
                "name": lead.name,
                "phone": lead.phone
            },
            "messages": conversation
        })


@method_decorator(csrf_exempt, name='dispatch')
class WhatsAppWebhookView(APIView):
    """Handle WhatsApp webhooks from Meta."""
    permission_classes = [AllowAny]
    
    def get(self, request):
        """Webhook verification (Meta sends GET to verify)."""
        mode = request.query_params.get('hub.mode')
        token = request.query_params.get('hub.verify_token')
        challenge = request.query_params.get('hub.challenge')
        
        verify_token = getattr(settings, 'WHATSAPP_VERIFY_TOKEN', 'cybrichq_whatsapp_verify')
        
        if mode == 'subscribe' and token == verify_token:
            logger.info("WhatsApp webhook verified")
            return HttpResponse(challenge, content_type='text/plain')
        
        return HttpResponse("Forbidden", status=403)
    
    def post(self, request):
        """Handle incoming messages and status updates."""
        try:
            payload = request.data if hasattr(request, 'data') else json.loads(request.body)
            logger.info(f"WhatsApp webhook received: {json.dumps(payload)[:500]}")
            
            # Process the webhook
            result = process_incoming_webhook(payload)
            
            if result:
                logger.info(f"Processed incoming message: {result}")
            
            return Response({"status": "ok"})
            
        except Exception as e:
            logger.exception(f"WhatsApp webhook error: {e}")
            return Response({"status": "ok"})  # Always return 200 to Meta


class WhatsAppStatsView(APIView):
    """Get WhatsApp messaging stats."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from django.utils import timezone
        from django.db.models import Count
        from datetime import timedelta
        
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)
        
        # Today's stats
        today_messages = OutboundMessage.objects.filter(
            channel='whatsapp',
            created_at__date=today
        )
        
        # Weekly stats
        week_messages = OutboundMessage.objects.filter(
            channel='whatsapp',
            created_at__date__gte=week_ago
        )
        
        stats = {
            "today": {
                "sent": today_messages.filter(direction='outbound').count(),
                "received": today_messages.filter(direction='inbound').count(),
                "ai_responses": today_messages.filter(is_from_ai=True).count(),
            },
            "this_week": {
                "sent": week_messages.filter(direction='outbound').count(),
                "received": week_messages.filter(direction='inbound').count(),
                "ai_responses": week_messages.filter(is_from_ai=True).count(),
            },
            "total": OutboundMessage.objects.filter(channel='whatsapp').count(),
            "is_configured": WhatsAppClient().is_configured
        }
        
        return Response(stats)
