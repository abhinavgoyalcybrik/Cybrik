# crm_app/serializers.py
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from rest_framework import serializers
import logging

from .models import (
    Applicant,
    CallRecord,
    AcademicRecord,
    Application,
    Transcript,
    AIResult,
    OutboundMessage,
    ConsentRecord,
    AuditLog,
    Lead,
    FollowUp,
    Document,
    Role,
    UserProfile,
    Notification,
    AdIntegration,
    AdIntegration,
    AdCampaign,
    WhatsAppMessage,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class UserSerializer(serializers.ModelSerializer):
    role_name = serializers.SerializerMethodField()
    role_id = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    sidebar_config = serializers.SerializerMethodField()
    dashboard_config = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name", 
            "is_staff", "is_superuser", "date_joined",
            "role_name", "role_id", "permissions", "sidebar_config", "dashboard_config"
        ]
        read_only_fields = ("id", "date_joined")

    def get_role_name(self, obj):
        try:
            return obj.profile.role.name if obj.profile and obj.profile.role else None
        except UserProfile.DoesNotExist:
            return None

    def get_role_id(self, obj):
        try:
            return obj.profile.role.id if obj.profile and obj.profile.role else None
        except UserProfile.DoesNotExist:
            return None

    def get_permissions(self, obj):
        try:
            return obj.profile.role.permissions if obj.profile and obj.profile.role else {}
        except UserProfile.DoesNotExist:
            return {}

    def get_sidebar_config(self, obj):
        # 1. Start with Role config
        config = {}
        try:
            if obj.profile and obj.profile.role:
                config = obj.profile.role.sidebar_config or {}
        except UserProfile.DoesNotExist:
            pass

        # 2. Merge User Preference (overrides role)
        try:
            # Avoid circular import
            from .models import UserDashboardPreference
            pref = UserDashboardPreference.objects.get(user=obj)
            if pref.layout_config and isinstance(pref.layout_config, dict):
                user_sidebar = pref.layout_config.get("sidebar_config", {})
                if user_sidebar:
                    config = {**config, **user_sidebar}
        except UserDashboardPreference.DoesNotExist:
            pass
            
        return config

    def get_dashboard_config(self, obj):
        try:
            return obj.profile.role.dashboard_config if obj.profile and obj.profile.role else {}
        except UserProfile.DoesNotExist:
            return {}


class KPIOverviewSerializer(serializers.Serializer):
    leads_assigned = serializers.IntegerField()
    followups_due = serializers.IntegerField()
    pipeline_counts = serializers.DictField(child=serializers.IntegerField())
    conversion_rate = serializers.FloatField()
    total_applications = serializers.IntegerField()
    country_distribution = serializers.ListField(child=serializers.DictField())


class ApplicantSerializer(serializers.ModelSerializer):
    academic_records = serializers.SerializerMethodField(read_only=True)
    documents = serializers.SerializerMethodField(read_only=True)
    whatsapp_messages = serializers.SerializerMethodField(read_only=True)
    highest_qualification = serializers.CharField(required=False, allow_blank=True, write_only=True)
    qualification_marks = serializers.CharField(required=False, allow_blank=True, write_only=True)
    english_test_scores = serializers.CharField(required=False, allow_blank=True, write_only=True)
    leadId = serializers.IntegerField(required=False, write_only=True)

    class Meta:
        model = Applicant
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "dob",
            "passport_number",
            "lead",
            "stage",
            "address",
            "preferred_country",
            "created_at",
            "updated_at",
            "academic_records",
            "documents",
            "highest_qualification",
            "qualification_marks",
            "english_test_scores",
            "leadId",
            "metadata",
            "tenant",  # Added to ensure tenant assignment works
            "whatsapp_messages",
        ]
        read_only_fields = ("created_at", "updated_at")
        extra_kwargs = {
            "tenant": {"required": False, "allow_null": True},  # Allow setting tenant via save()
        }


    def create(self, validated_data):
        highest_qualification = validated_data.pop('highest_qualification', None)
        qualification_marks = validated_data.pop('qualification_marks', None)
        english_test_scores = validated_data.pop('english_test_scores', None)
        # Pop leadId but DO NOT link lead FK here - this is handled by the view
        # Reason: Lead.on_delete=CASCADE means if we link lead here and then delete it,
        # the applicant will be cascade-deleted. View handles conversion safely.
        validated_data.pop('leadId', None)
        # Also explicitly remove 'lead' if it was passed, as view handles this
        validated_data.pop('lead', None)
        
        metadata = validated_data.get('metadata') or {}
        if highest_qualification:
            metadata['highest_qualification'] = highest_qualification
        if qualification_marks:
            metadata['qualification_marks'] = qualification_marks
        if english_test_scores:
            metadata['english_test_scores'] = english_test_scores
        validated_data['metadata'] = metadata
        
        return super().create(validated_data)

    def get_documents(self, obj):
        qs = getattr(obj, "documents", None)
        if not qs:
            return []
        return DocumentSerializer(qs.all(), many=True, context=self.context).data

    def get_academic_records(self, obj):
        """
        Safely return related academic records. Handles both explicit related_name
        and default '<model>_set' patterns.
        """
        qs = getattr(obj, "academic_records", None)
        if qs is None:
            qs = getattr(obj, "academicrecord_set", None)
        if not qs:
            return []
        # Local import to avoid circular import at module import time
        from .serializers import AcademicRecordSerializer  # type: ignore

        try:
            return AcademicRecordSerializer(qs.all(), many=True, context=self.context).data
        except Exception:
            # Defensive fallback: return empty list on schema mismatch
            logger.exception("Error serializing academic records for Applicant %s", getattr(obj, "id", None))
            return []

    def get_whatsapp_messages(self, obj):
        qs = getattr(obj, "whatsapp_messages", None)
        if not qs:
            return []
        return WhatsAppMessageSerializer(qs.all(), many=True, context=self.context).data



class AcademicRecordSerializer(serializers.ModelSerializer):
    lead = serializers.PrimaryKeyRelatedField(queryset=Lead.objects.all(), required=False, allow_null=True)

    class Meta:
        model = AcademicRecord
        fields = [
            "id",
            "lead",
            "institution",
            "degree",
            "start_year",
            "end_year",
            "year_of_completion",
            "grade",
            "score",
            "created_at",
        ]
        read_only_fields = ("created_at",)


class DocumentSerializer(serializers.ModelSerializer):
    lead = serializers.PrimaryKeyRelatedField(queryset=Lead.objects.all(), required=False, allow_null=True)

    class Meta:
        model = Document
        fields = [
            "id",
            "lead",
            "document_type",
            "file",
            "status",
            "notes",
            "created_at",
        ]
        read_only_fields = ("created_at",)


class ApplicationSerializer(serializers.ModelSerializer):
    applicant = ApplicantSerializer(read_only=True)
    applicant_id = serializers.PrimaryKeyRelatedField(
        source="applicant", queryset=Applicant.objects.all(), write_only=True, required=False
    )
    # Display fields for frontend
    applicant_name = serializers.SerializerMethodField()
    applicant_email = serializers.SerializerMethodField()
    stage_display = serializers.SerializerMethodField()
    priority_display = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    documents_count = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id",
            "applicant",
            "applicant_id",
            "applicant_name",
            "applicant_email",
            "lead",
            "program",
            "status",
            "stage",
            "stage_display",
            "priority",
            "priority_display",
            "university_name",
            "intake",
            "visa_interview_date",
            "metadata",
            "assigned_to",
            "assigned_to_name",
            "documents_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ("created_at", "updated_at")

    def get_applicant_name(self, obj):
        if obj.applicant:
            return f"{obj.applicant.first_name} {obj.applicant.last_name or ''}".strip()
        elif obj.lead:
            return obj.lead.name or "Unknown"
        return "Unknown"

    def get_applicant_email(self, obj):
        if obj.applicant:
            return obj.applicant.email
        elif obj.lead:
            return obj.lead.email
        return None

    def get_stage_display(self, obj):
        return obj.get_stage_display() if hasattr(obj, 'get_stage_display') else obj.stage

    def get_priority_display(self, obj):
        return obj.get_priority_display() if hasattr(obj, 'get_priority_display') else obj.priority

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None

    def get_documents_count(self, obj):
        if obj.applicant:
            return obj.applicant.documents.count()
        elif obj.lead:
            return obj.lead.documents.count()
        return 0


class TranscriptSerializer(serializers.ModelSerializer):
    application = serializers.PrimaryKeyRelatedField(read_only=True)
    call = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Transcript
        fields = [
            "id",
            "call",
            "application",
            "transcript_text",
            "asr_provider",
            "metadata",
            "created_at",
        ]
        read_only_fields = ("id", "created_at")


class AIResultSerializer(serializers.ModelSerializer):
    application = serializers.PrimaryKeyRelatedField(read_only=True)
    call_id = serializers.PrimaryKeyRelatedField(source='call', read_only=True)
    transcript = serializers.SerializerMethodField()

    class Meta:
        model = AIResult
        fields = [
            "id",
            "application",
            "call_id",
            "payload",
            "extractor_version",
            "confidence",
            "created_at",
            "transcript",
        ]
        read_only_fields = ("id", "created_at")

    def get_transcript(self, obj):
        if obj.call:
            # Return the first transcript text if available
            transcript = obj.call.transcripts.first()
            if transcript:
                return transcript.transcript_text
        return None


class OutboundMessageSerializer(serializers.ModelSerializer):
    application = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = OutboundMessage
        fields = [
            "id",
            "application",
            "channel",
            "body",
            "status",
            "provider_id",
            "created_at",
        ]
        read_only_fields = ("id", "created_at")


class ConsentRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsentRecord
        fields = [
            "id",
            "applicant",
            "consent_text",
            "consent_given",
            "consented_at",
            "recorded_by",
        ]
        read_only_fields = ("id",)


class AuditLogSerializer(serializers.ModelSerializer):
    ip = serializers.CharField(allow_null=True, required=False)
    
    class Meta:
        model = AuditLog
        fields = ["id", "actor", "action", "target_type", "target_id", "applicant", "data", "ip", "notes", "created_at"]
        read_only_fields = ("id", "created_at")


class StartVoiceCallSerializer(serializers.Serializer):
    """
    Serializer used by APIs that initiate a voice call.
    Accepts phone_number and optional caller_id, agent_id and metadata (dict or JSON string).
    """
    phone_number = serializers.CharField(required=False, allow_blank=True)
    caller_id = serializers.CharField(required=False, allow_blank=True)
    agent_id = serializers.CharField(required=False, allow_blank=True)
    metadata = serializers.JSONField(required=False)

    def validate(self, data):
        # Ensure phone number is provided either here or upstream
        phone = data.get("phone_number")
        if not phone:
            # we allow missing here because views may supply phone from model; leave validation to view
            return data
        # simple normalize: strip spaces
        data["phone_number"] = phone.strip()
        return data


class LeadReceiveSerializer(serializers.Serializer):
    """
    Lightweight serializer for inbound lead webhooks.
    If a Lead model exists in crm_app.models, create & return it; otherwise return validated_data.
    """
    external_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    source = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    message = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    raw_payload = serializers.JSONField(required=False, allow_null=True)

    def create(self, validated_data):
        """
        Try to persist to Lead model if available and fields match.
        If Lead model isn't present or create fails due to unique constraint, return existing lead or validated_data.
        This implementation is defensive:
         - only passes allowed fields to Lead.objects.create()
         - uses get_or_create when external_id provided to avoid UNIQUE race
         - uses transaction.atomic + IntegrityError handling
         - logs unexpected exceptions for easier debugging
        """
        try:
            from .models import Lead
        except Exception:
            logger.debug("Lead model not available; returning validated_data")
            return validated_data

        # Determine which fields exist on the Lead model to avoid unexpected kwargs
        lead_field_names = {f.name for f in Lead._meta.get_fields() if getattr(f, "editable", True)}
        lead_fields = {}
        # Prefer a specific set of inbound keys; any unexpected fields can be shoved into raw_payload
        inbound_keys = ("external_id", "name", "email", "phone", "source", "message", "raw_payload")
        raw_extra = {}

        for k in inbound_keys:
            if k in validated_data:
                if k in lead_field_names:
                    lead_fields[k] = validated_data[k]
                else:
                    raw_extra[k] = validated_data[k]

        # If there are extra keys not in Lead fields, merge them into raw_payload (if model supports it)
        if raw_extra:
            if "raw_payload" in lead_field_names:
                lead_fields.setdefault("raw_payload", {})  # ensure a dict
                # merge existing raw_payload if provided
                if isinstance(lead_fields.get("raw_payload"), dict):
                    lead_fields["raw_payload"].update(raw_extra)
                else:
                    lead_fields["raw_payload"] = {**(lead_fields.get("raw_payload") or {}), **raw_extra}

        try:
            with transaction.atomic():
                # If external_id present, prefer get_or_create to avoid unique constraint errors
                if lead_fields.get("external_id"):
                    obj, created = Lead.objects.get_or_create(
                        external_id=lead_fields["external_id"], defaults=lead_fields
                    )
                    return obj

                # Attempt to create a new Lead with allowed fields
                lead = Lead.objects.create(**lead_fields)
                return lead
        except IntegrityError as ie:
            # Unique constraint raced or another process created it — try to fetch existing
            logger.warning("IntegrityError while creating Lead: %s", ie)
            try:
                if lead_fields.get("external_id"):
                    existing = Lead.objects.filter(external_id=lead_fields["external_id"]).first()
                    if existing:
                        return existing
            except Exception:
                logger.exception("Error while retrieving existing Lead after IntegrityError")
            # fallback: return validated_data so the caller can process
            return validated_data
        except Exception as e:
            # any other failure: log and return validated_data
            logger.exception("Unexpected error while creating Lead: %s", e)
            return validated_data


class CallRecordSerializer(serializers.ModelSerializer):
    transcripts = TranscriptSerializer(many=True, read_only=True)
    applicant = ApplicantSerializer(read_only=True)
    application = serializers.SerializerMethodField()
    conversation_id = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()
    elevenlabs_summary = serializers.SerializerMethodField()

    class Meta:
        model = CallRecord
        fields = ['id', 'applicant', 'lead', 'application', 'provider', 'external_call_id', 'recording_url', 'conversation_id', 'phone_number', 'metadata', 'qualified_data', 'cost', 'currency', 'created_at', 'status', 'direction', 'duration_seconds', 'transcripts', 'elevenlabs_summary']

    def get_conversation_id(self, obj):
        # Try to get conversation_id from metadata first (ElevenLabs)
        if obj.metadata and isinstance(obj.metadata, dict):
            conv_id = obj.metadata.get('conversation_id')
            if conv_id:
                return conv_id
        # Fallback to external_call_id if it looks like a conversation ID (not starting with CA)
        if obj.external_call_id and not obj.external_call_id.startswith('CA'):
            return obj.external_call_id
        return None

    def get_application(self, obj):
        if obj.application:
            return {
                'id': obj.application.id,
                'program': obj.application.program,
                'status': obj.application.status
            }
        return None

    def get_phone_number(self, obj):
        # Try to get phone number from metadata - check multiple possible fields
        if obj.metadata and isinstance(obj.metadata, dict):
            # Direct top-level fields
            phone = (
                obj.metadata.get('phone_number') or 
                obj.metadata.get('phone') or 
                obj.metadata.get('customer_phone') or
                obj.metadata.get('to') or 
                obj.metadata.get('from')
            )
            if phone:
                return phone
            
            # Check nested metadata field
            inner_meta = obj.metadata.get('metadata', {})
            if isinstance(inner_meta, dict):
                phone = (
                    inner_meta.get('phone') or 
                    inner_meta.get('phone_number') or
                    inner_meta.get('to') or 
                    inner_meta.get('from')
                )
                if phone:
                    return phone
        
        # Fallback to applicant phone
        if obj.applicant and obj.applicant.phone:
            return obj.applicant.phone
        return None

    def get_elevenlabs_summary(self, obj):
        if obj.metadata and isinstance(obj.metadata, dict):
            return obj.metadata.get('elevenlabs_summary')
        return None


class FollowUpSerializer(serializers.ModelSerializer):
    application = serializers.PrimaryKeyRelatedField(queryset=Application.objects.all(), required=False, allow_null=True)
    lead = serializers.PrimaryKeyRelatedField(queryset=Applicant.objects.all(), required=False, allow_null=True)
    assigned_to = serializers.PrimaryKeyRelatedField(read_only=True)
    applicant_name = serializers.SerializerMethodField()
    crm_lead = serializers.PrimaryKeyRelatedField(read_only=True)
    crm_lead_name = serializers.SerializerMethodField()
    call_record = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = FollowUp
        fields = [
            "id",
            "application",
            "lead",
            "applicant_name",
            "crm_lead",
            "crm_lead_name",
            "assigned_to",
            "due_at",
            "channel",
            "status",
            "completed",
            "notes",
            "call_record",
            "metadata",
            "created_at",
        ]
        read_only_fields = ("id", "created_at", "call_record")

    def get_applicant_name(self, obj):
        if obj.lead:
            return obj.lead.name or None
        return None
        
    def get_crm_lead_name(self, obj):
        if obj.crm_lead:
            # Lead model only has 'name' field (not first_name/last_name)
            return obj.crm_lead.name or f"Lead #{obj.crm_lead.id}"
        return None


class ScheduleAICallSerializer(serializers.Serializer):
    """Serializer for scheduling AI calls."""
    # lead_id is the primary identifier, but we also support applicant_id for backwards compatibility
    lead_id = serializers.IntegerField(required=False, help_text="ID of the CRM lead to call (primary)")
    crm_lead_id = serializers.IntegerField(required=False, help_text="Alias for lead_id")
    applicant_id = serializers.IntegerField(required=False, help_text="Deprecated: Use lead_id instead")
    scheduled_time = serializers.DateTimeField(required=True, help_text="When to make the call (ISO format)")
    notes = serializers.CharField(required=False, allow_blank=True, help_text="Notes/context for the AI")
    call_context = serializers.DictField(required=False, help_text="Additional context to pass to AI agent")

    def validate(self, attrs):
        """Ensure at least one of lead_id, crm_lead_id, or applicant_id is provided."""
        lead_id = attrs.get('lead_id') or attrs.get('crm_lead_id') or attrs.get('applicant_id')
        if not lead_id:
            raise serializers.ValidationError({"lead_id": "lead_id (or crm_lead_id/applicant_id) is required"})
        # Normalize to lead_id for downstream use
        attrs['lead_id'] = lead_id
        return attrs





class LeadSerializer(serializers.ModelSerializer):
    # Nested relationships for full profile view
    documents = serializers.SerializerMethodField(read_only=True)
    academic_records = serializers.SerializerMethodField(read_only=True)
    applications = serializers.SerializerMethodField(read_only=True)
    whatsapp_messages = serializers.SerializerMethodField(read_only=True)
    
    # Override source field to disable strict choice validation
    source = serializers.CharField(max_length=128, required=False, allow_blank=True, allow_null=True)
    
    class Meta:
        model = Lead
        fields = [
            'id', 
            'external_id', 
            # Basic contact info
            'name', 
            'email', 
            'phone', 
            'source', 
            'message', 
            'city',
            'country',
            'preferred_language',
            'interested_service',
            'consent_given',
            'visit_type',
            'assigned_to',
            # Stage and profile fields
            'stage',
            'profile_completeness_score',
            'qualification_status',
            'counseling_notes',
            'metadata',
            # Walk-in fields
            'is_manual_only',
            'walked_in_at',
            'receptionist',
            # Qualification fields for ElevenLabs
            'highest_qualification',
            'qualification_marks',
            'english_test_scores',
            # Visa consultancy fields
            'enquiry_type',
            'exam_type',
            # System fields
            'raw_payload', 
            'status', 
            'forward_response', 
            'received_at', 
            'forwarded_at',
            'created_at',
            'updated_at',
            # Nested relationships
            'documents',
            'academic_records',
            'applications',
            'whatsapp_messages',
        ]
        read_only_fields = ('id', 'received_at', 'forwarded_at', 'created_at', 'updated_at')
        extra_kwargs = {
            'external_id': {'required': False, 'allow_blank': True}
        }

    def get_documents(self, obj):
        qs = getattr(obj, "documents", None)
        if not qs:
            return []
        return DocumentSerializer(qs.all(), many=True, context=self.context).data

    def get_academic_records(self, obj):
        qs = getattr(obj, "academic_records", None)
        if not qs:
            return []
        return AcademicRecordSerializer(qs.all(), many=True, context=self.context).data

    def get_applications(self, obj):
        qs = getattr(obj, "applications", None)
        if not qs:
            return []
        return ApplicationSerializer(qs.all(), many=True, context=self.context).data
    
    def get_whatsapp_messages(self, obj):
        qs = getattr(obj, "whatsapp_messages", None)
        if not qs:
            return []
        return WhatsAppMessageSerializer(qs.all(), many=True, context=self.context).data

    def validate_source(self, value):
        """
        Strip whitespace and normalize source field.
        Accept both choice values ('website') and display labels ('Website').
        """
        if not value:
            return value
        
        # Strip whitespace
        value = value.strip()
        
        # Create a mapping of display labels to choice values (case-insensitive)
        from .models import Lead
        label_to_value = {
            label.lower(): choice_value 
            for choice_value, label in Lead.LEAD_SOURCE_CHOICES
        }
        
        # If the value matches a display label (case-insensitive), convert to choice value
        value_lower = value.lower()
        if value_lower in label_to_value:
            return label_to_value[value_lower]
        
        # Otherwise, return the value as-is (it should be a valid choice value)
        return value

    def validate_email(self, value):
        """Clean and validate email - accept empty strings as None"""
        if not value or value.strip() == '':
            return None
        value = value.strip()
        # Let Django's EmailField validator handle the actual validation
        return value

    def validate_phone(self, value):
        """Clean phone number - accept various formats"""
        if not value or value.strip() == '':
            return None
        # Remove common formatting characters
        value = value.strip()
        # Just store as-is, no strict validation
        return value

    def validate(self, data):
        """
        Object-level validation with user-friendly error messages.
        Clean up any empty string fields that should be None.
        """
        # Convert empty strings to None for nullable fields
        nullable_fields = ['email', 'phone', 'city', 'country', 'message', 
                          'preferred_language', 'interested_service', 'source']
        
        for field in nullable_fields:
            if field in data and isinstance(data[field], str) and data[field].strip() == '':
                data[field] = None
        
        return data

    def create(self, validated_data):
        if not validated_data.get('external_id'):
            import uuid
            validated_data['external_id'] = f"lead_{uuid.uuid4().hex[:12]}"
        # Sync name from first_name/last_name if not provided
        if not validated_data.get('name') and validated_data.get('first_name'):
            validated_data['name'] = f"{validated_data.get('first_name', '')} {validated_data.get('last_name', '')}".strip()
        return super().create(validated_data)


# RBAC Serializers
class RoleSerializer(serializers.ModelSerializer):
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            'id', 'name', 'description', 'permissions', 
            'sidebar_config', 'dashboard_config', 'is_system_role',
            'created_at', 'updated_at', 'user_count'
        ]
        read_only_fields = ('id', 'created_at', 'updated_at', 'user_count')

    def get_user_count(self, obj):
        return obj.users.count()

    def validate_name(self, value):
        if self.instance and self.instance.is_system_role and self.instance.name != value:
            raise serializers.ValidationError("Cannot rename system roles")
        return value


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)

    class Meta:
        model = UserProfile
        fields = ['id', 'user', 'username', 'email', 'role', 'role_name', 'created_at', 'updated_at']
        read_only_fields = ('id', 'created_at', 'updated_at')


class UserRoleAssignmentSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    role_id = serializers.IntegerField(allow_null=True, required=False)

    def validate_user_id(self, value):
        if not User.objects.filter(id=value).exists():
            raise serializers.ValidationError("User does not exist")
        return value

    def validate_role_id(self, value):
        if value and not Role.objects.filter(id=value).exists():
            raise serializers.ValidationError("Role does not exist")
        return value


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "recipient", "title", "message", "link", "is_read", "created_at"]
        read_only_fields = ("id", "created_at")


# ====== Ad Integrations Serializers ======

class AdIntegrationSerializer(serializers.ModelSerializer):
    platform_display = serializers.CharField(source='get_platform_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    campaigns_count = serializers.SerializerMethodField()

    class Meta:
        model = AdIntegration
        fields = [
            'id', 'user', 'platform', 'platform_display', 'account_id', 'account_name',
            'access_token', 'refresh_token', 'status', 'status_display',
            'last_synced_at', 'metadata', 'campaigns_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ('id', 'user', 'created_at', 'updated_at', 'last_synced_at')
        extra_kwargs = {
            'access_token': {'write_only': True},
            'refresh_token': {'write_only': True},
        }

    def get_campaigns_count(self, obj):
        return obj.campaigns.count()


class AdCampaignSerializer(serializers.ModelSerializer):
    platform = serializers.CharField(source='integration.platform', read_only=True)
    platform_display = serializers.CharField(source='integration.get_platform_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AdCampaign
        fields = [
            'id', 'integration', 'platform', 'platform_display', 'external_campaign_id', 'name',
            'status', 'status_display', 'objective', 'daily_budget', 'lifetime_budget',
            'total_spend', 'currency', 'impressions', 'clicks', 'conversions',
            'ctr', 'cpc', 'cpm', 'cost_per_conversion', 'start_date', 'end_date',
            'last_synced_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ('id', 'created_at', 'updated_at', 'last_synced_at')


class WhatsAppMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppMessage
        fields = [
            "id",
            "lead",
            "applicant",
            "tenant",
            "direction",
            "message_type",
            "template_name",
            "from_phone",
            "to_phone",
            "message_body",
            "message_id",
            "status",
            "error_message",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ("id", "created_at", "updated_at")


from .models import CounselorTarget

class CounselorTargetSerializer(serializers.ModelSerializer):
    counselor_name = serializers.ReadOnlyField(source='counselor.get_full_name')

    class Meta:
        model = CounselorTarget
        fields = '__all__'
