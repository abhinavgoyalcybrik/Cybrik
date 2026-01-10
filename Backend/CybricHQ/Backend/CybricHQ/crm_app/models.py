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
    
    # Multi-DB: Schema name for this tenant (PostgreSQL) or db file (SQLite)
    database_schema = models.CharField(
        max_length=100, 
        blank=True, 
        null=True, 
        unique=True,
        help_text="Database schema name for tenant isolation (e.g., tenant_acme_corp)"
    )
    
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
    logo = models.ImageField(upload_to='tenant_logos/', blank=True, null=True, help_text="Uploaded logo image")
    logo_url = models.URLField(blank=True, null=True, help_text="URL to the tenant's logo (Legacy/External)")
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
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Tenant Settings"
        verbose_name_plural = "Tenant Settings"

    def __str__(self):
        return f"Settings for {self.tenant.name}"

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

    applicant = models.ForeignKey(Applicant, on_delete=models.CASCADE, related_name="documents")
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
        return f"{self.get_document_type_display()} for {self.applicant}"


class AcademicRecord(models.Model):
    applicant = models.ForeignKey(Applicant, on_delete=models.CASCADE, related_name="academic_records")
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


# ============================================================================
# UNIVERSITY MODEL
# ============================================================================

class University(models.Model):
    """University/Institution for student applications."""
    
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE,
        related_name='universities',
        null=True, blank=True,
        help_text="Tenant this university belongs to"
    )
    
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=50, blank=True, null=True)
    country = models.CharField(max_length=100)
    city = models.CharField(max_length=100, blank=True, null=True)
    state_province = models.CharField(max_length=100, blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    logo_url = models.URLField(blank=True, null=True)
    ranking = models.IntegerField(blank=True, null=True, help_text="University ranking")
    
    # Application requirements
    application_deadline_info = models.TextField(blank=True, null=True)
    tuition_range = models.CharField(max_length=100, blank=True, null=True)
    acceptance_rate = models.FloatField(blank=True, null=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        verbose_name_plural = "Universities"
    
    def __str__(self):
        return f"{self.name} ({self.country})"


# ============================================================================
# APPLICATION MODEL (Extended for Visa Workflow)
# ============================================================================

class Application(models.Model):
    """
    Student application for study abroad.
    Tracks the complete journey from inquiry to enrollment.
    """
    
    # Legacy status choices (kept for backward compatibility)
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("in_review", "In review"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
    ]
    
    # New comprehensive stage choices for visa workflow
    STAGE_CHOICES = [
        ("inquiry", "Inquiry"),
        ("documents_pending", "Documents Pending"),
        ("application_submitted", "Application Submitted"),
        ("offer_received", "Offer Received"),
        ("fee_paid", "Fee Paid"),
        ("i20_cas_received", "I-20/CAS Received"),
        ("visa_applied", "Visa Applied"),
        ("visa_interview", "Visa Interview"),
        ("visa_approved", "Visa Approved"),
        ("pre_departure", "Pre-Departure"),
        ("enrolled", "Enrolled"),
        ("rejected", "Rejected"),
        ("withdrawn", "Withdrawn"),
    ]
    
    PROGRAM_TYPE_CHOICES = [
        ("bachelors", "Bachelor's Degree"),
        ("masters", "Master's Degree"),
        ("phd", "PhD/Doctorate"),
        ("diploma", "Diploma"),
        ("certificate", "Certificate"),
        ("language", "Language Course"),
    ]
    
    OFFER_TYPE_CHOICES = [
        ("conditional", "Conditional Offer"),
        ("unconditional", "Unconditional Offer"),
    ]
    
    VISA_TYPE_CHOICES = [
        ("f1", "F-1 (USA)"),
        ("j1", "J-1 (USA)"),
        ("tier4", "Tier 4 (UK)"),
        ("student_visa", "Student Visa"),
        ("study_permit", "Study Permit (Canada)"),
        ("subclass_500", "Subclass 500 (Australia)"),
        ("other", "Other"),
    ]
    
    INTAKE_CHOICES = [
        ("fall_2024", "Fall 2024"),
        ("spring_2025", "Spring 2025"),
        ("fall_2025", "Fall 2025"),
        ("spring_2026", "Spring 2026"),
        ("fall_2026", "Fall 2026"),
    ]
    
    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("urgent", "Urgent"),
    ]

    # Core relationships
    applicant = models.ForeignKey(Applicant, on_delete=models.CASCADE, related_name="applications")
    university = models.ForeignKey(
        University, on_delete=models.SET_NULL,
        related_name='applications',
        null=True, blank=True,
        help_text="Target university"
    )
    
    # Tenant for data isolation
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE,
        related_name='applications',
        null=True, blank=True,
        help_text="Tenant this application belongs to"
    )
    
    # Program details
    program = models.CharField(max_length=255, blank=True, null=True, help_text="Program/Course name")
    program_type = models.CharField(max_length=32, choices=PROGRAM_TYPE_CHOICES, blank=True, null=True)
    intake = models.CharField(max_length=32, choices=INTAKE_CHOICES, blank=True, null=True)
    
    # Status & Stage
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending")
    stage = models.CharField(max_length=32, choices=STAGE_CHOICES, default="inquiry")
    priority = models.CharField(max_length=16, choices=PRIORITY_CHOICES, default="medium")
    
    # Offer details
    offer_type = models.CharField(max_length=32, choices=OFFER_TYPE_CHOICES, blank=True, null=True)
    offer_letter_url = models.URLField(blank=True, null=True)
    offer_received_date = models.DateField(blank=True, null=True)
    offer_deadline = models.DateField(blank=True, null=True)
    conditions = models.TextField(blank=True, null=True, help_text="Offer conditions to be met")
    
    # Fee details
    tuition_fee = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    fee_currency = models.CharField(max_length=8, default="USD")
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    deposit_paid = models.BooleanField(default=False)
    deposit_paid_date = models.DateField(blank=True, null=True)
    full_fee_paid = models.BooleanField(default=False)
    
    # I-20/CAS details
    i20_cas_number = models.CharField(max_length=100, blank=True, null=True)
    i20_cas_url = models.URLField(blank=True, null=True)
    i20_cas_received_date = models.DateField(blank=True, null=True)
    sevis_id = models.CharField(max_length=50, blank=True, null=True, help_text="SEVIS ID for F-1 visas")
    
    # Visa details
    visa_type = models.CharField(max_length=32, choices=VISA_TYPE_CHOICES, blank=True, null=True)
    visa_application_date = models.DateField(blank=True, null=True)
    visa_interview_date = models.DateTimeField(blank=True, null=True)
    visa_interview_location = models.CharField(max_length=255, blank=True, null=True)
    visa_decision_date = models.DateField(blank=True, null=True)
    visa_approved = models.BooleanField(default=False)
    visa_expiry_date = models.DateField(blank=True, null=True)
    visa_rejection_reason = models.TextField(blank=True, null=True)
    
    # Travel details
    planned_departure_date = models.DateField(blank=True, null=True)
    flight_booked = models.BooleanField(default=False)
    accommodation_arranged = models.BooleanField(default=False)
    
    # Assignment & tracking
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        blank=True, null=True,
        related_name='assigned_applications'
    )
    
    # Dates
    submission_date = models.DateTimeField(blank=True, null=True)
    decision_date = models.DateTimeField(blank=True, null=True)
    decision_outcome = models.CharField(max_length=64, blank=True, null=True)
    enrollment_date = models.DateField(blank=True, null=True)
    
    # External tracking
    external_reference_id = models.CharField(max_length=255, blank=True, null=True)
    university_application_id = models.CharField(max_length=100, blank=True, null=True)
    
    # Stage history (JSON array of stage transitions)
    stage_history = JSONField(default=list, blank=True)
    
    # Notes & metadata
    notes = models.TextField(blank=True, null=True)
    metadata = JSONField(blank=True, null=True)
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        uni_name = self.university.short_name if self.university else "No Uni"
        return f"Application {self.id} - {self.applicant} @ {uni_name}"
    
    def move_to_stage(self, new_stage, user=None):
        """Move application to a new stage and record in history."""
        if new_stage != self.stage:
            history_entry = {
                "from_stage": self.stage,
                "to_stage": new_stage,
                "changed_at": timezone.now().isoformat(),
                "changed_by": user.id if user else None,
            }
            if not self.stage_history:
                self.stage_history = []
            self.stage_history.append(history_entry)
            self.stage = new_stage
            self.save()


# ============================================================================
# APPLICATION DOCUMENT MODEL
# ============================================================================

class ApplicationDocument(models.Model):
    """Documents attached to an application (transcripts, SOP, LOR, etc.)."""
    
    DOCUMENT_TYPE_CHOICES = [
        ("passport", "Passport"),
        ("transcript", "Academic Transcript"),
        ("degree_certificate", "Degree Certificate"),
        ("sop", "Statement of Purpose"),
        ("lor", "Letter of Recommendation"),
        ("resume", "Resume/CV"),
        ("financial_proof", "Financial Documents"),
        ("english_test", "English Test Score (IELTS/TOEFL)"),
        ("gre_gmat", "GRE/GMAT Score"),
        ("offer_letter", "Offer Letter"),
        ("i20_cas", "I-20/CAS Document"),
        ("visa_application", "Visa Application Form"),
        ("visa_photo", "Visa Photo"),
        ("medical_report", "Medical Report"),
        ("police_clearance", "Police Clearance"),
        ("travel_itinerary", "Travel Itinerary"),
        ("insurance", "Insurance Documents"),
        ("other", "Other"),
    ]
    
    STATUS_CHOICES = [
        ("pending", "Pending Upload"),
        ("uploaded", "Uploaded"),
        ("under_review", "Under Review"),
        ("verified", "Verified"),
        ("rejected", "Rejected"),
        ("expired", "Expired"),
    ]
    
    application = models.ForeignKey(
        Application, on_delete=models.CASCADE,
        related_name='documents'
    )
    document_type = models.CharField(max_length=32, choices=DOCUMENT_TYPE_CHOICES)
    name = models.CharField(max_length=255, blank=True, null=True)
    file_url = models.URLField(blank=True, null=True)
    file_name = models.CharField(max_length=255, blank=True, null=True)
    file_size = models.IntegerField(blank=True, null=True, help_text="File size in bytes")
    
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending")
    is_required = models.BooleanField(default=True)
    
    # Verification
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        blank=True, null=True,
        related_name='verified_documents'
    )
    verified_at = models.DateTimeField(blank=True, null=True)
    rejection_reason = models.TextField(blank=True, null=True)
    
    # Expiry tracking
    expiry_date = models.DateField(blank=True, null=True)
    
    notes = models.TextField(blank=True, null=True)
    uploaded_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['document_type', '-created_at']
    
    def __str__(self):
        return f"{self.get_document_type_display()} - {self.application_id}"


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
    Message model for WhatsApp/SMS communications with leads.
    Tracks both outbound and inbound messages for conversation history.
    """
    CHANNEL_CHOICES = [
        ('whatsapp', 'WhatsApp'),
        ('sms', 'SMS'),
    ]
    DIRECTION_CHOICES = [
        ('outbound', 'Outbound'),
        ('inbound', 'Inbound'),
    ]
    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('read', 'Read'),
        ('failed', 'Failed'),
    ]
    
    # Tenant for data isolation
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE,
        related_name='messages',
        null=True, blank=True
    )
    
    # Link to lead/applicant
    lead = models.ForeignKey('Lead', on_delete=models.SET_NULL, null=True, blank=True, related_name='messages')
    applicant = models.ForeignKey('Applicant', on_delete=models.SET_NULL, null=True, blank=True, related_name='messages')
    
    # Message details
    channel = models.CharField(max_length=16, choices=CHANNEL_CHOICES, default='whatsapp')
    direction = models.CharField(max_length=16, choices=DIRECTION_CHOICES, default='outbound')
    provider = models.CharField(max_length=64, blank=True, null=True)  # whatsapp_cloud, twilio, etc.
    external_id = models.CharField(max_length=255, blank=True, null=True)
    
    to_number = models.CharField(max_length=32, blank=True, null=True)
    from_number = models.CharField(max_length=32, blank=True, null=True)
    body = models.TextField(blank=True, null=True)
    
    # Status tracking
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='queued')
    error_message = models.TextField(blank=True, null=True)
    
    # AI flag
    is_from_ai = models.BooleanField(default=False, help_text="Whether this message was generated by AI")
    
    # Metadata
    data = JSONField(blank=True, null=True)
    sent_at = models.DateTimeField(blank=True, null=True)
    delivered_at = models.DateTimeField(blank=True, null=True)
    read_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Message"
        verbose_name_plural = "Messages"

    def __str__(self):
        return f"{self.channel} {self.direction} -> {self.to_number} ({self.status})"


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
    # Tenant for data isolation
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE,
        related_name='leads',
        null=True, blank=True,
        help_text="Tenant this lead belongs to"
    )
    
    external_id = models.CharField(max_length=128, unique=True)
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
    status = models.CharField(max_length=32, default="NEW")  # NEW, CONTACTED, QUALIFIED, LOST, etc.
    forward_response = models.JSONField(blank=True, null=True)
    received_at = models.DateTimeField(default=timezone.now)
    forwarded_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ("-received_at",)
        verbose_name = "Lead"
        verbose_name_plural = "Leads"

    def __str__(self):
        return f"Lead {self.id} ({self.external_id or self.email or self.phone})"


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


class DocumentUploadToken(models.Model):
    """
    Secure token for document upload portal.
    Leads receive a link with this token, verify via OTP, then upload documents.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="upload_tokens", null=True, blank=True)
    applicant = models.ForeignKey(Applicant, on_delete=models.CASCADE, related_name="upload_tokens", null=True, blank=True)
    
    # Phone for OTP
    phone = models.CharField(max_length=32)
    
    # OTP verification
    otp_code = models.CharField(max_length=6, blank=True, null=True)
    otp_sent_at = models.DateTimeField(blank=True, null=True)
    otp_attempts = models.IntegerField(default=0)
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(blank=True, null=True)
    
    # Token expiry
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    
    # Metadata
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Document Upload Token"
        verbose_name_plural = "Document Upload Tokens"

    def __str__(self):
        return f"UploadToken {self.id} for {self.phone}"

    def is_expired(self):
        return timezone.now() > self.expires_at
    
    def can_request_otp(self):
        if not self.otp_sent_at:
            return True
        return (timezone.now() - self.otp_sent_at).total_seconds() > 60
    
    def can_verify(self):
        return self.otp_attempts < 5


class MessageTemplate(models.Model):
    """
    Template-based messaging for WhatsApp/SMS.
    Supports variable substitution like {name}, {application_id}, etc.
    """
    TRIGGER_CHOICES = [
        ('post_call', 'After Call Ends'),
        ('document_reminder', 'Document Reminder'),
        ('welcome', 'Welcome Message'),
        ('follow_up', 'Follow-up Message'),
        ('custom', 'Custom Trigger'),
    ]
    
    CHANNEL_CHOICES = [
        ('whatsapp', 'WhatsApp'),
        ('sms', 'SMS'),
        ('both', 'WhatsApp & SMS'),
    ]
    
    # Tenant for multi-tenancy
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE,
        related_name='message_templates',
        null=True, blank=True,
        help_text="Tenant this template belongs to"
    )
    
    name = models.CharField(max_length=100, help_text="Template name for identification")
    trigger = models.CharField(max_length=50, choices=TRIGGER_CHOICES, default='post_call')
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='whatsapp')
    
    # Template content with variable placeholders
    content = models.TextField(
        help_text="Message content. Variables: {name}, {first_name}, {application_id}, {phone}, {upload_link}, {call_date}"
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False, help_text="Default template for this trigger")
    
    # Metadata
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-is_default', '-updated_at')
        verbose_name = "Message Template"
        verbose_name_plural = "Message Templates"

    def __str__(self):
        return f"{self.name} ({self.get_trigger_display()})"
    
    def render(self, context: dict) -> str:
        """
        Render template with context variables.
        
        Args:
            context: Dict with keys like 'name', 'first_name', 'application_id', etc.
        
        Returns:
            Rendered message with variables replaced
        """
        message = self.content
        for key, value in context.items():
            placeholder = "{" + key + "}"
            message = message.replace(placeholder, str(value) if value else "")
        return message

    @classmethod
    def get_active_template(cls, trigger: str, tenant=None):
        """Get the active default template for a trigger."""
        queryset = cls.objects.filter(trigger=trigger, is_active=True)
        if tenant:
            queryset = queryset.filter(tenant=tenant)
        # Prefer default template, then most recently updated
        return queryset.filter(is_default=True).first() or queryset.first()


# ============================================================================
# TELEPHONY & AI CONFIG MODELS (Phase 1)
# ============================================================================

class VoiceAgent(models.Model):
    """
    Represents an AI Voice Agent (e.g., ElevenLabs, Retell).
    Configurations like Agent ID are stored here.
    """
    AGENT_TYPES = (
        ('elevenlabs', 'ElevenLabs'),
        ('retell', 'Retell AI'),
        ('vapi', 'Vapi'),
    )
    
    TYPE_CHOICES = (
        ('inbound', 'Inbound'),
        ('outbound', 'Outbound'),
        ('general', 'General'),
    )
    
    # Tenant for multi-tenancy
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE,
        related_name='voice_agents',
        null=True, blank=True
    )
    
    name = models.CharField(max_length=100, help_text="Internal name for this agent")
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='general')
    provider = models.CharField(max_length=20, choices=AGENT_TYPES, default='elevenlabs')
    provider_agent_id = models.CharField(max_length=255, help_text="The ID from the provider (e.g., ElevenLabs Agent ID)")
    
    # Extra configuration (e.g. Model ID, Voice Settings)
    config = models.JSONField(default=dict, blank=True, help_text="Provider specific settings (JSON)")
    
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.provider})"

class PhoneNumber(models.Model):
    """
    Represents a telephony number (DID) procured from a provider (Smartflo, Twilio).
    Maps a phone number to an inbound Voice Agent.
    """
    # Tenant for multi-tenancy
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE,
        related_name='phone_numbers',
        null=True, blank=True
    )

    number = models.CharField(max_length=20, unique=True, help_text="E.164 format e.g. +918069652687")
    provider = models.CharField(max_length=50, default='smartflo', help_text="Provider name (e.g. Smartflo)")
    
    # Inbound routing: which agent handles calls to this number?
    inbound_agent = models.ForeignKey(VoiceAgent, on_delete=models.SET_NULL, null=True, blank=True, related_name='phone_numbers')
    
    # Description
    description = models.CharField(max_length=255, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.number

class TelephonyConfig(models.Model):
    """
    Stores encrypted secrets for Telephony/AI providers.
    Uses crm_app.utils.encryption for storage.
    """
    PROVIDER_CHOICES = (
        ('smartflo', 'Smartflo'),
        ('elevenlabs', 'ElevenLabs'),
        ('openai', 'OpenAI'), # Config for LLM
    )
    
    # Tenant for multi-tenancy
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE,
        related_name='telephony_configs',
        null=True, blank=True
    )
    
    provider = models.CharField(max_length=50, choices=PROVIDER_CHOICES)
    
    # Encrypted fields (stored as base64 strings)
    api_key_encrypted = models.TextField(blank=True, null=True, help_text="Encrypted API Key")
    api_secret_encrypted = models.TextField(blank=True, null=True, help_text="Encrypted API Secret (if applicable)")
    
    # Additional config
    base_url = models.URLField(blank=True, null=True, help_text="Override Base URL if needed")
    
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('tenant', 'provider')

    def set_api_key(self, raw_key):
        from .utils.encryption import encrypt_secret
        self.api_key_encrypted = encrypt_secret(raw_key)

    def get_api_key(self):
        from .utils.encryption import decrypt_secret
        return decrypt_secret(self.api_key_encrypted)

    def __str__(self):
        tenant_name = self.tenant.name if self.tenant else "System"
        return f"{tenant_name} Config - {self.provider}"

