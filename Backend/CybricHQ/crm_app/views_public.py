from rest_framework import views, status, permissions
from rest_framework.response import Response
from django.core.signing import TimestampSigner, Signer, BadSignature, SignatureExpired
from django.conf import settings
from .models import Lead, Document
from .serializers import DocumentSerializer
import logging

logger = logging.getLogger(__name__)

# Use a dedicated salt for upload tokens to ensure consistency
# TimestampSigner allows optional expiration (we set max_age in unsign)
UPLOAD_TOKEN_SALT = "cybrik-public-upload-v1"
UPLOAD_LINK_MAX_AGE_SECONDS = 30 * 24 * 60 * 60  # 30 days in seconds

# New signer with timestamp for expiry
signer = TimestampSigner(salt=UPLOAD_TOKEN_SALT)
# Legacy signer for backward compatibility with old tokens
legacy_signer = Signer()

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
            frontend_url = getattr(settings, 'FRONTEND_URL', 'https://crm.cybriksolutions.com')
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

    def _validate_token(self, token):
        """
        Validate token using TimestampSigner with fallback to legacy Signer.
        Returns (lead_id, error_response) - if error_response is not None, return it.
        """
        # Try new TimestampSigner first
        try:
            lead_id = signer.unsign(token, max_age=UPLOAD_LINK_MAX_AGE_SECONDS)
            logger.info(f"Token validated successfully (new format) for lead_id: {lead_id}")
            return lead_id, None
        except SignatureExpired:
            logger.warning(f"Token expired: {token[:20]}...")
            return None, Response(
                {"error": "This upload link has expired. Please request a new one."},
                status=status.HTTP_403_FORBIDDEN
            )
        except BadSignature:
            # Try legacy signer for backward compatibility
            logger.debug(f"New signer failed, trying legacy signer...")
            try:
                lead_id = legacy_signer.unsign(token)
                logger.info(f"Token validated successfully (legacy format) for lead_id: {lead_id}")
                return lead_id, None
            except BadSignature:
                logger.warning(f"Token validation failed (both signers): {token[:20]}...")
                return None, Response(
                    {"error": "Invalid or expired link. Please request a new one."},
                    status=status.HTTP_403_FORBIDDEN
                )

    def get(self, request):
        """Validate token and return lead name"""
        token = request.query_params.get("token")
        if not token:
            return Response({"error": "Token required"}, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"Validating upload token: {token[:30]}...")
        
        lead_id, error_response = self._validate_token(token)
        if error_response:
            return error_response
        
        try:
            lead = Lead.objects.get(pk=lead_id)
            logger.info(f"Lead found: {lead.id} - {str(lead)}")
            return Response({"valid": True, "lead_name": str(lead), "lead_id": lead.id})
        except Lead.DoesNotExist:
            logger.error(f"Lead not found for id: {lead_id}")
            return Response({"error": "Lead not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Token validation failed: {e}")
            return Response({"error": f"Server Error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        token = request.data.get("token")
        file = request.data.get("file")
        doc_type = request.data.get("document_type", "other")
        
        if not token or not file:
            return Response({"error": "Token and file are required"}, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"Processing upload with token: {token[:30]}...")
        
        lead_id, error_response = self._validate_token(token)
        if error_response:
            return error_response
        
        try:
            lead = Lead.objects.get(pk=lead_id)
            logger.info(f"Creating document for lead: {lead.id}")
            
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
            
            logger.info(f"Document created successfully: {document.id}")
            return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)
            
        except Lead.DoesNotExist:
            logger.error(f"Lead not found for id: {lead_id}")
            return Response({"error": "Lead not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Public upload failed: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
