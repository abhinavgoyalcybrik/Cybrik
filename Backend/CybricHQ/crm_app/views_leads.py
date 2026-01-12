from rest_framework import views, status, permissions
from rest_framework.response import Response
from django.utils import timezone
from .models import Lead
from .serializers import LeadSerializer
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

User = get_user_model()

class PortalLeadView(views.APIView):
    """
    Public endpoint for capturing leads from the website portal.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data
        phone = data.get("phone")
        email = data.get("email")
        
        # Deduplication Logic
        existing_lead = None
        if phone:
            existing_lead = Lead.objects.filter(phone=phone, status__in=["NEW", "CONTACTED_INCOMPLETE"]).first()
        if not existing_lead and email:
            existing_lead = Lead.objects.filter(email=email, status__in=["NEW", "CONTACTED_INCOMPLETE"]).first()
            
        if existing_lead:
            # Update existing lead
            existing_lead.message = (existing_lead.message or "") + f"\n[Portal Update {timezone.now()}]: {data.get('message', '')}"
            # Update other fields if provided and empty
            if not existing_lead.city and data.get("city"): existing_lead.city = data.get("city")
            if not existing_lead.country and data.get("country"): existing_lead.country = data.get("country")
            if not existing_lead.interested_service and data.get("interested_service"): existing_lead.interested_service = data.get("interested_service")
            existing_lead.save()
            return Response({"message": "Lead updated successfully", "id": existing_lead.id}, status=status.HTTP_200_OK)
        
        # Create new lead
        serializer = LeadSerializer(data=data)
        if serializer.is_valid():
            lead = serializer.save(source="PORTAL", status="NEW")
            # Trigger automation (Welcome message, etc.) - To be implemented via signals
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class WalkInLeadView(views.APIView):
    """
    Authenticated endpoint for staff to enter walk-in leads.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data.copy()
        data["assigned_to"] = request.user.id
        
        phone = data.get("phone")
        email = data.get("email")
        
        # Deduplication Logic
        existing_lead = None
        if phone:
            existing_lead = Lead.objects.filter(phone=phone).first()
        
        if existing_lead:
             # For walk-ins, we might want to create a new visit log or just update the lead
             # Here we update and log the visit
             existing_lead.visit_type = data.get("visit_type", "follow_up")
             existing_lead.assigned_to = request.user
             existing_lead.save()
             return Response({"message": "Existing lead updated for walk-in", "id": existing_lead.id}, status=status.HTTP_200_OK)

        serializer = LeadSerializer(data=data)
        if serializer.is_valid():
            lead = serializer.save(source="WALK_IN", status="NEW")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class WebLeadView(views.APIView):
    """
    Public endpoint for 'Get Started' form on the corporate website.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data
        
        # Basic validation
        required_fields = ['name', 'email', 'phone']
        missing = [f for f in required_fields if not data.get(f)]
        if missing:
            return Response({"error": f"Missing required fields: {', '.join(missing)}"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Create Lead (for CybrikHQ itself, usually handles tenant=None or special tenant)
            # Assuming tenant is optional or handled by mixin/default
            serializer = LeadSerializer(data=data)
            if serializer.is_valid():
                lead = serializer.save(status="NEW") # Source is handled by serializer or default
                
                # Send Email
                # Prepare Email Content
                from django.template.loader import render_to_string
                from django.utils.html import strip_tags
                from django.core.mail import EmailMultiAlternatives

                subject = f"New Lead: {lead.name} via Get Started"
                
                # Context for template
                context = {
                    "lead": lead,
                }
                
                # Render HTML and Plain Text
                html_content = render_to_string("crm_app/lead_notification.html", context)
                text_content = strip_tags(html_content)
                
                try:
                    msg = EmailMultiAlternatives(
                        subject,
                        text_content, # Plain text fallback
                        settings.DEFAULT_FROM_EMAIL,
                        ['info@cybriksolutions.com']
                    )
                    msg.attach_alternative(html_content, "text/html")
                    msg.send()
                except Exception as e:
                    logger.error(f"Failed to send lead email: {e}")
                    # Don't fail the request if email fails, but log it

                return Response({"message": "Lead captured successfully"}, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error processing web lead: {e}")
            return Response({"error": "Internal server error processing lead"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
