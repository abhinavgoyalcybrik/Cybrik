from rest_framework import views, status, permissions
from rest_framework.response import Response
from django.core.signing import Signer, BadSignature
from django.conf import settings
from .models import Lead, Document
from .serializers import DocumentSerializer
import logging

logger = logging.getLogger(__name__)
signer = Signer()

class GenerateUploadLinkView(views.APIView):
    """
    Generate a secure, signed upload link for a Lead.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        lead_id = request.data.get("lead_id")
        if not lead_id:
            return Response({"error": "lead_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            lead = Lead.objects.get(pk=lead_id)
            # Sign the lead ID to create a token
            token = signer.sign(str(lead.id))
            
            # Construct URL using configured FRONTEND_URL
            frontend_url = getattr(settings, 'FRONTEND_URL', 'https://cybriksolutions.com')
            upload_link = f"/upload?token={token}"
            full_link = f"{frontend_url.rstrip('/')}/upload?token={token}"
            
            return Response({
                "link": full_link,
                "token": token
            })
        except Lead.DoesNotExist:
            return Response({"error": "Lead not found"}, status=status.HTTP_404_NOT_FOUND)

class PublicUploadView(views.APIView):
    """
    Public endpoint to upload documents using a signed token.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """Validate token and return lead name"""
        token = request.query_params.get("token")
        if not token:
             return Response({"error": "Token required"}, status=status.HTTP_400_BAD_REQUEST)
             
        try:
            lead_id = signer.unsign(token)
            lead = Lead.objects.get(pk=lead_id)
            return Response({"valid": True, "lead_name": lead.name, "lead_id": lead.id})
        except BadSignature:
            return Response({"error": "Invalid or expired link"}, status=status.HTTP_403_FORBIDDEN)
        except Lead.DoesNotExist:
            return Response({"error": "Lead not found"}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request):
        token = request.data.get("token")
        file = request.data.get("file")
        doc_type = request.data.get("document_type", "other")
        
        if not token or not file:
            return Response({"error": "Token and file are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            lead_id = signer.unsign(token)
            lead = Lead.objects.get(pk=lead_id)
            
            # Create Document
            document = Document.objects.create(
                lead=lead,
                file=file,
                document_type=doc_type,
                status="pending",
                validation_status="pending"
            )
            
            # Trigger AI Verification
            try:
                from .tasks import verify_document_task
                verify_document_task.delay(document.id)
            except Exception as e:
                logger.error(f"Failed to trigger auto-verify for public upload: {e}")
                
            return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)
            
        except BadSignature:
            return Response({"error": "Invalid or expired link"}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error(f"Public upload failed: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
