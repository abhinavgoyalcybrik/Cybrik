# crm_app/views_document_portal.py
"""
Document Upload Portal Views.
Public endpoints for lead document upload with OTP verification.
"""
import logging
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from .models import DocumentUploadToken, Lead, Applicant, Document
from .services.sms_service import generate_otp, hash_otp, verify_otp_hash, send_otp_sms, send_upload_link_sms

logger = logging.getLogger(__name__)



from django.core.mail import send_mail
from django.conf import settings

class InitiateUploadView(APIView):
    """
    Public endpoint to start upload flow by Applicant ID.
    Returns a token_id that can be used for OTP verification.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        applicant_id = request.data.get('applicant_id')
        if not applicant_id:
            return Response({"error": "Applicant ID is required"}, status=400)

        # Find Applicant
        try:
            applicant = Applicant.objects.get(id=applicant_id)
        except (Applicant.DoesNotExist, ValueError):
            return Response({"error": "Applicant not found"}, status=404)

        if not applicant.email:
            return Response({"error": "Applicant has no registered email. Please contact support."}, status=400)

        # Create upload token (expires in 1 hour)
        token = DocumentUploadToken.objects.create(
            applicant=applicant,
            phone=applicant.phone or "", # Keep data model happy, though we rely on email now
            expires_at=timezone.now() + timedelta(hours=1),
            created_by=None
        )

        return Response({
            "token_id": str(token.id),
            "email_masked": f"***@{applicant.email.split('@')[1]}", # Simple mask
            "expires_at": token.expires_at.isoformat()
        })



class GenerateUploadLinkView(APIView):
    """Generate upload link for a lead/applicant (CRM user action)"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        lead_id = request.data.get('lead_id')
        applicant_id = request.data.get('applicant_id')
        email = request.data.get('email')
        send_notification = request.data.get('send_notification', True)
        
        # Get lead or applicant
        lead = None
        applicant = None
        target_email = email
        name = "Applicant"
        
        if lead_id:
            try:
                lead = Lead.objects.get(id=lead_id)
                target_email = target_email or lead.email
                name = lead.name or "Applicant"
            except Lead.DoesNotExist:
                return Response({"error": "Lead not found"}, status=404)
        
        if applicant_id:
            try:
                applicant = Applicant.objects.get(id=applicant_id)
                target_email = target_email or applicant.email
                name = applicant.first_name
            except Applicant.DoesNotExist:
                return Response({"error": "Applicant not found"}, status=404)
        
        if not target_email:
             return Response({"error": "No email provided or found for this user"}, status=400)

        # Create upload token (expires in 24 hours)
        token = DocumentUploadToken.objects.create(
            lead=lead,
            applicant=applicant,
            phone="", # Not using phone anymore
            expires_at=timezone.now() + timedelta(hours=24),
            created_by=request.user
        )
        
        # Build upload link
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        upload_link = f"{frontend_url}/upload/{token.id}"
        
        email_sent = False
        if send_notification:
            try:
                subject = f"Document Upload Request from CybricHQ"
                html_message = f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9; }}
                        .header {{ background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                        .button {{ display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }}
                        .content {{ padding: 30px 20px; background-color: white; text-align: center; }}
                        .footer {{ margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2 style="margin:0;">Upload Request</h2>
                        </div>
                        <div class="content">
                            <p>Hi {name},</p>
                            <p>Please upload your pending documents to the CybricHQ Portal.</p>
                            
                            <a href="{upload_link}" class="button">Upload Documents</a>
                            
                            <p style="font-size: 14px; margin-top: 20px;">Or copy this link:<br>
                            <a href="{upload_link}">{upload_link}</a></p>
                            
                            <p style="color: #6b7280; font-size: 13px;">This link is valid for 24 hours.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2024 CybricHQ. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
                """
                send_mail(subject, f"Upload here: {upload_link}", settings.DEFAULT_FROM_EMAIL, [target_email], html_message=html_message)
                email_sent = True
            except Exception as e:
                logger.error(f"Failed to send link email: {e}")
        
        return Response({
            "token": str(token.id),
            "link": upload_link,
            "email": target_email,
            "expires_at": token.expires_at.isoformat(),
            "email_sent": email_sent
        })
 


class RequestOTPView(APIView):
    """Request OTP for document upload verification (public) via Email"""
    permission_classes = [AllowAny]
    
    def post(self, request, token_id):
        try:
            try:
                token = DocumentUploadToken.objects.get(id=token_id)
            except DocumentUploadToken.DoesNotExist:
                return Response({"error": "Invalid link"}, status=404)
            
            if token.is_expired():
                return Response({"error": "This link has expired"}, status=410)
            
            if token.is_verified:
                return Response({"error": "Already verified", "verified": True}, status=200)
            
            # Rate limiting
            if not token.can_request_otp():
                wait_time = 60 - (timezone.now() - token.otp_sent_at).total_seconds()
                return Response({'error': f"Please wait {int(wait_time)} seconds"}, status=429)
            
            # Generate and send OTP via Email
            otp = generate_otp()
            token.otp_code = otp
            token.otp_sent_at = timezone.now()
            token.save()
            
            # Determine email
            email_to = None
            name = "Applicant"
            if token.applicant and token.applicant.email:
                email_to = token.applicant.email
                name = token.applicant.first_name
            elif token.lead and token.lead.email:
                email_to = token.lead.email
                name = token.lead.name
                
            if not email_to:
                 return Response({"error": "No email address found for this user"}, status=400)

            # Send Email
            try:
                subject = f"Your Verification Code: {otp}"
                plain_message = f"Hi {name},\n\nYour verification code is: {otp}\n\nValid for 10 minutes."
                
                html_message = f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9; }}
                        .header {{ background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                        .content {{ padding: 30px 20px; background-color: white; }}
                        .otp-box {{ background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0; }}
                        .otp-code {{ font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f766e; display: block; font-family: monospace; }}
                        .footer {{ margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2 style="margin:0;">Verification Code</h2>
                        </div>
                        <div class="content">
                            <p>Hi {name},</p>
                            <p>You requested a verification code for the <strong>CybricHQ Document Portal</strong>.</p>
                            
                            <div class="otp-box">
                                <span class="otp-code">{otp}</span>
                            </div>
                            
                            <p>This code is valid for <strong>10 minutes</strong>.</p>
                            <p style="color: #6b7280; font-size: 14px;">If you did not request this, please ignore this email.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2024 CybricHQ. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
                """
                
                send_mail(
                    subject,
                    plain_message,
                    settings.DEFAULT_FROM_EMAIL,
                    [email_to],
                    fail_silently=False,
                    html_message=html_message
                )
                success = True
            except Exception as e:
                logger.error(f"Email send failed: {e}")
                success = False
                return Response({"error": f"Email send failed: {str(e)}"}, status=500)
            
            if success:
                masked_email = f"****@{email_to.split('@')[1]}"
                return Response({
                    "message": f"OTP sent to {masked_email}",
                    "email_masked": masked_email
                })
        except Exception as e:
            import traceback
            logger.error(f"Critical error in RequestOTPView: {e}")
            return Response({"error": f"Critical Error: {str(e)}"}, status=500)



class VerifyOTPView(APIView):
    """Verify OTP for document upload (public)"""
    permission_classes = [AllowAny]
    
    def post(self, request, token_id):
        try:
            token = DocumentUploadToken.objects.get(id=token_id)
        except DocumentUploadToken.DoesNotExist:
            return Response({"error": "Invalid link"}, status=404)
        
        if token.is_expired():
            return Response({"error": "This link has expired"}, status=410)
        
        if token.is_verified:
            return Response({"message": "Already verified", "verified": True})
        
        if not token.can_verify():
            return Response({"error": "Too many attempts. Please request a new OTP."}, status=429)
        
        otp = request.data.get('otp', '').strip()
        if not otp or len(otp) != 6:
            return Response({"error": "Please enter 6-digit OTP"}, status=400)
        
        # Verify OTP
        token.otp_attempts += 1
        
        if not token.otp_code:
            token.save()
            return Response({"error": "Please request an OTP first"}, status=400)
        
        if otp == token.otp_code:
            token.is_verified = True
            token.verified_at = timezone.now()
            token.save()
            
            # Get lead/applicant info for the upload form
            info = {}
            if token.lead:
                info = {"name": token.lead.name, "type": "lead"}
            elif token.applicant:
                info = {"name": f"{token.applicant.first_name} {token.applicant.last_name or ''}", "type": "applicant"}
            
            return Response({
                "verified": True,
                "message": "Phone verified successfully",
                "info": info
            })
        else:
            token.save()
            remaining = 5 - token.otp_attempts
            return Response({
                "error": f"Invalid OTP. {remaining} attempts remaining.",
                "attempts_remaining": remaining
            }, status=400)


class UploadDocumentView(APIView):
    """Upload document after OTP verification (public)"""
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request, token_id):
        try:
            token = DocumentUploadToken.objects.get(id=token_id)
        except DocumentUploadToken.DoesNotExist:
            return Response({"error": "Invalid link"}, status=404)
        
        if token.is_expired():
            return Response({"error": "This link has expired"}, status=410)
        
        if not token.is_verified:
            return Response({"error": "Please verify your phone first"}, status=403)
        
        # Get uploaded file
        file = request.FILES.get('file')
        if not file:
            return Response({"error": "No file uploaded"}, status=400)
        
        document_type = request.data.get('document_type', 'other')
        notes = request.data.get('notes', '')
        
        # Get or create applicant
        applicant = token.applicant
        if not applicant and token.lead:
            # Create applicant from lead
            applicant = Applicant.objects.create(
                first_name=token.lead.name.split()[0] if token.lead.name else "",
                last_name=" ".join(token.lead.name.split()[1:]) if token.lead.name and len(token.lead.name.split()) > 1 else "",
                phone=token.lead.phone,
                email=token.lead.email,
                lead=token.lead,
                tenant=token.lead.tenant
            )
            token.applicant = applicant
            token.save()
        
        if not applicant:
            return Response({"error": "No applicant associated with this upload link"}, status=400)
        
        # Create document
        document = Document.objects.create(
            applicant=applicant,
            document_type=document_type,
            file=file,
            status="pending",
            notes=notes
        )
        
        # Mark token as used after successful upload
        # (keeping it usable for multiple uploads within validity)
        
        return Response({
            "message": "Document uploaded successfully",
            "document_id": document.id,
            "document_type": document.get_document_type_display(),
            "file_name": file.name
        }, status=201)


class TokenInfoView(APIView):
    """Get info about an upload token (public)"""
    permission_classes = [AllowAny]
    
    def get(self, request, token_id):
        try:
            token = DocumentUploadToken.objects.get(id=token_id)
        except DocumentUploadToken.DoesNotExist:
            return Response({"error": "Invalid link", "valid": False}, status=404)
        
        if token.is_expired():
            return Response({"error": "This link has expired", "valid": False, "expired": True}, status=410)
        
        return Response({
            "valid": True,
            "is_verified": token.is_verified,
            "phone_masked": f"***{token.phone[-4:]}",
            "expires_at": token.expires_at.isoformat()
        })
