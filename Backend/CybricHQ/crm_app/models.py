# crm_app/models.py
from django.conf import settings
from django.db import models
from django.utils import timezone
import os
import uuid


try:
    JSONField = models.JSONField
except AttributeError:
    # fallback for older Django if needed (but modern project should have models.JSONField)
    from django.contrib.postgres.fields import JSONField  # type: ignore


# ============================================================================
# MULTI-TENANT / WHITE-LABEL MODELS  
# ============================================================================

class Tenant(models.Model):
    """
    Core tenant/organization model for multi-tenancy.
    Each tenant represents one white-labeled customer/organization.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text="Organization/Company name")
    slug = models.SlugField(max_length=100, unique=True, help_text="URL-safe identifier for the tenant")
    
    # Status
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = "Tenant"
        verbose_name_plural = "Tenants"

    def __str__(self):
        return self.name


class TenantSettings(models.Model):
    """
    White-label branding and configuration per tenant.
    Stores logo, colors, custom domain, and feature flags.
    """
    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name='settings')
    
    # Branding
    company_name = models.CharField(max_length=255, help_text="Display name for the organization")
    logo_url = models.URLField(blank=True, null=True, help_text="URL to the tenant's logo")
    favicon_url = models.URLField(blank=True, null=True, help_text="URL to the tenant's favicon")
    primary_color = models.CharField(max_length=7, default='#6366f1', help_text="Primary brand color (hex)")
    secondary_color = models.CharField(max_length=7, default='#4f46e5', help_text="Secondary brand color (hex)")
    accent_color = models.CharField(max_length=7, default='#8b5cf6', help_text="Accent color (hex)")
    
    # Custom Domain (for white-labeling)
    custom_domain = models.CharField(
        max_length=255, 
        blank=True, 
        null=True, 
        unique=True,
        help_text="Custom domain for white-label access (e.g., crm.clientcompany.com)"
    )
    
    # Feature flags (JSON for flexibility)
    features = models.JSONField(
        default=dict, 
        blank=True,
        help_text="Feature flags: {'ielts_module': true, 'ai_calls': true, ...}"
    )
    
    # Contact/Footer info
    support_email = models.EmailField(blank=True, null=True)
    website_url = models.URLField(blank=True, null=True)

    # API Configuration (Tenant-Specific)
    smartflo_api_key = models.CharField(max_length=255, blank=True, null=True, help_text="API Key for Smartflo Integration")
    smartflo_voicebot_api_key = models.CharField(max_length=255, blank=True, null=True, help_text="Voice Bot API Key (if different)")
    smartflo_caller_id = models.CharField(max_length=20, blank=True, null=True, help_text="Smartflo DID/Caller ID")
    smartflo_config = models.JSONField(default=dict, blank=True, help_text="Additional Smartflo config")
    
    elevenlabs_api_key = models.CharField(max_length=255, blank=True, null=True, help_text="API Key for ElevenLabs")
    elevenlabs_agent_id = models.CharField(max_length=255, blank=True, null=True, help_text="Agent ID for ElevenLabs")
    elevenlabs_config = models.JSONField(default=dict, blank=True, help_text="Additional ElevenLabs config")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Tenant Settings"
        verbose_name_plural = "Tenant Settings"

    def __str__(self):
        return f"Settings for {self.tenant.name}"


class TenantUsage(models.Model):
    """
    Track API usage per tenant for billing and monitoring.
    Stores monthly aggregated usage metrics.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='usage_records')
    
    # Time period
    year = models.PositiveIntegerField()
    month = models.PositiveIntegerField()  # 1-12
    
    # SmartFlo Usage
    smartflo_calls_made = models.PositiveIntegerField(default=0, help_text="Total outbound calls initiated")
    smartflo_calls_answered = models.PositiveIntegerField(default=0, help_text="Calls that were answered")
    smartflo_call_minutes = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Total call duration in minutes")
    
    # AI Usage (ElevenLabs, OpenAI, etc.)
    ai_api_calls = models.PositiveIntegerField(default=0, help_text="Total AI API calls")
    ai_tokens_used = models.PositiveIntegerField(default=0, help_text="Total AI tokens consumed")
    
    # Lead/CRM Usage
    leads_created = models.PositiveIntegerField(default=0)
    emails_sent = models.PositiveIntegerField(default=0)
    sms_sent = models.PositiveIntegerField(default=0)
    whatsapp_messages_sent = models.PositiveIntegerField(default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Tenant Usage"
        verbose_name_plural = "Tenant Usage Records"
        unique_together = ['tenant', 'year', 'month']
        ordering = ['-year', '-month']
    
    def __str__(self):
        return f"{self.tenant.name} - {self.year}/{self.month:02d}"
    
    @classmethod
    def get_or_create_current(cls, tenant):
        """Get or create the usage record for the current month."""
        from django.utils import timezone
        now = timezone.now()
        usage, _ = cls.objects.get_or_create(
            tenant=tenant,
            year=now.year,
            month=now.month,
            defaults={}
        )
        return usage
    
    @classmethod
    def increment_smartflo_call(cls, tenant, answered=False, duration_seconds=0):
        """Increment SmartFlo call counters for a tenant."""
        from django.db.models import F
        usage = cls.get_or_create_current(tenant)
        usage.smartflo_calls_made = F('smartflo_calls_made') + 1
        if answered:
            usage.smartflo_calls_answered = F('smartflo_calls_answered') + 1
        if duration_seconds > 0:
            duration_minutes = duration_seconds / 60.0
            usage.smartflo_call_minutes = F('smartflo_call_minutes') + duration_minutes
        usage.save(update_fields=['smartflo_calls_made', 'smartflo_calls_answered', 'smartflo_call_minutes', 'updated_at'])

def transcript_upload_path(instance, filename):
    """
    Upload path for transcript files (used by migrations and FileField).
    Structure: transcripts/<applicant-or-application-identifier>/<timestamp>_<uuid4>_<original-filename>
    This is intentionally permissive and safe for local dev + S3 later.
    """
    ts = timezone.now().strftime("%Y%m%d_%H%M%S")
    uid = uuid.uuid4().hex[:8]
    # prefer applicant id if present, else application id, else "unlinked"
    owner = "unlinked"
    try:
        if hasattr(instance, "applicant") and instance.applicant_id:
            owner = f"applicant_{instance.applicant_id}"
        elif hasattr(instance, "application") and instance.application_id:
            owner = f"application_{instance.application_id}"
    except Exception:
        owner = "unlinked"
    safe_filename = os.path.basename(filename).replace(" ", "_")
    return f"transcripts/{owner}/{ts}_{uid}_{safe_filename}"


class Applicant(models.Model):
    # Tenant for data isolation
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE,
        related_name='applicants',
        null=True, blank=True,
        help_text="Tenant this applicant belongs to"
    )
    
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150, blank=True, null=True)
    email = models.EmailField(max_length=254, blank=True, null=True)
    phone = models.CharField(max_length=32, blank=True, null=True)
    dob = models.DateField(blank=True, null=True)
    passport_number = models.CharField(max_length=128, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    preferred_country = models.CharField(max_length=128, blank=True, null=True)
    metadata = JSONField(blank=True, null=True)
    lead = models.ForeignKey('Lead', on_delete=models.CASCADE, blank=True, null=True, related_name="applicants")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    stage = models.CharField(max_length=64, default="new")  # new, docs_pending, verified, etc.
    profile_completeness_score = models.IntegerField(default=0)
    qualification_status = models.CharField(max_length=64, default="pending")
    counseling_notes = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.first_name} {self.last_name or ''}".strip()


class Document(models.Model):
    DOCUMENT_TYPES = [
        ("10th_marksheet", "10th Marksheet"),
        ("12th_marksheet", "12th Marksheet"),
        ("degree_certificate", "Degree Certificate"),
        ("passport", "Passport"),
        ("english_test", "English Test (IELTS/PTE/TOEFL)"),
        ("other", "Other"),
    ]
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("verified", "Verified"),
        ("rejected", "Rejected"),
    ]

    applicant = models.ForeignKey(Applicant, on_delete=models.CASCADE, related_name="documents", null=True, blank=True)
    lead = models.ForeignKey('Lead', on_delete=models.CASCADE, related_name="documents", null=True, blank=True)
    document_type = models.CharField(max_length=64, choices=DOCUMENT_TYPES, default="other")
    file = models.FileField(upload_to="documents/%Y/%m/%d/")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending")
    validation_status = models.CharField(max_length=32, default="pending")  # valid, invalid, unclear, expired
    extraction_data = JSONField(blank=True, null=True)
    expiry_date = models.DateField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        owner = self.applicant or self.lead
        return f"{self.get_document_type_display()} for {owner}"


class AcademicRecord(models.Model):
    applicant = models.ForeignKey(Applicant, on_delete=models.CASCADE, related_name="academic_records", null=True, blank=True)
    lead = models.ForeignKey('Lead', on_delete=models.CASCADE, related_name="academic_records", null=True, blank=True)
    institution = models.CharField(max_length=255, blank=True, null=True)
    degree = models.CharField(max_length=255, blank=True, null=True)
    start_year = models.IntegerField(blank=True, null=True)
    end_year = models.IntegerField(blank=True, null=True)
    year_of_completion = models.IntegerField(blank=True, null=True)
    grade = models.CharField(max_length=64, blank=True, null=True)
    score = models.CharField(max_length=64, blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.degree} @ {self.institution}" if self.degree and self.institution else f"AcademicRecord {self.id}"


class Application(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("in_review", "In review"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
    ]

    applicant = models.ForeignKey(Applicant, on_delete=models.CASCADE, related_name="applications", null=True, blank=True)
    lead = models.ForeignKey('Lead', on_delete=models.CASCADE, related_name="applications", null=True, blank=True)
    
    # Tenant for data isolation (denormalized for query efficiency)
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE,
        related_name='applications',
        null=True, blank=True,
        help_text="Tenant this application belongs to"
    )
    
    program = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending")
    metadata = JSONField(blank=True, null=True)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True)
    submission_date = models.DateTimeField(blank=True, null=True)
    decision_date = models.DateTimeField(blank=True, null=True)
    decision_outcome = models.CharField(max_length=64, blank=True, null=True)
    external_reference_id = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Application {self.id} ({self.applicant})"


class CallRecord(models.Model):
    # Tenant for data isolation
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE,
        related_name='call_records',
        null=True, blank=True,
        help_text="Tenant this call record belongs to"
    )
    
    applicant = models.ForeignKey(Applicant, on_delete=models.SET_NULL, blank=True, null=True, related_name="call_records")
    lead = models.ForeignKey('Lead', on_delete=models.SET_NULL, blank=True, null=True, related_name="call_records")
    application = models.ForeignKey(Application, on_delete=models.SET_NULL, blank=True, null=True, related_name="call_records")
    external_call_id = models.CharField(max_length=255, blank=True, null=True)  # provider id (Twilio, etc.)
    provider = models.CharField(max_length=64, blank=True, null=True)
    status = models.CharField(max_length=64, blank=True, null=True)
    direction = models.CharField(max_length=16, blank=True, null=True)  # inbound/outbound
    recording_url = models.URLField(blank=True, null=True)
    duration_seconds = models.IntegerField(blank=True, null=True)
    metadata = JSONField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    qualified_data = JSONField(blank=True, null=True, default=dict)  # structured_output from ElevenLabs
    cost = models.FloatField(blank=True, null=True)
    currency = models.CharField(max_length=8, default="USD")
    
    # AI Analysis Fields
    ai_analyzed = models.BooleanField(default=False)
    ai_analysis_result = JSONField(blank=True, null=True)  # Full AI analysis output
    ai_quality_score = models.FloatField(blank=True, null=True)  # 0-100 qualification score
    
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"CallRecord {self.id} ({self.external_call_id or 'no-ext-id'})"


class Transcript(models.Model):
    call = models.ForeignKey(CallRecord, on_delete=models.CASCADE, related_name="transcripts")
    application = models.ForeignKey(Application, on_delete=models.SET_NULL, blank=True, null=True)
    transcript_text = models.TextField(blank=True, null=True)
    asr_provider = models.CharField(max_length=64, blank=True, null=True)
    metadata = JSONField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("created_at",)

    def __str__(self):
        return f"Transcript {self.id} (call={self.call_id})"


class AIResult(models.Model):
    application = models.ForeignKey(Application, on_delete=models.SET_NULL, blank=True, null=True, related_name="ai_results")
    call = models.ForeignKey(CallRecord, on_delete=models.SET_NULL, blank=True, null=True, related_name="ai_results")
    payload = JSONField(blank=True, null=True)  # store model output
    extractor_version = models.CharField(max_length=64, blank=True, null=True)
    confidence = models.FloatField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"AIResult {self.id} (conf={self.confidence})"


class FollowUp(models.Model):
    CHANNEL_CHOICES = [
        ("email", "Email"),
        ("sms", "SMS"),
        ("phone", "Phone"),
        ("ai_call", "AI Call"),
        ("in_app", "In App"),
        ("other", "Other"),
    ]
    
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("scheduled", "Scheduled"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    ]

    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="followups", blank=True, null=True)
    lead = models.ForeignKey(Applicant, on_delete=models.CASCADE, blank=True, null=True, related_name="lead_followups")
    crm_lead = models.ForeignKey('Lead', on_delete=models.CASCADE, blank=True, null=True, related_name="followups")
    
    # Tenant for data isolation
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE,
        related_name='followups',
        null=True, blank=True,
        help_text="Tenant this follow-up belongs to"
    )
    
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True)
    due_at = models.DateTimeField(blank=True, null=True)
    channel = models.CharField(max_length=32, choices=CHANNEL_CHOICES, default="email")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending")
    completed = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)
    call_record = models.ForeignKey(CallRecord, on_delete=models.SET_NULL, blank=True, null=True, related_name="followups")
    metadata = JSONField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"FollowUp {self.id} ({self.channel})"
    
    def is_ai_call_due(self):
        """Check if this AI call task is due for execution."""
        if self.channel != "ai_call":
            return False
        if self.completed or self.status in ["completed", "failed", "cancelled"]:
            return False
        if not self.due_at:
            return False
        from django.utils import timezone
        return self.due_at <= timezone.now()


class ConsentRecord(models.Model):
    applicant = models.ForeignKey(Applicant, on_delete=models.CASCADE, related_name="consents")
    consent_type = models.CharField(max_length=128, blank=True, null=True)
    consent_text = models.TextField(blank=True, null=True)
    consent_given = models.BooleanField(default=False)
    consented_at = models.DateTimeField(blank=True, null=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True)
    metadata = JSONField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"ConsentRecord {self.id} (applicant={self.applicant_id})"


# ---- Models added to satisfy existing serializers/admin references ----

class OutboundMessage(models.Model):
    """
    Minimal OutboundMessage model to satisfy imports/serializers.
    Extend later as needed (e.g. FK to Applicant/Application).
    """
    provider = models.CharField(max_length=64, blank=True, null=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)  # id from provider (Twilio etc.)
    to_number = models.CharField(max_length=32, blank=True, null=True)
    from_number = models.CharField(max_length=32, blank=True, null=True)
    body = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=32, blank=True, null=True)  # queued/sent/failed/delivered
    data = JSONField(blank=True, null=True)  # additional provider data/meta
    sent_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Outbound Message"
        verbose_name_plural = "Outbound Messages"

    def __str__(self):
        return f"OutboundMessage {self.id} -> {self.to_number} ({self.status})"


class AuditLog(models.Model):
    """
    Minimal AuditLog model to satisfy imports/serializers.
    Fields match serializer expectations: actor, action, target_type, target_id, data, ip, created_at
    """
    actor = models.CharField(max_length=255, blank=True, null=True)  # username or service name
    action = models.CharField(max_length=255, blank=True, null=True)  # e.g. "create", "update"
    target_type = models.CharField(max_length=255, blank=True, null=True)  # e.g. "Application"
    target_id = models.CharField(max_length=255, blank=True, null=True)
    applicant = models.ForeignKey('Applicant', on_delete=models.SET_NULL, blank=True, null=True, related_name="audit_logs")
    data = JSONField(blank=True, null=True)  # what changed or extra details
    ip = models.GenericIPAddressField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"

    def __str__(self):
        return f"AuditLog {self.id}: {self.action} by {self.actor}"


class Lead(models.Model):
    LEAD_STATUS_CHOICES = [
        ('new', 'New'),
        ('contacted', 'Contacted'),
        ('qualified', 'Qualified'),
        ('converted', 'Converted'),
        ('junk', 'Junk'),
        ('lost', 'Lost'),
    ]
    
    # Tenant for data isolation
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE,
        related_name='leads',
        null=True, blank=True,
        help_text="Tenant this lead belongs to"
    )
    
    external_id = models.CharField(max_length=128, unique=True)
    
    # Basic contact info (original Lead fields)
    name = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=32, blank=True, null=True)
    source = models.CharField(max_length=128, blank=True, null=True)
    city = models.CharField(max_length=128, blank=True, null=True)
    country = models.CharField(max_length=128, blank=True, null=True)
    preferred_language = models.CharField(max_length=64, blank=True, null=True)
    interested_service = models.CharField(max_length=255, blank=True, null=True)
    consent_given = models.BooleanField(default=False)
    visit_type = models.CharField(max_length=64, blank=True, null=True)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True)
    message = models.TextField(blank=True, null=True)
    
    # ============== APPLICANT-LIKE PROFILE FIELDS ==============
    # These fields enable Lead to function like Applicant without conversion
    first_name = models.CharField(max_length=150, blank=True, null=True)
    last_name = models.CharField(max_length=150, blank=True, null=True)
    dob = models.DateField(blank=True, null=True, help_text="Date of Birth")
    passport_number = models.CharField(max_length=128, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    preferred_country = models.CharField(max_length=128, blank=True, null=True)
    
    # Stage management (like Applicant)
    stage = models.CharField(max_length=64, default="new")  # new, docs_pending, verified, etc.
    profile_completeness_score = models.IntegerField(default=0)
    qualification_status = models.CharField(max_length=64, default="pending")
    counseling_notes = models.TextField(blank=True, null=True)
    
    # Metadata for flexible storage
    metadata = JSONField(blank=True, null=True)
    # ============================================================
    
    # Optional qualification fields for ElevenLabs dynamic variables
    highest_qualification = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        help_text="Highest education qualification (e.g., B.Tech, 12th, Diploma)"
    )
    qualification_marks = models.CharField(
        max_length=128, 
        blank=True, 
        null=True,
        help_text="Marks/percentage/CGPA (e.g., 85%, CGPA 8.5)"
    )
    english_test_scores = models.CharField(
        max_length=128, 
        blank=True, 
        null=True,
        help_text="English proficiency scores (e.g., IELTS 7.5, PTE 65, Not taken)"
    )
    
    raw_payload = models.JSONField(blank=True, null=True)
    status = models.CharField(
        max_length=32, 
        choices=LEAD_STATUS_CHOICES,
        default="new"
    )
    forward_response = models.JSONField(blank=True, null=True)
    received_at = models.DateTimeField(default=timezone.now)
    forwarded_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-received_at",)
        verbose_name = "Lead"
        verbose_name_plural = "Leads"

    def __str__(self):
        # Use first_name/last_name if available, otherwise use name
        if self.first_name:
            return f"{self.first_name} {self.last_name or ''}".strip()
        return self.name or f"Lead {self.id}"


class UserDashboardPreference(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dashboard_preference")
    layout_config = JSONField(default=dict, blank=True)  # Stores widget layout, visibility, etc.
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"DashboardPref for {self.user}"


class RoleDashboardPreference(models.Model):
    role_name = models.CharField(max_length=100, unique=True)  # e.g. "Admin", "Counsellor"
    layout_config = JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"RoleDashboardPref for {self.role_name}"


class Role(models.Model):
    """
    Role model for RBAC system.
    Stores permissions, sidebar config, and dashboard widget visibility per role.
    """
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    permissions = JSONField(default=dict, blank=True)  # Resource-action permission matrix
    sidebar_config = JSONField(default=dict, blank=True)  # Which sidebar items are visible
    dashboard_config = JSONField(default=dict, blank=True)  # Which dashboard widgets are visible
    is_system_role = models.BooleanField(default=False)  # Prevent deletion of default roles
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('name',)
        verbose_name = "Role"
        verbose_name_plural = "Roles"

    def __str__(self):
        return self.name

    def has_permission(self, resource, action):
        """Check if this role has a specific permission"""
        return self.permissions.get(resource, {}).get(action, False)


class UserProfile(models.Model):
    """
    Extended user profile to add role and tenant relationship.
    One-to-one with Django's User model.
    """
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name="users")
    
    # Tenant association
    tenant = models.ForeignKey(
        Tenant, 
        on_delete=models.CASCADE, 
        related_name="members",
        null=True,  # Nullable for migration (existing users won't have tenant initially)
        blank=True,
        help_text="The tenant/organization this user belongs to"
    )
    is_tenant_admin = models.BooleanField(
        default=False,
        help_text="Can manage tenant settings and branding"
    )
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        tenant_name = self.tenant.name if self.tenant else 'No Tenant'
        return f"{self.user.username} - {self.role.name if self.role else 'No Role'} ({tenant_name})"

    def has_permission(self, resource, action):
        """Check if user has specific permission via their role"""
        if not self.role:
            return False
        return self.role.has_permission(resource, action)



class Notification(models.Model):
    # Tenant for data isolation (notifications are typically per-user, which is per-tenant)
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE,
        related_name='notifications',
        null=True, blank=True,
        help_text="Tenant this notification belongs to"
    )
    
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=255)
    message = models.TextField()
    link = models.CharField(max_length=255, blank=True, null=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Notification for {self.recipient}: {self.title}"


class AdIntegration(models.Model):
    """
    Stores connection credentials for ad platforms (Google Ads, Meta Ads).
    """
    PLATFORM_CHOICES = [
        ("google_ads", "Google Ads"),
        ("meta_ads", "Meta Ads"),
    ]
    STATUS_CHOICES = [
        ("connected", "Connected"),
        ("disconnected", "Disconnected"),
        ("error", "Error"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ad_integrations")
    platform = models.CharField(max_length=32, choices=PLATFORM_CHOICES)
    account_id = models.CharField(max_length=128, blank=True, null=True, help_text="Platform Account/Customer ID")
    account_name = models.CharField(max_length=255, blank=True, null=True)
    access_token = models.TextField(blank=True, null=True, help_text="OAuth access token (encrypted in production)")
    refresh_token = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="disconnected")
    last_synced_at = models.DateTimeField(blank=True, null=True)
    metadata = JSONField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        unique_together = ("user", "platform", "account_id")
        verbose_name = "Ad Integration"
        verbose_name_plural = "Ad Integrations"

    def __str__(self):
        return f"{self.get_platform_display()} - {self.account_name or self.account_id} ({self.status})"


class AdCampaign(models.Model):
    """
    Stores synced campaign data from ad platforms.
    """
    STATUS_CHOICES = [
        ("active", "Active"),
        ("paused", "Paused"),
        ("ended", "Ended"),
        ("draft", "Draft"),
    ]

    integration = models.ForeignKey(AdIntegration, on_delete=models.CASCADE, related_name="campaigns")
    external_campaign_id = models.CharField(max_length=128, help_text="Campaign ID from the platform")
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="active")
    objective = models.CharField(max_length=128, blank=True, null=True, help_text="e.g., Conversions, Traffic, Awareness")
    
    # Budget & Spend
    daily_budget = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    lifetime_budget = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    total_spend = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default="USD")
    
    # Performance Metrics
    impressions = models.BigIntegerField(default=0)
    clicks = models.BigIntegerField(default=0)
    conversions = models.IntegerField(default=0)
    ctr = models.DecimalField(max_digits=6, decimal_places=4, default=0, help_text="Click-through rate")
    cpc = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Cost per click")
    cpm = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Cost per 1000 impressions")
    cost_per_conversion = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Dates
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    
    # Raw data from API
    raw_data = JSONField(blank=True, null=True)
    last_synced_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-total_spend",)
        unique_together = ("integration", "external_campaign_id")
        verbose_name = "Ad Campaign"
        verbose_name_plural = "Ad Campaigns"

    def __str__(self):
        return f"{self.name} ({self.integration.get_platform_display()})"
