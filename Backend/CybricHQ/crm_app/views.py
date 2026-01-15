
"""
Improved views for CRM app (defensive, consistent webhook/auth handling,
and DB-safe updates).
"""
from __future__ import annotations
import json
import logging
import hmac
from typing import Any, Dict

import os
import requests
from django.conf import settings
from django.utils import timezone
from django.db.models import Count, Q
from django.db.models.functions import TruncMonth
from datetime import timedelta
from .tasks import (
    forward_lead_to_elevenlabs,
    process_call_result,
    run_llm_extraction_task,
    schedule_elevenlabs_call as start_voice_call_task,
)
from rest_framework import viewsets, status, permissions, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from django_filters.rest_framework import DjangoFilterBackend
from .authentication import JWTAuthFromCookie

from .models import (
    Applicant,
    AcademicRecord,
    Application,
    Transcript,
    AIResult,
    CallRecord,
    OutboundMessage,
    Lead,
    FollowUp,
    Document,
)
from django.contrib.auth import get_user_model
User = get_user_model()
from .serializers import (
    ApplicantSerializer,
    AcademicRecordSerializer,
    ApplicationSerializer,
    TranscriptSerializer,
    AIResultSerializer,
    FollowUpSerializer,
    AdIntegrationSerializer,
    AdCampaignSerializer,
    OutboundMessageSerializer,
    LeadSerializer,
    CallRecordSerializer,
    UserSerializer,
    DocumentSerializer,
)
from .tenant_mixins import TenantQuerySetMixin

logger = logging.getLogger(__name__)


# -------------------------
# Utility helpers
# -------------------------
def _verify_webhook_secret(request) -> bool:
    """
    Verify incoming webhook header secret.
    Checks ELEVENLABS_WEBHOOK_SECRET, then ELEVEN_WEBHOOK_SECRET, then WEBHOOK_SECRET in settings.
    Uses constant-time compare.
    SECURITY: If no secret configured, rejects request (fail closed).
    """
    expected = getattr(settings, "ELEVENLABS_WEBHOOK_SECRET", None) or getattr(settings, "ELEVEN_WEBHOOK_SECRET", None) or getattr(settings, "WEBHOOK_SECRET", None)
    if not expected:
        # SECURITY FIX: Fail closed - reject if no secret configured
        logger.warning("Webhook secret not configured - rejecting request for security")
        return False
    header = request.headers.get("X-Webhook-Secret") or request.META.get("HTTP_X_WEBHOOK_SECRET")
    if not header:
        logger.warning("Webhook received without X-Webhook-Secret header")
        return False
    try:
        return hmac.compare_digest(header, str(expected))
    except Exception:
        return False


def _safe_json_parse(body: Any) -> Dict[str, Any]:
    """Return a dict parsed from body (which may be bytes/str/dict)."""
    if body is None:
        return {}
    if isinstance(body, dict):
        return body
    if isinstance(body, bytes):
        try:
            return json.loads(body.decode("utf-8"))
        except Exception:
            return {"_raw": body.decode("utf-8", errors="ignore")}
    if isinstance(body, str):
        try:
            return json.loads(body)
        except Exception:
            return {"_raw": body}
    try:
        return dict(body)
    except Exception:
        return {"_raw": str(body)}


def _field_exists(obj, field_name: str) -> bool:
    """Return True if obj appears to have an attribute/field `field_name` we can safely save via update_fields."""
    return hasattr(obj, field_name)


# -------------------------
# ViewSets (unchanged API surface, safer internals)
# -------------------------
class ApplicantViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = Applicant.objects.all().order_by("-created_at")
    serializer_class = ApplicantSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Explicitly filter by tenant to ensure visibility."""
        qs = Applicant.objects.all().order_by("-created_at")
        tenant = getattr(self.request, 'tenant', None)
        if tenant:
             return qs.filter(tenant_id=tenant.id)
        
        # Superuser fallback
        if self.request.user.is_superuser:
            return qs
            
        return qs.none()

    def perform_create(self, serializer):
        """Assign tenant from request before saving."""
        tenant = getattr(self.request, 'tenant', None)
        if tenant:
            serializer.save(tenant=tenant)
        else:
            serializer.save()

    def create(self, request, *args, **kwargs):
        # 1. Check if we're converting a lead
        lead_id = request.data.get("leadId") or request.data.get("lead_id")
        lead = None
        target_tenant = getattr(request, 'tenant', None)
        
        logger.info(f"ApplicantViewSet.create called. lead_id={lead_id}, request_tenant={target_tenant}, user={request.user}")

        if lead_id:
            from .models import Lead
            try:
                # If we have a request tenant, ensure lead belongs to it
                if target_tenant:
                    lead = Lead.objects.get(id=lead_id, tenant=target_tenant)
                else:
                    # If no request tenant (e.g. admin/superuser), get lead and USE ITS TENANT
                    lead = Lead.objects.get(id=lead_id)
                    target_tenant = lead.tenant
                logger.info(f"Lead {lead_id} found: {lead}, tenant={lead.tenant}")
            except Lead.DoesNotExist:
                logger.error(f"Lead {lead_id} not found for tenant {target_tenant}")
                return Response(
                    {"error": f"Lead {lead_id} not found. Cannot convert to applicant."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # 2. Create the applicant with the correct tenant
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        logger.info(f"Serializer validated. target_tenant={target_tenant}")
        
        # Manually save with tenant
        # Defensive: Save strictly with tenant, and double-check
        if target_tenant:
             applicant = serializer.save(tenant=target_tenant)
             logger.info(f"Applicant created: id={applicant.id}, tenant_id={applicant.tenant_id}, lead_id={applicant.lead_id}")
             
             # Verify tenant was set (DRF sometimes ignores kwargs if not in fields)
             if applicant.tenant_id != target_tenant.id:
                 input_tenant_id = target_tenant.id
                 logger.warning(f"Applicant {applicant.id} created but tenant mismatch! Expected {input_tenant_id}, got {applicant.tenant_id}. Forcing update.")
                 applicant.tenant = target_tenant
                 applicant.save(update_fields=['tenant'])
        else:
             applicant = serializer.save()
             logger.warning(f"Applicant created WITHOUT tenant: id={applicant.id}")

        # 3. Post-creation: Link metadata and delete lead
        if lead:
             try:
                # Transfer lead metadata to applicant
                if not applicant.metadata:
                    applicant.metadata = {}
                
                applicant.metadata.update({
                    "original_lead_id": lead.id,
                    "lead_external_id": lead.external_id,
                    "lead_source": lead.source,
                    "lead_message": lead.message,
                    "lead_received_at": lead.received_at.isoformat() if lead.received_at else None,
                })
                # Also copy raw payload if useful
                if lead.raw_payload:
                    applicant.metadata["lead_raw_payload"] = lead.raw_payload

                # Link calls linked to this lead
                from .models import CallRecord
                CallRecord.objects.filter(lead=lead).update(applicant=applicant)

                # IMPORTANT: Unlink lead from applicant to prevent CASCADE DELETE
                # The model has on_delete=models.CASCADE, so deleting lead deletes applicant if linked!
                # Use direct DB update to be absolutely sure
                Applicant.objects.filter(id=applicant.id).update(lead=None)
                
                # Update metadata separate from lead unlink
                applicant.save(update_fields=["metadata"])
                
                logger.info(f"About to delete lead {lead.id}. Applicant {applicant.id} has lead_id set? Checking DB...")
                
                # Refresh from DB to confirm state before deleting lead
                db_applicant = Applicant.objects.filter(id=applicant.id).first()
                if db_applicant:
                    logger.info(f"DB check: Applicant {db_applicant.id} exists, lead_id={db_applicant.lead_id}, tenant_id={db_applicant.tenant_id}")
                else:
                    logger.error(f"DB check: Applicant {applicant.id} NOT FOUND in DB before lead deletion!")

                # DELETE the lead
                lead.delete()
                
                # Verify applicant still exists after lead deletion
                post_delete_check = Applicant.objects.filter(id=applicant.id).first()
                if post_delete_check:
                    logger.info(f"SUCCESS: Applicant {applicant.id} still exists after lead deletion")
                else:
                    logger.error(f"CRITICAL: Applicant {applicant.id} was deleted when lead was deleted! CASCADE issue!")
                
                logger.info(f"Converted Lead {lead.id} to Applicant {applicant.id} (Tenant: {target_tenant}) and deleted Lead.")

             except Exception as e:
                logger.exception(f"Failed to link lead data after creation: {e}")
                # Don't fail the request since applicant is created, but warn?
                # Actually, we should probably warn, but for now let's just log.

        # 4. Link calls with matching phone number (ALWAYS run this)
        if applicant.phone:
            from .models import CallRecord
            from django.db.models import Q
            updated_count = CallRecord.objects.filter(
                Q(applicant__isnull=True) &
                (
                    Q(metadata__phone_number=applicant.phone) |
                    Q(metadata__customer_phone=applicant.phone) |
                    Q(metadata__phone=applicant.phone) |
                    Q(metadata__to=applicant.phone) |
                    Q(metadata__from=applicant.phone)
                )
            ).update(applicant=applicant)
            if updated_count > 0:
                logger.info(f"Linked {updated_count} existing calls to new Applicant {applicant.id} by phone {applicant.phone}")

        # Final verification
        final_check = Applicant.objects.filter(id=applicant.id).first()
        logger.info(f"Final check: Applicant exists={final_check is not None}, tenant={final_check.tenant_id if final_check else 'N/A'}")

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


    @action(detail=True, methods=["get"], url_path="activity")
    def activity(self, request, pk=None):
        """
        Fetch activity logs for this applicant.
        """
        applicant = self.get_object()
        from .models import AuditLog
        from .serializers import AuditLogSerializer
        
        logs = AuditLog.objects.filter(applicant=applicant).order_by("-created_at")
        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="convert-to-application")
    def convert_to_application(self, request):
        """
        Convert an applicant to an application.
        Expects: { "applicant_id": <id>, "program": "<program_name>" }
        """
        applicant_id = request.data.get("applicant_id")
        program = request.data.get("program")

        if not applicant_id or not program:
            return Response(
                {"error": "applicant_id and program are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            applicant = Applicant.objects.get(id=applicant_id)
        except Applicant.DoesNotExist:
            return Response(
                {"error": "Applicant not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Create the application
        application = Application.objects.create(
            applicant=applicant,
            program=program,
            status="pending"
        )

        return Response(
            {
                "message": "Successfully converted to application",
                "application_id": application.id,
                "applicant_id": applicant.id
            },
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["post"], url_path="generate-follow-ups")
    def generate_follow_ups(self, request, pk=None):
        """
        Analyze all transcripts for this applicant and generate follow-up tasks.
        """
        applicant = self.get_object()
        
        # Gather all transcripts
        # Check calls linked directly to applicant OR linked to the original lead
        from .models import CallRecord
        calls = CallRecord.objects.filter(
            Q(applicant=applicant) | 
            Q(lead__applicants=applicant) # If lead is linked to applicant
        ).distinct().order_by("-created_at")
        
        full_transcript = ""
        
        for call in calls:
            text = None
            if call.transcripts.exists():
                text = call.transcripts.first().transcript_text
            elif call.metadata and call.metadata.get("transcript"):
                text = call.metadata.get("transcript")
            
            if text:
                date_str = call.created_at.strftime("%Y-%m-%d %H:%M")
                full_transcript += f"\n\n--- Call on {date_str} ---\n{text}"
        
        if not full_transcript:
            return Response({"error": "No transcripts found for this applicant"}, status=status.HTTP_400_BAD_REQUEST)

        # Analyze
        try:
            from .services.ai_analyzer import CallAnalyzer
            from .tasks import calculate_follow_up_time
            
            logger.debug("Initializing CallAnalyzer...")
            analyzer = CallAnalyzer()
            logger.debug("Sending to AI...")
            analysis = analyzer.analyze_transcript(full_transcript, metadata={"applicant_id": applicant.id, "name": applicant.first_name})
            logger.debug(f"AI Analysis Result: {analysis}")
            
            created_tasks = []
            if analysis.get('follow_up', {}).get('needed'):
                priority = 'HIGH' if analysis.get('interest_level') == 'high' else 'MEDIUM'
                
                # Create FollowUp
                # Note: FollowUp.lead is a ForeignKey to Applicant (confusing naming in legacy model)
                task = FollowUp.objects.create(
                    lead=applicant, 
                    channel='phone' if analysis.get('interest_level') == 'high' else 'email',
                    notes=f"AI Recommendation: {analysis.get('follow_up', {}).get('reason', 'Follow-up needed')}",
                    due_at=calculate_follow_up_time(analysis.get('follow_up', {}).get('timing', '2 days')),
                    metadata={'created_by_ai': True, 'analysis': analysis, 'priority': priority}
                )
                created_tasks.append(task)
                
            return Response({
                "message": "Analysis complete", 
                "tasks_created": len(created_tasks),
                "analysis": analysis
            })
        except Exception as e:
            logger.exception(f"Error generating follow-ups: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AcademicRecordViewSet(viewsets.ModelViewSet):
    queryset = AcademicRecord.objects.all()
    serializer_class = AcademicRecordSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['lead']
    permission_classes = [IsAuthenticated, TenantQuerySetMixin]


class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['lead', 'document_type', 'status']
    permission_classes = [IsAuthenticated, TenantQuerySetMixin]

    def perform_create(self, serializer):
        # Security Validation
        file = self.request.data.get('file')
        if file:
            # 1. Size Check (Max 10MB)
            if file.size > 10 * 1024 * 1024:
                raise serializers.ValidationError({"file": "File size too large. Max 10MB allowed."})
            
            # 2. Extension Check
            allowed_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']
            ext = os.path.splitext(file.name)[1].lower()
            if ext not in allowed_extensions:
                raise serializers.ValidationError({"file": f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"})

            # 3. (Optional) Magic Number Check could go here for stricter security
            
        instance = serializer.save()
        
        # TODO: Trigger real AI document extraction via Celery task
        # For now, mark as pending validation
        try:
            instance.validation_status = "pending"
            instance.save(update_fields=['validation_status'])
            logger.info(f"Document {instance.id} uploaded, pending AI extraction")
        except Exception as e:
            logger.error(f"Failed to update document status: {e}")


class ApplicationViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = Application.objects.all().order_by("-created_at")
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=["post"], url_path="start-voice-call")
    def start_voice_call(self, request, pk=None):
        """
        Initiate an outbound ElevenLabs call for this application.
        Accepts: { "phone_number": "+91...", "caller_id": "...", "agent_id": "...", "metadata": {...} }
        If CELERY_TASK_ALWAYS_EAGER is True, runs inline and returns JSON-serializable result.
        """
        app = self.get_object()
        # Resolve phone
        phone = (
            request.data.get("phone_number")
            or getattr(app, "phone", None)
            or (getattr(app, "applicant", None) and getattr(app.applicant, "phone", None))
        )
        if not phone:
            return Response({"error": "phone number not provided or available"}, status=status.HTTP_400_BAD_REQUEST)

        caller_id = request.data.get("caller_id")
        agent_id = request.data.get("agent_id")

        # parse metadata safely
        metadata_raw = request.data.get("metadata", {})
        if isinstance(metadata_raw, str):
            try:
                metadata = json.loads(metadata_raw.strip() or "{}")
            except Exception:
                metadata = {}
                logger.debug("start_voice_call: failed to parse metadata string: %r", metadata_raw)
        else:
            metadata = metadata_raw or {}

        applicant = getattr(app, "applicant", None)
        if not applicant:
            return Response({"error": "application missing applicant"}, status=status.HTTP_400_BAD_REQUEST)

        # sanitize function for responses (makes complex objects serializable-ish)
        def sanitize_value(v):
            try:
                json.dumps(v)
                return v
            except Exception:
                try:
                    # requests.Response -> try to extract JSON/text
                    if isinstance(v, requests.Response):
                        try:
                            return v.json()
                        except Exception:
                            return {"raw_text": v.text}
                except Exception:
                    pass
                try:
                    from rest_framework.response import Response as DRFResponse
                    if isinstance(v, DRFResponse):
                        return getattr(v, "data", str(v))
                except Exception:
                    pass
                return str(v)

        # Eager (dev) path: run task inline but sanitize result
        if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
            try:
                eager_result = start_voice_call_task.apply(args=[str(applicant.id), phone, metadata, caller_id, agent_id])
                result = getattr(eager_result, "result", None)
                if isinstance(result, dict):
                    safe_result = {k: sanitize_value(v) for k, v in result.items()}
                else:
                    safe_result = sanitize_value(result)
                return Response({"status": "completed", "result": safe_result}, status=status.HTTP_200_OK)
            except Exception as exc:
                logger.exception("start_voice_call (eager) raised: %s", exc)
                return Response({"status": "error", "error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Async path: enqueue
        async_res = start_voice_call_task.delay(str(applicant.id), phone, metadata, caller_id, agent_id)
        return Response({"status": "enqueued", "task_id": getattr(async_res, "id", None)}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"])
    def run_ai(self, request, pk=None):
        app = self.get_object()
        transcript = getattr(app, "transcripts", None)
        if transcript is None:
            return Response({"error": "no_transcript"}, status=status.HTTP_400_BAD_REQUEST)
        last = transcript.order_by("-created_at").first()
        if not last:
            return Response({"error": "no_transcript"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
                res = run_llm_extraction_task.apply(args=[str(app.id), str(last.id)])
                return Response({"status": "completed", "detail": getattr(res, "result", None)}, status=status.HTTP_200_OK)
            else:
                async_res = run_llm_extraction_task.delay(str(app.id), str(last.id))
                return Response({"status": "enqueued", "task_id": getattr(async_res, "id", None)}, status=status.HTTP_202_ACCEPTED)
        except Exception as exc:
            logger.exception("run_ai failed for app=%s", app.id)
            return Response({"error": "run_ai_failed", "exc": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["get"])
    def ai_result(self, request, pk=None):
        app = self.get_object()
        ai = getattr(app, "ai_results", None)
        if ai is None:
            return Response({"detail": "no_ai_result"}, status=status.HTTP_404_NOT_FOUND)
        last = ai.order_by("-created_at").first()
        if not last:
            return Response({"detail": "no_ai_result"}, status=status.HTTP_404_NOT_FOUND)
        serializer = AIResultSerializer(last, context={"request": request})
        return Response(serializer.data)


class TranscriptViewSet(viewsets.ModelViewSet):
    queryset = Transcript.objects.all().order_by("-created_at")
    serializer_class = TranscriptSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("application", "asr_provider", "call")


class AIResultViewSet(viewsets.ModelViewSet):
    queryset = AIResult.objects.all().order_by("-created_at")
    serializer_class = AIResultSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("application",)


class OutboundMessageViewSet(viewsets.ModelViewSet):
    queryset = OutboundMessage.objects.all().order_by("-created_at")
    serializer_class = OutboundMessageSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("application", "status", "channel")

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        om = self.get_object()
        om.status = "sent"
        if not getattr(om, "provider_id", None):
            om.provider_id = "dev-sent"
        # Save defensively
        try:
            om.save()
        except Exception:
            logger.exception("Failed to save OutboundMessage %s", getattr(om, "id", None))
        return Response({"status": "sent"})


class LeadViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = Lead.objects.all().order_by("-received_at")
    serializer_class = LeadSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("source", "status", "stage")

    def perform_destroy(self, instance):
        try:
            logger.info(f"Attempting to delete Lead {instance.id} (tenant={instance.tenant})")
            instance.delete()
            logger.info(f"Successfully deleted Lead {instance.id}")
        except Exception as e:
            logger.error(f"Error deleting lead {instance.id}: {e}")
            raise e

    def perform_create(self, serializer):
        # Assign tenant from request before saving
        tenant = getattr(self.request, 'tenant', None)
        if tenant:
            lead = serializer.save(tenant=tenant)
        else:
            lead = serializer.save()
        
        # Auto-call the lead via SmartFlow if they have a phone number
        if lead.phone:
            try:
                from .smartflo_api import initiate_smartflo_call, build_lead_context
                from .models import CallRecord
                
                # Build lead context for dynamic variables
                lead_context = build_lead_context(lead)
                
                # Format phone number for SmartFlow (no + prefix, with country code)
                phone = lead.phone.strip().replace(' ', '').replace('-', '').replace('+', '')
                if len(phone) == 10:
                    phone = '91' + phone
                
                # Build dynamic variables for ElevenLabs agent (via SmartFlow WebSocket)
                dynamic_vars = {
                    "counsellorName": "Cybric Assistant",
                    "name": lead.name or lead.first_name or "Student",
                    "preferredCountry": lead.preferred_country or lead.country or "",
                    "highestQualification": lead.highest_qualification or "",
                    "marksHighestQualification": lead.qualification_marks or "",
                    "yearCompletion": getattr(lead, 'year_completion', '') or "",
                    "ieltsPteStatus": lead.english_test_scores or "",
                }
                
                # Create call record with tenant
                call_record = CallRecord.objects.create(
                    tenant=tenant,  # Assign tenant to call record
                    lead=lead,
                    direction="outbound",
                    status="initiated",
                    provider="smartflo",
                    metadata={
                        "lead_id": str(lead.id),
                        "name": lead.name or lead.first_name,
                        "source": lead.source,
                        "dynamic_variables": dynamic_vars
                    }
                )
                
                # Initiate call via SmartFlow Voice Bot
                tenant_settings = getattr(lead.tenant, 'settings', None) if getattr(lead, 'tenant', None) else None
                
                result = initiate_smartflo_call(
                    destination_number=phone,
                    custom_params={
                        'lead_id': str(lead.id),
                        'call_record_id': str(call_record.id),
                        **dynamic_vars
                    },
                    tenant_settings=tenant_settings
                )
                
                if result.get('success'):
                    call_record.status = "in_progress"
                    call_record.external_call_id = result.get('call_sid')
                    call_record.metadata['call_sid'] = result.get('call_sid')
                    call_record.metadata['full_response'] = result.get('full_response')
                    logger.info(f"SmartFlow call initiated for lead {lead.id}: {result.get('call_sid')}")
                else:
                    call_record.status = "failed"
                    call_record.metadata['error'] = result.get('error')
                    call_record.metadata['full_response'] = result.get('full_response')
                    logger.error(f"SmartFlow call failed for lead {lead.id}: {result.get('error')}")
                
                call_record.save()
                
            except Exception as e:
                logger.exception(f"Failed to initiate SmartFlow call for lead {lead.id}: {e}")

    @action(detail=True, methods=["get"], url_path="activity")
    def activity(self, request, pk=None):
        """
        Fetch activity logs for this lead.
        """
        lead = self.get_object()
        from .models import AuditLog
        from .serializers import AuditLogSerializer
        
        # Get logs linked to this lead (via metadata or direct relation if added)
        logs = AuditLog.objects.filter(
            data__lead_id=str(lead.id)
        ).order_by("-created_at")[:50]
        
        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="generate-follow-ups")
    def generate_follow_ups(self, request, pk=None):
        """
        Analyze all transcripts for this lead and generate follow-up tasks.
        """
        lead = self.get_object()
        
        # Gather all transcripts from calls linked to this lead
        from .models import CallRecord
        calls = CallRecord.objects.filter(lead=lead).order_by("-created_at")
        
        full_transcript = ""
        
        for call in calls:
            text = None
            if call.transcripts.exists():
                text = call.transcripts.first().transcript_text
            elif call.metadata and call.metadata.get("transcript"):
                text = call.metadata.get("transcript")
            
            if text:
                date_str = call.created_at.strftime("%Y-%m-%d %H:%M")
                full_transcript += f"\n\n--- Call on {date_str} ---\n{text}"
        
        if not full_transcript:
            return Response({"error": "No transcripts found for this lead"}, status=status.HTTP_400_BAD_REQUEST)

        # Analyze
        try:
            from .services.ai_analyzer import CallAnalyzer
            from .tasks import calculate_follow_up_time
            
            logger.debug("Initializing CallAnalyzer...")
            analyzer = CallAnalyzer()
            logger.debug("Sending to AI...")
            analysis = analyzer.analyze_transcript(full_transcript, metadata={"lead_id": lead.id, "name": lead.first_name or lead.name})
            logger.debug(f"AI Analysis Result: {analysis}")
            
            created_tasks = []
            if analysis.get('follow_up', {}).get('needed'):
                priority = 'HIGH' if analysis.get('interest_level') == 'high' else 'MEDIUM'
                
                # Create FollowUp linked to Lead
                task = FollowUp.objects.create(
                    lead=None,  # FollowUp.lead points to Applicant, not Lead - we need to handle this
                    channel='phone' if analysis.get('interest_level') == 'high' else 'email',
                    notes=f"AI Recommendation: {analysis.get('follow_up', {}).get('reason', 'Follow-up needed')}",
                    due_at=calculate_follow_up_time(analysis.get('follow_up', {}).get('timing', '2 days')),
                    metadata={'created_by_ai': True, 'analysis': analysis, 'priority': priority, 'lead_id': lead.id}
                )
                created_tasks.append(task)
                
            return Response({
                "message": "Analysis complete", 
                "tasks_created": len(created_tasks),
                "analysis": analysis
            })
        except Exception as e:
            logger.exception(f"Error generating follow-ups: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CallRecordViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = CallRecord.objects.all().order_by("-created_at")
    serializer_class = CallRecordSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("status", "direction", "provider")

    def get_queryset(self):
        qs = super().get_queryset()
        lead_id = self.request.query_params.get("lead_id")
        if lead_id:
            lead_id = lead_id.strip("/")
            from django.db.models import Q
            qs = qs.filter(
                Q(lead_id=lead_id) | 
                Q(metadata__lead_id=str(lead_id)) |
                Q(metadata__lead_id=int(lead_id))
            )
            
        applicant_id = self.request.query_params.get("applicant_id")
        if applicant_id:
            applicant_id = applicant_id.strip("/")
            qs = qs.filter(applicant_id=applicant_id)
            
        return qs

    @action(detail=False, methods=["post"])
    def bulk_delete(self, request):
        """
        Bulk delete call records.
        Expects: { "ids": [1, 2, 3] }
        """
        ids = request.data.get("ids", [])
        if not ids or not isinstance(ids, list):
            return Response({"error": "Invalid IDs provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Filter by IDs and delete
        deleted_count, _ = CallRecord.objects.filter(id__in=ids).delete()
        return Response({"status": "deleted", "count": deleted_count})

    @action(detail=True, methods=["post"])
    def fetch_data(self, request, pk=None):
        """
        Manually trigger fetch of conversation data from ElevenLabs.
        Useful if webhook failed or was missed (e.g. localhost).
        """
        call = self.get_object()
        conversation_id = None
        
        if call.metadata:
            conversation_id = call.metadata.get("conversation_id")
            
        if not conversation_id:
            conversation_id = call.external_call_id
            
        if not conversation_id:
             return Response({"error": "No conversation ID found on call record"}, status=status.HTTP_400_BAD_REQUEST)
             
        # Trigger task
        from .tasks import fetch_and_store_conversation_task
        
        # Run synchronously if requested or for immediate feedback in dev
        if request.query_params.get("sync"):
             try:
                 fetch_and_store_conversation_task(call.id, conversation_id)
                 call.refresh_from_db()
                 return Response({"status": "completed", "transcript": call.transcripts.first().transcript_text if call.transcripts.exists() else None})
             except Exception as e:
                 return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Default async
        fetch_and_store_conversation_task.delay(call.id, conversation_id)
        return Response({"status": "fetching", "message": "Background fetch triggered"})


class FollowUpViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = FollowUp.objects.all().order_by("due_at")
    serializer_class = FollowUpSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("assigned_to", "completed", "channel", "application", "lead", "status")
    
    def create(self, request, *args, **kwargs):
        """
        Override create to:
        1. Default all follow-ups to AI call channel
        2. Add AI-powered task analysis and auto-scheduling
        3. Generate comprehensive call context for ElevenLabs
        """
        from .services.ai_task_scheduler import ai_scheduler
        from .services.followup_generator import followup_generator
        from rest_framework import status as http_status
        from django.utils import timezone
        from datetime import timedelta
        
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        notes = data.get('notes', '')
        channel = data.get('channel', 'ai_call')
        due_at = data.get('due_at')
        auto_analyze = data.pop('auto_analyze', True)
        applicant_id = data.get('lead') or data.get('applicant_id')
        
        ai_actions = []
        
        data['channel'] = 'ai_call'
        data['status'] = 'scheduled'
        if channel != 'ai_call':
            ai_actions.append("Set to AI call channel for automated follow-up")
        
        if notes and auto_analyze:
            analysis = ai_scheduler.analyze_task(notes, None, channel)
            
            if analysis['auto_schedule_at'] and not due_at:
                data['due_at'] = analysis['auto_schedule_at'].isoformat()
                ai_actions.append(f"AI auto-scheduled for {analysis['auto_schedule_at'].strftime('%Y-%m-%d %H:%M')}")
            
            if not data.get('metadata'):
                data['metadata'] = {}
            data['metadata']['ai_analysis'] = {
                'requires_call': analysis['requires_call'],
                'urgency': analysis['urgency'],
                'confidence': analysis['confidence'],
                'analysis_notes': analysis['analysis_notes'],
            }
        
        if not due_at and not data.get('due_at'):
            data['due_at'] = (timezone.now() + timedelta(minutes=30)).isoformat()
            ai_actions.append("Auto-scheduled in 30 minutes (default)")
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        task = serializer.instance
        if task.lead and data.get('channel') == 'ai_call':
            try:
                reason = data.get('metadata', {}).get('reason', 'general_followup')
                call_context = followup_generator.generate_call_context(
                    applicant=task.lead,
                    reason=reason,
                    notes=notes,
                    task=task,
                )
                task.metadata = task.metadata or {}
                task.metadata['call_context'] = call_context
                task.save(update_fields=['metadata'])
                ai_actions.append("Generated comprehensive call context for AI agent")
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error generating call context: {e}")
        
        response_data = serializer.data
        if ai_actions:
            response_data['ai_actions'] = ai_actions
        
        headers = self.get_success_headers(serializer.data)
        return Response(response_data, status=http_status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=True, methods=['post'])
    def trigger_call(self, request, pk=None):
        """Manually trigger an AI call for this task."""
        from .tasks import trigger_scheduled_ai_call
        
        result = trigger_scheduled_ai_call(pk)
        if result.get("ok"):
            return Response(result, status=status.HTTP_200_OK)
        return Response(result, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def smart_update(self, request, pk=None):
        """
        Intelligently update a task and analyze changes to determine automatic actions.
        AI-powered analysis determines what actions to take based on the changes.
        """
        from .tasks import trigger_scheduled_ai_call
        from django.utils.dateparse import parse_datetime
        from .services.ai_task_scheduler import ai_scheduler
        
        task = self.get_object()
        old_data = {
            "due_at": task.due_at.isoformat() if task.due_at else None,
            "channel": task.channel,
            "notes": task.notes,
            "lead_id": task.lead_id,
            "status": task.status,
            "completed": task.completed,
        }
        
        new_data = request.data
        actions_taken = []
        ai_analysis = []
        errors = []
        
        new_due_at = new_data.get('due_at')
        new_channel = new_data.get('channel')
        new_notes = new_data.get('notes')
        new_applicant_id = new_data.get('applicant_id')
        new_status = new_data.get('status')
        trigger_now = new_data.get('trigger_now', False)
        auto_analyze = new_data.get('auto_analyze', True)
        
        time_changed = False
        parsed_time = None
        if new_due_at:
            parsed_time = parse_datetime(new_due_at)
            if parsed_time:
                if task.due_at != parsed_time:
                    task.due_at = parsed_time
                    time_changed = True
                    actions_taken.append(f"Rescheduled to {parsed_time.strftime('%Y-%m-%d %H:%M')}")
                    ai_analysis.append({
                        "change": "schedule_time",
                        "old": old_data["due_at"],
                        "new": parsed_time.isoformat(),
                        "action": "time_updated"
                    })
            else:
                errors.append("Invalid date/time format")
        
        channel_changed = False
        if new_channel and new_channel != task.channel:
            old_channel = task.channel
            task.channel = new_channel
            channel_changed = True
            actions_taken.append(f"Channel changed from {old_channel} to {new_channel}")
            ai_analysis.append({
                "change": "channel",
                "old": old_channel,
                "new": new_channel,
                "action": "channel_updated"
            })
        
        if new_notes is not None and new_notes != task.notes:
            task.notes = new_notes
            actions_taken.append("Notes updated")
            
            if auto_analyze and new_notes:
                notes_analysis = ai_scheduler.analyze_task(new_notes, task.due_at, task.channel)
                ai_analysis.append({
                    "change": "notes_analyzed",
                    "requires_call": notes_analysis['requires_call'],
                    "urgency": notes_analysis['urgency'],
                    "parsed_time": notes_analysis['time_expression'],
                    "analysis": notes_analysis['analysis_notes']
                })
                
                if notes_analysis['requires_call'] and task.channel != 'ai_call':
                    task.channel = 'ai_call'
                    task.status = 'scheduled'
                    actions_taken.append("AI detected call requirement - switched to AI call channel")
                
                if notes_analysis['auto_schedule_at'] and not parsed_time:
                    task.due_at = notes_analysis['auto_schedule_at']
                    time_changed = True
                    actions_taken.append(f"AI auto-scheduled for {notes_analysis['auto_schedule_at'].strftime('%Y-%m-%d %H:%M')}")
        
        if new_applicant_id and new_applicant_id != task.lead_id:
            try:
                applicant = Applicant.objects.get(id=new_applicant_id)
                task.lead = applicant
                actions_taken.append(f"Applicant changed to {applicant.first_name} {applicant.last_name}")
                ai_analysis.append({
                    "change": "applicant",
                    "old": old_data["lead_id"],
                    "new": new_applicant_id,
                    "action": "applicant_updated"
                })
            except Applicant.DoesNotExist:
                errors.append("Applicant not found")
        
        if new_status and new_status != task.status:
            task.status = new_status
            actions_taken.append(f"Status changed to {new_status}")
        
        ai_action_result = None
        should_trigger_call = False
        trigger_error = None
        
        if task.channel == 'ai_call':
            if task.status in ['pending', 'scheduled', None]:
                if time_changed and parsed_time and parsed_time <= timezone.now():
                    should_trigger_call = True
                    ai_analysis.append({
                        "change": "auto_trigger",
                        "reason": "Scheduled time is now or in the past",
                        "action": "triggering_call"
                    })
                
                if trigger_now:
                    should_trigger_call = True
                    ai_analysis.append({
                        "change": "manual_trigger",
                        "reason": "User requested immediate call",
                        "action": "triggering_call"
                    })
                
                if channel_changed and new_channel == 'ai_call':
                    task.status = 'scheduled'
                    ai_analysis.append({
                        "change": "channel_to_ai",
                        "reason": "Changed to AI call channel",
                        "action": "status_set_scheduled"
                    })
        
        task.save()
        
        if should_trigger_call:
            if not task.lead:
                trigger_error = "No applicant linked to this task"
                actions_taken.append(f"AI call trigger skipped: {trigger_error}")
            elif not task.lead.phone:
                trigger_error = "Applicant has no phone number"
                actions_taken.append(f"AI call trigger skipped: {trigger_error}")
            else:
                ai_action_result = trigger_scheduled_ai_call(task.id)
                if ai_action_result.get("ok"):
                    actions_taken.append("AI call triggered automatically")
                else:
                    trigger_error = ai_action_result.get('error', 'Unknown error')
                    actions_taken.append(f"AI call trigger failed: {trigger_error}")
        
        applicant_name = None
        if task.lead:
            applicant_name = f"{task.lead.first_name} {task.lead.last_name}"
        
        return Response({
            "ok": True,
            "task_id": task.id,
            "actions_taken": actions_taken,
            "ai_analysis": ai_analysis,
            "ai_action_result": ai_action_result,
            "errors": errors,
            "trigger_error": trigger_error,
            "updated_task": {
                "id": task.id,
                "due_at": task.due_at.isoformat() if task.due_at else None,
                "channel": task.channel,
                "notes": task.notes,
                "status": task.status,
                "completed": task.completed,
                "applicant_name": applicant_name,
                "lead": task.lead_id,
            }
        }, status=status.HTTP_200_OK)


class ScheduleAICallView(APIView):
    """
    API endpoint to schedule an AI call for an applicant at a specific time.
    The call will be automatically triggered by ElevenLabs at the scheduled time.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        from .serializers import ScheduleAICallSerializer
        
        serializer = ScheduleAICallSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        applicant_id = serializer.validated_data['applicant_id']
        scheduled_time = serializer.validated_data['scheduled_time']
        notes = serializer.validated_data.get('notes', '')
        call_context = serializer.validated_data.get('call_context', {})
        
        # Validate applicant exists
        try:
            applicant = Applicant.objects.get(id=applicant_id)
        except Applicant.DoesNotExist:
            return Response({"error": "Applicant not found"}, status=status.HTTP_404_NOT_FOUND)
        
        if not applicant.phone:
            return Response({"error": "Applicant has no phone number"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create the scheduled follow-up task
        task = FollowUp.objects.create(
            lead=applicant,
            channel="ai_call",
            status="scheduled",
            due_at=scheduled_time,
            notes=notes,
            assigned_to=request.user if request.user.is_authenticated else None,
            metadata={
                "scheduled_by": request.user.username if request.user.is_authenticated else "system",
                "call_context": call_context,
                "scheduled_at": timezone.now().isoformat()
            }
        )
        
        return Response({
            "ok": True,
            "message": f"AI call scheduled for {scheduled_time.isoformat()}",
            "task_id": task.id,
            "applicant_name": f"{applicant.first_name} {applicant.last_name}",
            "phone": applicant.phone,
            "scheduled_time": scheduled_time.isoformat(),
            "status": "scheduled",
            "call_record": None,
            "call_record_id": None
        }, status=status.HTTP_201_CREATED)


class TriggerAICallNowView(APIView):
    """
    Immediately trigger an AI call to an applicant.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        from .tasks import schedule_elevenlabs_call
        
        applicant_id = request.data.get('applicant_id')
        notes = request.data.get('notes', '')
        
        if not applicant_id:
            return Response({"error": "applicant_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate applicant exists
        try:
            applicant = Applicant.objects.get(id=applicant_id)
        except Applicant.DoesNotExist:
            return Response({"error": "Applicant not found"}, status=status.HTTP_404_NOT_FOUND)
        
        if not applicant.phone:
            return Response({"error": "Applicant has no phone number"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Context for the call
        context = {
            "reason": "immediate_call",
            "task_notes": notes or "Immediate call requested by staff.",
        }
        
        # Trigger the call
        result = schedule_elevenlabs_call(applicant_id=applicant_id, extra_context=context)
        
        if result.get("ok"):
            return Response({
                "ok": True,
                "message": "AI call initiated successfully",
                "applicant_name": f"{applicant.first_name} {applicant.last_name}",
                "phone": applicant.phone
            }, status=status.HTTP_200_OK)
        
        return Response({
            "ok": False,
            "error": result.get("error", "Failed to initiate call")
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProcessDueAICallsView(APIView):
    """
    Manually trigger processing of all due AI calls.
    This is an alternative to relying on Celery Beat.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        from .tasks import check_and_initiate_followups
        
        # Run the task synchronously
        result = check_and_initiate_followups()
        
        return Response({
            "ok": True,
            "message": result
        }, status=status.HTTP_200_OK)


class SyncElevenLabsCallsView(APIView):
    """
    Sync all ElevenLabs conversations with local CallRecords.
    This fetches all recent calls from ElevenLabs API and syncs
    their recordings and transcripts to our database.
    
    Useful when:
    - Webhooks are missed (localhost development)
    - Need to manually fetch call data
    - Initial sync of existing ElevenLabs conversations
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        from .tasks import sync_all_elevenlabs_conversations
        
        hours_back = request.data.get("hours_back", 24)
        
        result = sync_all_elevenlabs_conversations(hours_back=hours_back)
        
        if result.get("ok"):
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class IsSuperUserOrAdminGroup(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_superuser or request.user.groups.filter(name='admin').exists())
        )


class StaffViewSet(viewsets.ModelViewSet):
    """
    Manage staff members (Users).
    Only accessible by admins (is_staff=True).
    Filtered by tenant to ensure data isolation.
    """
    serializer_class = UserSerializer
    authentication_classes = [JWTAuthFromCookie, SessionAuthentication, BasicAuthentication]
    
    def get_queryset(self):
        """Filter users by the current request's tenant via UserProfile."""
        tenant = getattr(self.request, 'tenant', None)
        
        if tenant:
            # Return users whose profile belongs to this tenant
            return User.objects.filter(profile__tenant=tenant).order_by("-date_joined")
        
        # If user is superuser without tenant, they can see all
        if self.request.user.is_authenticated and self.request.user.is_superuser:
            return User.objects.all().order_by("-date_joined")
        
        # No tenant and not superuser = no data (security)
        return User.objects.none()
    
    def get_permissions(self):
        """
        Allow listing to authenticated users (so they can see colleagues),
        but restrict create/update/delete to Admins only.
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperUserOrAdminGroup()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        role = serializer.validated_data.pop("role", "counsellor")
        user = serializer.save()
        user.set_password(self.request.data.get("password", "password123"))
        user.save()
        
        from django.contrib.auth.models import Group
        group, _ = Group.objects.get_or_create(name=role)
        user.groups.add(group)
        
        # Assign the new user to the current tenant
        tenant = getattr(self.request, 'tenant', None)
        if tenant:
            from crm_app.models import UserProfile
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.tenant = tenant
            profile.save()

    def perform_update(self, serializer):
        role = serializer.validated_data.pop("role", None)
        if not role and "role" in self.request.data:
            role = self.request.data["role"]

        user = serializer.save()
        if "password" in self.request.data:
            user.set_password(self.request.data["password"])
            user.save()
        
        if role:
            from django.contrib.auth.models import Group
            group, _ = Group.objects.get_or_create(name=role)
            user.groups.clear()
            user.groups.add(group)
class TranscriptASRCallback(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        """
        ASR provider posts transcribed text here.
        Expected payload: { "transcript_id": <id>, "transcript_text": "<text>" }
        """
        payload = _safe_json_parse(request.data)
        tid = payload.get("transcript_id")
        text = payload.get("transcript_text")
        if not tid or text is None:
            return Response({"error": "missing_fields"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            t = Transcript.objects.get(id=tid)
        except Transcript.DoesNotExist:
            return Response({"error": "transcript_not_found"}, status=status.HTTP_404_NOT_FOUND)

        t.transcript_text = text
        # Save safely
        try:
            if _field_exists(t, "transcript_text"):
                t.save(update_fields=["transcript_text"])
            else:
                t.save()
        except Exception:
            logger.exception("Failed to save transcript %s", tid)

        # enqueue extraction
        try:
            if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
                run_llm_extraction_task.apply(args=[str(t.application.id), str(t.id)])
            else:
                run_llm_extraction_task.delay(str(t.application.id), str(t.id))
        except Exception:
            logger.exception("Failed to queue LLM extraction for transcript=%s", t.id)

        return Response({"status": "ok", "transcript_id": str(t.id)})


class DashboardSummary(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        tenant = getattr(request, 'tenant', None)
        
        # Base querysets filtered by tenant
        if tenant:
            leads_qs = Lead.objects.filter(tenant=tenant)
            applicants_qs = Applicant.objects.filter(tenant=tenant)
            applications_qs = Application.objects.filter(tenant=tenant)
            followups_qs = FollowUp.objects.filter(tenant=tenant)
            call_records_qs = CallRecord.objects.filter(tenant=tenant)
        else:
            # Superuser without tenant can see all
            if user.is_superuser:
                leads_qs = Lead.objects.all()
                applicants_qs = Applicant.objects.all()
                applications_qs = Application.objects.all()
                followups_qs = FollowUp.objects.all()
                call_records_qs = CallRecord.objects.all()
            else:
                # No tenant = no data
                leads_qs = Lead.objects.none()
                applicants_qs = Applicant.objects.none()
                applications_qs = Application.objects.none()
                followups_qs = FollowUp.objects.none()
                call_records_qs = CallRecord.objects.none()
        
        # Global stats (for Admin/Admissions) - now tenant-filtered
        leads_count = applicants_qs.count() + leads_qs.count()
        applications_count = applications_qs.count()
        open_calls = Transcript.objects.filter(
            call__in=call_records_qs
        ).filter(Q(transcript_text__isnull=True) | Q(transcript_text="")).count()
        ai_pending = applications_qs.annotate(num_ai=Count("ai_results")).filter(num_ai=0).count()
        
        # Calculate conversion rate (accepted / total applications * 100)
        accepted_count = applications_qs.filter(status="accepted").count()
        conversion_rate_percent = 0
        if applications_count > 0:
            conversion_rate_percent = round((accepted_count / applications_count) * 100, 1)

        # Role-specific data
        # Counsellor: My Applicants, Followups, Pipeline
        my_applications = applications_qs.filter(assigned_to=user)
        my_total_applicants = my_applications.values("applicant").distinct().count()
        
        followups_due = followups_qs.filter(
            assigned_to=user, 
            completed=False, 
            due_at__lte=timezone.now()
        ).count()

        # Pipeline counts (by status)
        pipeline_counts = {}
        # Aggregate status counts for this user's applications
        status_counts = my_applications.values("status").annotate(count=Count("status"))
        for item in status_counts:
            pipeline_counts[item["status"]] = item["count"]
            
        # Recent Applicants (for Counsellor and Admin)
        # For Counsellor: only assigned to them. For Admin: all (within tenant).
        if user.is_superuser or user.groups.filter(name='admin').exists():
            recent_apps_qs = applications_qs.select_related("applicant").order_by("-created_at")[:5]
        else:
            recent_apps_qs = my_applications.select_related("applicant").order_by("-created_at")[:5]
            
        recent_applicants = []
        for app in recent_apps_qs:
            applicant = app.applicant
            recent_applicants.append({
                "id": applicant.id,
                "name": f"{applicant.first_name} {applicant.last_name or ''}".strip(),
                "email": applicant.email,
                "status": app.status,
                "date": app.created_at.isoformat()
            })

        # Admissions/Admin: Country & Intake Distribution
        # For now, return empty lists to prevent frontend crashes.
        country_distribution = [] 
        intake_distribution = []
        
        # Per Counselor Counts (Admin) - tenant filtered
        per_counselor_counts = []
        if user.is_superuser or user.groups.filter(name='admin').exists():
            counselor_stats = applications_qs.values("assigned_to__username").annotate(count=Count("id")).order_by("-count")
            for stat in counselor_stats:
                if stat["assigned_to__username"]:
                    per_counselor_counts.append({
                        "name": stat["assigned_to__username"],
                        "value": stat["count"]
                    })

        # Application Trends (Last 6 months) - tenant filtered
        from django.db.models.functions import TruncMonth
        trends_qs = applications_qs.annotate(month=TruncMonth('created_at')).values('month').annotate(count=Count('id')).order_by('month')
        
        application_trends = []
        for item in trends_qs:
            if item['month']:
                application_trends.append({
                    "label": item['month'].strftime("%b"),
                    "value": item['count']
                })
        
        # If empty, provide empty structure for chart safety
        if not application_trends:
             application_trends = []

        # User Distribution - tenant filtered
        student_count = applicants_qs.count()
        # Count staff in this tenant
        if tenant:
            from crm_app.models import UserProfile
            tenant_users = UserProfile.objects.filter(tenant=tenant).values_list('user_id', flat=True)
            counselor_count = User.objects.filter(id__in=tenant_users, groups__name__iexact="counsellor").count()
            admin_count = User.objects.filter(id__in=tenant_users).filter(
                Q(is_superuser=True) | Q(groups__name__iexact="admin")
            ).distinct().count()
        else:
            counselor_count = User.objects.filter(groups__name__iexact="counsellor").count()
            admin_count = User.objects.filter(Q(is_superuser=True) | Q(groups__name__iexact="admin")).distinct().count()
        
        user_distribution = [
            {"label": "Students", "value": student_count, "color": "#0B1F3A"},
            {"label": "Counselors", "value": counselor_count, "color": "#6FB63A"},
            {"label": "Admins", "value": admin_count, "color": "#E5E7EB"},
        ]

        # Funnel Data - tenant filtered
        total_leads = leads_count
        # Active Leads: Leads with high interest or good quality score from AI
        active_leads = leads_qs.filter(
            Q(call_records__ai_quality_score__gte=60) | 
            Q(call_records__ai_analysis_result__interest_level__in=['high', 'medium'])
        ).distinct().count()
        
        applicants_count = applicants_qs.count()
        applications_total = applications_count
        accepted_count = applications_qs.filter(status="accepted").count()
        
        funnel_data = [
            {"label": "Total Leads", "value": total_leads, "fill": "#8884d8"},
            {"label": "Active Leads", "value": active_leads, "fill": "#82ca9d"},
            {"label": "Applicants", "value": applicants_count, "fill": "#ffc658"},
            {"label": "Applications", "value": applications_total, "fill": "#ff8042"},
            {"label": "Accepted", "value": accepted_count, "fill": "#00C49F"},
        ]

        # Total users in tenant
        if tenant:
            total_users = UserProfile.objects.filter(tenant=tenant).count()
        else:
            total_users = User.objects.count()

        data = {
            # Global / Admin
            "leads_count": leads_count,
            "total_users": total_users,
            "total_applicants": leads_count, # Assuming Applicant ~= Lead/User for this metric
            "total_applications": applications_count,
            "open_calls": open_calls,
            "ai_pending": ai_pending,
            "conversion_rate_percent": conversion_rate_percent,
            "per_counselor_counts": per_counselor_counts,
            
            # Charts
            "application_trends": application_trends,
            "user_distribution": user_distribution,
            "funnel_data": funnel_data,
            
            # Counsellor
            "my_total_applicants": my_total_applicants,
            "followups_due": followups_due,
            "pipeline_counts": pipeline_counts,
            
            # Shared / Lists
            "recent_applicants": recent_applicants,
            
            # Admissions
            "country_distribution": country_distribution,
            "intake_distribution": intake_distribution,
        }
        return Response(data)


class ElevenLabsWebhookView(APIView):
    """
    Receives post-call webhooks from ElevenLabs (or Twilio bridge via Eleven).
    Expects JSON payload containing at least either:
      - call_id / conversation_id / external_call_id OR
      - metadata.lead_id (or lead_external_id)
    Verifies header secret and persists transcript/recording into CallRecord/Transcript.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not _verify_webhook_secret(request):
            logger.warning("ElevenLabs webhook unauthorized from %s", request.META.get("REMOTE_ADDR"))
            return Response({"detail": "unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        payload = _safe_json_parse(request.data)
        call_id = payload.get("call_id") or payload.get("conversation_id") or payload.get("external_call_id")
        lead_external_id = payload.get("lead_external_id") or payload.get("lead_id") or (payload.get("metadata") or {}).get("lead_id")
        transcript_text = payload.get("transcript") or payload.get("transcription") or payload.get("text")
        recording_url = payload.get("recording_url") or payload.get("recordingUrl") or payload.get("recording")
        duration = payload.get("duration")

        # Defensive DB operations
        call = None
        try:
            if call_id:
                call = CallRecord.objects.filter(external_call_id=call_id).first()
            if not call and lead_external_id:
                call = CallRecord.objects.filter(metadata__lead_external_id=lead_external_id).first()
        except Exception:
            logger.exception("CallRecord lookup failed for call_id=%s lead=%s", call_id, lead_external_id)

        # Find lead if available
        lead = None
        if lead_external_id:
            try:
                from .models import Lead  # import lazily if present
                lead = Lead.objects.filter(external_id=lead_external_id).first()
            except Exception:
                # it's okay if Lead model isn't present in your schema
                lead = None

        # Create call record if missing
        if not call:
            try:
                call = CallRecord.objects.create(
                    applicant=None,
                    provider="elevenlabs",
                    status="completed" if transcript_text else "created",
                    direction="outbound",
                    external_call_id=call_id,
                    recording_url=recording_url or "",
                    metadata={"lead_external_id": lead_external_id, "raw_payload": payload},
                )
            except Exception:
                logger.exception("Failed to create CallRecord for webhook payload: %s", payload)
                return Response({"ok": False, "error": "create_call_failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Persist transcript if present
        if transcript_text:
            try:
                tr = Transcript.objects.create(callrecord=call, text=transcript_text, created_at=timezone.now())
            except Exception:
                # if model fields differ, fallback to attaching to call
                logger.exception("Failed to create Transcript, attaching to CallRecord.raw_response")
                try:
                    call.metadata = call.metadata or {}
                    call.metadata["postcall_transcript"] = transcript_text
                except Exception:
                    logger.exception("Failed to attach transcript to call.metadata")

            # update call fields safely
            try:
                call.transcript = transcript_text
            except Exception:
                # some schemas store transcripts separately; ignore
                pass
            try:
                call.status = "completed"
            except Exception:
                pass

            # Save call defensively: update only existing fields
            try:
                update_fields = []
                for f in ("transcript", "status", "recording_url"):
                    if _field_exists(call, f):
                        update_fields.append(f)
                if update_fields:
                    call.save(update_fields=update_fields)
                else:
                    call.save()
            except Exception:
                logger.exception("Failed to save CallRecord after transcript")

            # enqueue processing task
            try:
                process_call_result.delay(call.id)
            except Exception:
                logger.exception("Failed to enqueue process_call_result for call %s", call.id)

        else:
            # no transcript: store raw payload for inspection
            try:
                call.metadata = call.metadata or {}
                call.metadata["last_webhook_payload"] = payload
                call.metadata["last_webhook_at"] = timezone.now().isoformat()
                # save metadata
                if _field_exists(call, "metadata"):
                    call.save(update_fields=["metadata"])
                else:
                    call.save()
            except Exception:
                logger.exception("Failed to save CallRecord metadata for webhook payload")

        return Response({"ok": True}, status=status.HTTP_200_OK)

def _check_static_secret(request) -> bool:
    """Check header X-Webhook-Secret against env/settings."""
    expected = getattr(settings, "ELEVENLABS_WEBHOOK_SECRET", "") or getattr(settings, "ELEVEN_WEBHOOK_SECRET", "")
    if not expected:
        # no secret configured — be permissive but warn
        logger.warning("No ELEVENLABS_WEBHOOK_SECRET configured; skipping header check")
        return True
    header = request.headers.get("X-Webhook-Secret") or request.META.get("HTTP_X_WEBHOOK_SECRET")
    if not header:
        return False
    return hmac.compare_digest(header, expected)

class ElevenLabsPostcallWebhook(APIView):
    permission_classes = [AllowAny]
    def post(self, request, *args, **kwargs):
        # DEBUG: Log immediately
        try:
            import os
            from django.conf import settings
            log_path = os.path.join(settings.BASE_DIR, "webhook_debug.log")
            with open(log_path, "a") as f:
                f.write(f"\n\n--- VIEW WEBHOOK RECEIVED AT: {timezone.now()} ---\n")
                f.write(f"Headers: {dict(request.headers)}\n")
                f.write(f"Body: {str(request.body)}\n")
                f.write(f"Data: {request.data}\n")
                f.write("\n------------------------------------------\n")
        except Exception as e:
            logger.error(f"Failed to write webhook log: {e}")

        # Basic auth check
        if not _check_static_secret(request):
            logger.warning("Rejected ElevenLabs webhook due to missing/invalid secret. Headers: %s", dict(request.headers))
            return Response({"detail": "invalid webhook secret"}, status=status.HTTP_401_UNAUTHORIZED)

        payload = request.data if hasattr(request, "data") else {}
        logger.info("Received ElevenLabs postcall webhook: keys=%s", list(payload.keys()))

        # Common fields ElevenLabs sends (inspect payload to confirm): callSid, conversation_id, recording_url, transcript_text, etc.
        callSid = payload.get("callSid") or payload.get("call_sid") or payload.get("CallSid")
        conversation_id = payload.get("conversation_id") or payload.get("conversationId")

        # attempt find CallRecord: try by callSid first, then by conversation_id, then by searching metadata
        call = None
        try:
            if callSid:
                call = CallRecord.objects.filter(external_call_id=callSid).first()
            if not call and conversation_id:
                call = CallRecord.objects.filter(metadata__conversation_id=conversation_id).first()
            if not call and callSid:
                # fallback: metadata might store callSid under diagnostics
                call = CallRecord.objects.filter(metadata__icontains=callSid).first()
            if not call and conversation_id:
                call = CallRecord.objects.filter(metadata__icontains=conversation_id).first()
        except Exception as e:
            logger.exception("Error querying CallRecord for webhook matching: %s", e)

        # Create conservative transcript content
        transcript_text = None
        # ElevenLabs may send transcript(s) under different keys; try common ones
        for k in ("transcript_text", "transcript", "text", "full_transcript", "transcripts"):
            if k in payload and payload.get(k):
                transcript_text = payload.get(k)
                break
        # If the webhook supplies ASR results as a dict/list, stringify
        if not transcript_text and payload.get("asr"):
            try:
                transcript_text = payload["asr"].get("transcript") or str(payload["asr"])
            except Exception:
                transcript_text = str(payload.get("asr"))

        # Recording url (if any)
        recording_url = payload.get("recording_url") or payload.get("recordingUrl") or payload.get("recording_uri")

        if not call:
            # No matching CallRecord found; create a diagnostic-only CallRecord so we can correlate manually
            try:
                call = CallRecord.objects.create(
                    applicant=None,
                    status="webhook_received_without_match",
                    provider="elevenlabs",
                    direction="inbound",
                    metadata={
                        "raw_webhook": payload,
                        "received_at": timezone.now().isoformat(),
                    },
                )
                logger.warning("Created diagnostic CallRecord id=%s for unmatched webhook", call.id)
            except Exception:
                logger.exception("Failed to create diagnostic CallRecord for unmatched webhook")
                return Response({"ok": False, "detail": "no matching call and failed to create diagnostic"}, status=500)

        # Save recording_url and update status
        try:
            if recording_url:
                call.recording_url = recording_url
        except Exception:
            logger.exception("Failed to set recording_url on CallRecord %s", getattr(call, "id", None))

        # Create Transcript if we have text
        transcript = None
        try:
            if transcript_text:
                transcript = Transcript.objects.create(
                    call=call,
                    transcript_text=transcript_text,
                    asr_provider="elevenlabs",
                    metadata=payload,
                )
                logger.info("Saved Transcript id=%s for call id=%s", transcript.id, call.id)
            else:
                # no transcript text — still save raw payload into metadata for debugging
                call.metadata = call.metadata or {}
                call.metadata.setdefault("webhook_payloads", [])
                call.metadata["webhook_payloads"].append({"at": timezone.now().isoformat(), "payload": payload})
        except Exception:
            logger.exception("Failed to create Transcript for call id=%s", getattr(call, "id", None))

        # Update call status to completed / or keep initiated if still ongoing
        try:
            call.status = "completed" if payload.get("call_status") in ("completed", "ended", "hangup") or payload.get("success") else call.status
            call.save()
        except Exception:
            logger.exception("Failed to update CallRecord %s", getattr(call, "id", None))

        # Enqueue post-processing task (AI extraction) if transcript present or call completed
        try:
            # call.id should exist
            if transcript or payload.get("call_status") in ("completed", "ended", "hangup") or payload.get("success"):
                # use Celery if available; apply_async will work even if tasks are eager
                process_call_result.apply_async(args=[call.id])
                logger.info("Enqueued process_call_result for call id=%s", call.id)
        except Exception:
            logger.exception("Failed to enqueue process_call_result for call id=%s", call.id)

        return Response({"ok": True, "call_id": call.id})

        # Persist transcript if present
        if transcript_text:
            try:
                tr = Transcript.objects.create(callrecord=call, text=transcript_text, created_at=timezone.now())
            except Exception:
                # if model fields differ, fallback to attaching to call
                logger.exception("Failed to create Transcript, attaching to CallRecord.raw_response")
                try:
                    call.metadata = call.metadata or {}
                    call.metadata["postcall_transcript"] = transcript_text
                except Exception:
                    logger.exception("Failed to attach transcript to call.metadata")

            # update call fields safely
            try:
                call.transcript = transcript_text
            except Exception:
                # some schemas store transcripts separately; ignore
                pass
            try:
                call.status = "completed"
            except Exception:
                pass

            # Save call defensively: update only existing fields
            try:
                update_fields = []
                for f in ("transcript", "status", "recording_url"):
                    if _field_exists(call, f):
                        update_fields.append(f)
                if update_fields:
                    call.save(update_fields=update_fields)
                else:
                    call.save()
            except Exception:
                logger.exception("Failed to save CallRecord after transcript")

            # enqueue processing task
            try:
                process_call_result.delay(call.id)
            except Exception:
                logger.exception("Failed to enqueue process_call_result for call %s", call.id)

        else:
            # no transcript: store raw payload for inspection
            try:
                call.metadata = call.metadata or {}
                call.metadata["last_webhook_payload"] = payload
                call.metadata["last_webhook_at"] = timezone.now().isoformat()
                # save metadata
                if _field_exists(call, "metadata"):
                    call.save(update_fields=["metadata"])
                else:
                    call.save()
            except Exception:
                logger.exception("Failed to save CallRecord metadata for webhook payload")

        return Response({"ok": True}, status=status.HTTP_200_OK)

def _check_static_secret(request) -> bool:
    """Check header X-Webhook-Secret against env/settings."""
    expected = getattr(settings, "ELEVENLABS_WEBHOOK_SECRET", "") or getattr(settings, "ELEVEN_WEBHOOK_SECRET", "")
    if not expected:
        # no secret configured — be permissive but warn
        logger.warning("No ELEVENLABS_WEBHOOK_SECRET configured; skipping header check")
        return True
    header = request.headers.get("X-Webhook-Secret") or request.META.get("HTTP_X_WEBHOOK_SECRET")
    if not header:
        return False
    return hmac.compare_digest(header, expected)

class ElevenLabsPostcallWebhook(APIView):
    permission_classes = [AllowAny]
    def post(self, request, *args, **kwargs):
        # DEBUG: Log immediately
        try:
            import os
            from django.conf import settings
            log_path = os.path.join(settings.BASE_DIR, "webhook_debug.log")
            with open(log_path, "a") as f:
                f.write(f"\n\n--- VIEW WEBHOOK RECEIVED AT: {timezone.now()} ---\n")
                f.write(f"Headers: {dict(request.headers)}\n")
                f.write(f"Body: {str(request.body)}\n")
                f.write(f"Data: {request.data}\n")
                f.write("\n------------------------------------------\n")
        except Exception as e:
            logger.error(f"Failed to write webhook log: {e}")

        # Basic auth check
        if not _check_static_secret(request):
            logger.warning("Rejected ElevenLabs webhook due to missing/invalid secret. Headers: %s", dict(request.headers))
            return Response({"detail": "invalid webhook secret"}, status=status.HTTP_401_UNAUTHORIZED)

        payload = request.data if hasattr(request, "data") else {}
        logger.info("Received ElevenLabs postcall webhook: keys=%s", list(payload.keys()))

        # Common fields ElevenLabs sends (inspect payload to confirm): callSid, conversation_id, recording_url, transcript_text, etc.
        callSid = payload.get("callSid") or payload.get("call_sid") or payload.get("CallSid")
        conversation_id = payload.get("conversation_id") or payload.get("conversationId")

        # attempt find CallRecord: try by callSid first, then by conversation_id, then by searching metadata
        call = None
        try:
            if callSid:
                call = CallRecord.objects.filter(external_call_id=callSid).first()
            if not call and conversation_id:
                call = CallRecord.objects.filter(metadata__conversation_id=conversation_id).first()
            if not call and callSid:
                # fallback: metadata might store callSid under diagnostics
                call = CallRecord.objects.filter(metadata__icontains=callSid).first()
            if not call and conversation_id:
                call = CallRecord.objects.filter(metadata__icontains=conversation_id).first()
        except Exception as e:
            logger.exception("Error querying CallRecord for webhook matching: %s", e)

        # Create conservative transcript content
        transcript_text = None
        # ElevenLabs may send transcript(s) under different keys; try common ones
        for k in ("transcript_text", "transcript", "text", "full_transcript", "transcripts"):
            if k in payload and payload.get(k):
                transcript_text = payload.get(k)
                break
        # If the webhook supplies ASR results as a dict/list, stringify
        if not transcript_text and payload.get("asr"):
            try:
                transcript_text = payload["asr"].get("transcript") or str(payload["asr"])
            except Exception:
                transcript_text = str(payload.get("asr"))

        # Recording url (if any)
        recording_url = payload.get("recording_url") or payload.get("recordingUrl") or payload.get("recording_uri")

        if not call:
            # No matching CallRecord found; create a diagnostic-only CallRecord so we can correlate manually
            try:
                call = CallRecord.objects.create(
                    applicant=None,
                    status="webhook_received_without_match",
                    provider="elevenlabs",
                    direction="inbound",
                    metadata={
                        "raw_webhook": payload,
                        "received_at": timezone.now().isoformat(),
                    },
                )
                logger.warning("Created diagnostic CallRecord id=%s for unmatched webhook", call.id)
            except Exception:
                logger.exception("Failed to create diagnostic CallRecord for unmatched webhook")
                return Response({"ok": False, "detail": "no matching call and failed to create diagnostic"}, status=500)

        # Save recording_url and update status
        try:
            if recording_url:
                call.recording_url = recording_url
        except Exception:
            logger.exception("Failed to set recording_url on CallRecord %s", getattr(call, "id", None))

        # Create Transcript if we have text
        transcript = None
        try:
            if transcript_text:
                transcript = Transcript.objects.create(
                    call=call,
                    transcript_text=transcript_text,
                    asr_provider="elevenlabs",
                    metadata=payload,
                )
                logger.info("Saved Transcript id=%s for call id=%s", transcript.id, call.id)
            else:
                # no transcript text — still save raw payload into metadata for debugging
                call.metadata = call.metadata or {}
                call.metadata.setdefault("webhook_payloads", [])
                call.metadata["webhook_payloads"].append({"at": timezone.now().isoformat(), "payload": payload})
        except Exception:
            logger.exception("Failed to create Transcript for call id=%s", getattr(call, "id", None))

        # Update call status to completed / or keep initiated if still ongoing
        try:
            call.status = "completed" if payload.get("call_status") in ("completed", "ended", "hangup") or payload.get("success") else call.status
            call.save()
        except Exception:
            logger.exception("Failed to update CallRecord %s", getattr(call, "id", None))

        # Enqueue post-processing task (AI extraction) if transcript present or call completed
        try:
            # call.id should exist
            if transcript or payload.get("call_status") in ("completed", "ended", "hangup") or payload.get("success"):
                # use Celery if available; apply_async will work even if tasks are eager
                process_call_result.apply_async(args=[call.id])
                logger.info("Enqueued process_call_result for call id=%s", call.id)
        except Exception:
            logger.exception("Failed to enqueue process_call_result for call id=%s", call.id)

        return Response({"ok": True, "call_id": call.id})

class ReportsSummary(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from django.db.models import Sum, Avg, Count, Q
        from .models import Lead, Applicant, Application, CallRecord, Document, FollowUp, Transcript

        # 1. Application Growth (Last 6 Months)
        six_months_ago = timezone.now() - timedelta(days=180)
        monthly_apps = (
            Application.objects.filter(created_at__gte=six_months_ago)
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )
        
        application_growth = []
        for entry in monthly_apps:
            application_growth.append({
                "label": entry['month'].strftime("%b"),
                "value": entry['count']
            })
            
        if not application_growth:
            for i in range(5, -1, -1):
                d = timezone.now() - timedelta(days=i*30)
                application_growth.append({"label": d.strftime("%b"), "value": 0})

        # 2. Call Outcomes (This Month)
        this_month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        call_stats = (
            CallRecord.objects.filter(created_at__gte=this_month_start)
            .values('status')
            .annotate(count=Count('id'))
        )
        
        call_outcomes = []
        status_colors = {
            "completed": "#6FB63A", # Green
            "no-answer": "#F59E0B", # Amber
            "failed": "#EF4444",    # Red
            "busy": "#EF4444",
            "initiated": "#3B82F6"  # Blue
        }
        
        for stat in call_stats:
            status = stat['status'] or "unknown"
            call_outcomes.append({
                "label": status.title(),
                "value": stat['count'],
                "color": status_colors.get(status, "#9CA3AF")
            })
            
        if not call_outcomes:
             call_outcomes = [{"label": "No Calls", "value": 0, "color": "#E5E7EB"}]

        # 3. Lead Sources
        lead_source_stats = (
            Lead.objects.values('source')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        lead_sources = []
        source_colors = ["#0B1F3A", "#6FB63A", "#3B82F6", "#F59E0B", "#8B5CF6"]
        for i, stat in enumerate(lead_source_stats):
            lead_sources.append({
                "label": stat['source'] or "Unknown",
                "value": stat['count'],
                "color": source_colors[i % len(source_colors)]
            })
        if not lead_sources:
            lead_sources = [{"label": "No Data", "value": 0, "color": "#E5E7EB"}]

        # 4. Conversion Funnel
        total_leads = Lead.objects.count()
        total_applicants = Applicant.objects.count()
        total_applications = Application.objects.count()
        total_enrolled = Application.objects.filter(status='accepted').count()
        
        conversion_funnel = [
            {"label": "Total Leads", "value": total_leads, "color": "#3B82F6"},
            {"label": "Applicants", "value": total_applicants, "color": "#8B5CF6"},
            {"label": "Applications", "value": total_applications, "color": "#F59E0B"},
            {"label": "Enrolled", "value": total_enrolled, "color": "#6FB63A"},
        ]

        # 5. Counselor Performance
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        counselor_stats = []
        users = User.objects.all()
        for user in users:
            assigned_leads = Lead.objects.filter(assigned_to=user).count()
            calls_made = CallRecord.objects.filter(lead__assigned_to=user).count()
            apps_managed = Application.objects.filter(assigned_to=user).count()
            
            if assigned_leads > 0 or calls_made > 0 or apps_managed > 0:
                counselor_stats.append({
                    "name": f"{user.first_name} {user.last_name}".strip() or user.username,
                    "leads_assigned": assigned_leads,
                    "calls_made": calls_made,
                    "applications": apps_managed,
                    "conversion_rate": round((apps_managed / assigned_leads * 100), 1) if assigned_leads > 0 else 0
                })
        
        counselor_stats.sort(key=lambda x: x['calls_made'], reverse=True)

        # 6. AI Usage Metrics
        ai_calls = CallRecord.objects.filter(ai_analyzed=True)
        total_cost = ai_calls.aggregate(Sum('cost'))['cost__sum'] or 0.0
        total_duration = ai_calls.aggregate(Sum('duration_seconds'))['duration_seconds__sum'] or 0
        avg_duration = ai_calls.aggregate(Avg('duration_seconds'))['duration_seconds__avg'] or 0
        
        ai_usage = {
            "total_cost": round(total_cost, 2),
            "total_duration_mins": round(total_duration / 60, 1),
            "avg_duration_secs": round(avg_duration, 0),
            "total_analyzed_calls": ai_calls.count()
        }

        # 7. Demographics (City/Country)
        city_stats = Lead.objects.values('city').annotate(count=Count('id')).order_by('-count')[:5]
        demographics = []
        for stat in city_stats:
            if stat['city']:
                demographics.append({"label": stat['city'], "value": stat['count']})
        
        # 8. Document Status
        doc_stats = Document.objects.values('status').annotate(count=Count('id'))
        document_status = []
        for stat in doc_stats:
            document_status.append({"label": stat['status'].title(), "value": stat['count']})

        # 9. Task Completion
        task_stats = FollowUp.objects.values('completed').annotate(count=Count('id'))
        task_completion = []
        for stat in task_stats:
            label = "Completed" if stat['completed'] else "Pending"
            task_completion.append({"label": label, "value": stat['count']})

        # 10. Available Reports (Mocked)
        available_reports = [
            {"name": "Weekly Admissions Summary", "date": timezone.now().strftime("%b %d, %Y"), "size": "2.4 MB", "type": "PDF"},
            {"name": "Counselor Performance Review", "date": (timezone.now() - timedelta(days=1)).strftime("%b %d, %Y"), "size": "1.1 MB", "type": "XLSX"},
            {"name": "Lead Source Analysis", "date": (timezone.now() - timedelta(days=2)).strftime("%b %d, %Y"), "size": "856 KB", "type": "PDF"},
            {"name": "Monthly Call Logs", "date": (timezone.now() - timedelta(days=5)).strftime("%b %d, %Y"), "size": "5.2 MB", "type": "CSV"},
        ]

        return Response({
            "application_growth": application_growth,
            "call_outcomes": call_outcomes,
            "lead_sources": lead_sources,
            "conversion_funnel": conversion_funnel,
            "counselor_stats": counselor_stats,
            "ai_usage": ai_usage,
            "demographics": demographics,
            "document_status": document_status,
            "task_completion": task_completion,
            "available_reports": available_reports,
            "total_applications": Application.objects.count()
        })
