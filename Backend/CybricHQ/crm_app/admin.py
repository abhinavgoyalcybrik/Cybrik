# crm_app/admin.py
from django.contrib import admin
from .models import (
    Applicant,
    AcademicRecord,
    Application,
    CallRecord,
    Transcript,
    AIResult,
    FollowUp,
    ConsentRecord,
    OutboundMessage,
    AuditLog,
)

@admin.register(Applicant)
class ApplicantAdmin(admin.ModelAdmin):
    list_display = ("id", "first_name", "last_name", "email", "created_at")

@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "applicant", "status", "created_at")
    search_fields = ("applicant__first_name", "applicant__last_name", "status")

@admin.register(CallRecord)
class CallRecordAdmin(admin.ModelAdmin):
    list_display = ("id","provider","external_call_id","created_at")
    readonly_fields = ("metadata","qualified_data")

@admin.register(Transcript)
class TranscriptAdmin(admin.ModelAdmin):
    list_display = ("id","call","asr_provider","created_at")
    readonly_fields = ("transcript_text","metadata")

@admin.register(AIResult)
class AIResultAdmin(admin.ModelAdmin):
    # changed 'genuineness_score' -> 'confidence' (field present on AIResult model)
    list_display = ("id", "call", "confidence", "created_at")
    readonly_fields = ("created_at",)

@admin.register(AcademicRecord)
class AcademicRecordAdmin(admin.ModelAdmin):
    # changed 'year' -> 'year_of_completion'
    list_display = ("id", "applicant", "degree", "year_of_completion", "created_at")
    search_fields = ("applicant__first_name", "applicant__email", "degree")
    raw_id_fields = ("applicant",)

@admin.register(FollowUp)
class FollowUpAdmin(admin.ModelAdmin):
    list_display = ("id", "application", "lead", "due_at", "channel", "completed", "created_at")
    list_filter = ("channel", "completed")
    raw_id_fields = ("application", "lead", "assigned_to")

@admin.register(ConsentRecord)
class ConsentRecordAdmin(admin.ModelAdmin):
    # changed 'given' -> 'consent_given', 'recorded_at' -> 'consented_at'
    list_display = ("id", "applicant", "consent_type", "consent_given", "consented_at")
    raw_id_fields = ("applicant",)

# keep admin for OutboundMessage/AuditLog if you added those models
@admin.register(OutboundMessage)
class OutboundMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "to_number", "status", "provider", "sent_at", "created_at")
    readonly_fields = ("created_at",)

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "actor", "action", "target_type", "target_id", "created_at")
    readonly_fields = ("created_at",)


# ============================================================================
# MULTI-TENANT / WHITE-LABEL ADMIN
# ============================================================================

from .models import Tenant, TenantSettings
from billing.models import Subscription

class TenantSettingsInline(admin.StackedInline):
    model = TenantSettings
    can_delete = False
    verbose_name_plural = "Branding & Settings"


class TenantSubscriptionInline(admin.TabularInline):
    """Show all subscriptions for this tenant"""
    model = Subscription
    fk_name = 'tenant'
    extra = 0
    fields = ['plan', 'status', 'current_period_start', 'current_period_end', 'cancel_at_period_end']
    readonly_fields = ['plan', 'status', 'current_period_start', 'current_period_end']
    can_delete = False
    verbose_name_plural = "Subscriptions"
    
    def has_add_permission(self, request, obj=None):
        return False  # Add subscriptions through billing admin


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "subscription_count", "member_count", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [TenantSettingsInline, TenantSubscriptionInline]
    readonly_fields = ("id", "created_at", "updated_at", "products_display", "features_display")
    
    fieldsets = (
        ('Tenant Info', {
            'fields': ('id', 'name', 'slug', 'is_active')
        }),
        ('Access Summary', {
            'fields': ('products_display', 'features_display'),
            'description': 'Shows which products and features this tenant has access to based on active subscriptions.'
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def subscription_count(self, obj):
        return obj.subscriptions.filter(status__in=['active', 'trialing']).count()
    subscription_count.short_description = 'Active Subs'
    
    def member_count(self, obj):
        return obj.members.count()
    member_count.short_description = 'Members'
    
    def products_display(self, obj):
        from crm_app.feature_access import get_tenant_products
        products = get_tenant_products(obj)
        return ', '.join(products) if products else 'No active subscriptions'
    products_display.short_description = 'Active Products'
    
    def features_display(self, obj):
        from crm_app.feature_access import get_tenant_features
        features = get_tenant_features(obj)
        return ', '.join(features.keys()) if features else 'None'
    features_display.short_description = 'Enabled Features'


@admin.register(TenantSettings)
class TenantSettingsAdmin(admin.ModelAdmin):
    list_display = ("tenant", "company_name", "custom_domain", "has_smartflo", "has_elevenlabs", "primary_color")
    search_fields = ("tenant__name", "company_name", "custom_domain")
    list_filter = ("tenant__is_active",)
    
    fieldsets = (
        ('Tenant', {
            'fields': ('tenant',)
        }),
        ('Branding', {
            'fields': ('company_name', 'logo_url', 'favicon_url', 'primary_color', 'secondary_color', 'accent_color')
        }),
        ('Custom Domain (White-Label)', {
            'fields': ('custom_domain',),
            'description': 'Enter the custom domain for this tenant (e.g., crm.clientcompany.com). Client must set up DNS CNAME first.'
        }),
        ('SmartFlo API Configuration', {
            'fields': ('smartflo_api_key', 'smartflo_voicebot_api_key', 'smartflo_caller_id', 'smartflo_config'),
            'description': 'Configure SmartFlo API credentials for this tenant. Each tenant can have their own phone numbers and API keys.',
            'classes': ('collapse',)
        }),
        ('ElevenLabs AI Configuration', {
            'fields': ('elevenlabs_api_key', 'elevenlabs_agent_id', 'elevenlabs_config'),
            'description': 'Configure ElevenLabs AI credentials for this tenant.',
            'classes': ('collapse',)
        }),
        ('Contact & Support', {
            'fields': ('support_email', 'website_url'),
            'classes': ('collapse',)
        }),
        ('Feature Flags', {
            'fields': ('features',),
            'description': 'JSON object with feature flags (e.g., {"ielts_module": true, "ai_calls": true})',
            'classes': ('collapse',)
        }),
    )
    
    def has_smartflo(self, obj):
        return bool(obj.smartflo_api_key)
    has_smartflo.boolean = True
    has_smartflo.short_description = "SmartFlo"
    
    def has_elevenlabs(self, obj):
        return bool(obj.elevenlabs_api_key)
    has_elevenlabs.boolean = True
    has_elevenlabs.short_description = "ElevenLabs"


# Register TenantUsage for viewing usage stats
from .models import TenantUsage

@admin.register(TenantUsage)
class TenantUsageAdmin(admin.ModelAdmin):
    list_display = ("tenant", "year", "month", "smartflo_calls_made", "smartflo_call_minutes", "ai_api_calls", "leads_created")
    list_filter = ("tenant", "year", "month")
    search_fields = ("tenant__name",)
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-year", "-month")
