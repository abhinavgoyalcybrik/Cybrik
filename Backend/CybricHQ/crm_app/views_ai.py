from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import CallRecord
from .tasks import analyze_call_transcript

class AIAnalysisViewSet(viewsets.ViewSet):
    """
    API endpoints for AI analysis
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=True, methods=['post'])
    def trigger(self, request, pk=None):
        """Manually trigger AI analysis for a call"""
        try:
            call = CallRecord.objects.get(pk=pk)
            task = analyze_call_transcript.delay(call.id)
            return Response({
                "status": "queued",
                "task_id": str(task.id),
                "message": "AI analysis triggered successfully"
            })
        except CallRecord.DoesNotExist:
            return Response({"error": "Call not found"}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'])
    def result(self, request, pk=None):
        """Get analysis result"""
        try:
            call = CallRecord.objects.get(pk=pk)
            if not call.ai_analyzed:
                return Response({"status": "pending", "message": "Analysis not yet complete"})
            
            return Response({
                "status": "completed",
                "result": call.ai_analysis_result,
                "score": call.ai_quality_score
            })
        except CallRecord.DoesNotExist:
            return Response({"error": "Call not found"}, status=status.HTTP_404_NOT_FOUND)


class DocumentVerificationViewSet(viewsets.ViewSet):
    """
    API endpoints for AI document verification
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def verify(self, request):
        """Verify a document using AI Vision"""
        from .services.ai_analyzer import DocumentVerifier
        
        image_url = request.data.get('image_url')
        doc_type = request.data.get('document_type', 'passport')
        
        if not image_url:
            return Response({"error": "image_url is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            verifier = DocumentVerifier()
            result = verifier.verify_document(image_url, doc_type)
            return Response(result)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='scan-match')
    def scan_match(self, request, pk=None):
        """
        Scan a document and match it against applicant data.
        """
        from .models import Document
        from .services.ai_analyzer import DocumentVerifier
        import os
        
        try:
            document = Document.objects.get(pk=pk)
        except Document.DoesNotExist:
            return Response({"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND)
            
        if not document.file:
            return Response({"error": "No file associated with this document"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Prepare Applicant Data
        applicant = document.applicant
        applicant_data = {
            "first_name": applicant.first_name,
            "last_name": applicant.last_name,
            "dob": str(applicant.dob) if applicant.dob else None,
            "passport_number": applicant.passport_number,
            "email": applicant.email,
            "phone": applicant.phone,
            "address": applicant.address
        }
        
        # Get absolute file path
        file_path = document.file.path
        if not os.path.exists(file_path):
             return Response({"error": f"File not found on server at {file_path}"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            verifier = DocumentVerifier()
            result = verifier.verify_and_match(file_path, applicant_data)
            
            # Save results
            if "error" not in result:
                document.extraction_data = result
                # Auto-update status based on verification
                if result.get("verification_status") == "valid":
                     document.validation_status = "valid"
                elif result.get("verification_status") == "suspicious":
                     document.validation_status = "unclear"
                document.save()
            
            return Response(result)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

