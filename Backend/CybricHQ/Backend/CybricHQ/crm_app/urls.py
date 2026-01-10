from django.urls import path, include
# Force reload
from rest_framework.routers import DefaultRouter
from .views import ElevenLabsPostcallWebhook
from . import auth_views
from . import views
from .views import TranscriptASRCallback, DashboardSummary, ElevenLabsWebhookView, ReportsSummary
from .views_leads import PortalLeadView, WalkInLeadView
from .views_dashboard import dashboard_overview
from . import views_elevenlabs
from . import views_analytics
from . import views_dashboard
from .views_demo import health, csrf_cookie
from .views_ai import AIAnalysisViewSet, DocumentVerificationViewSet
from . import views_search
from .views_rbac import RoleViewSet, UserRoleAssignmentView, UserProfileViewSet
from . import views_notifications
from .views_integrations import AdIntegrationViewSet, AdCampaignViewSet
from . import views_tenant  # Multi-tenant / white-label

app_name = "crm_app"


router = DefaultRouter()
router.register(r"applicants", views.ApplicantViewSet, basename="applicant")
router.register(r"academic-records", views.AcademicRecordViewSet, basename="academicrecord")
router.register(r"applications", views.ApplicationViewSet, basename="application")
router.register(r"application-documents", views.ApplicationDocumentViewSet, basename="application-document")
router.register(r"universities", views.UniversityViewSet, basename="university")
router.register(r"transcripts", views.TranscriptViewSet, basename="transcript")
router.register(r"airesults", views.AIResultViewSet, basename="airesult")
router.register(r"outbound-messages", views.OutboundMessageViewSet, basename="outboundmessage")
router.register(r"leads", views.LeadViewSet, basename="lead")
router.register(r"calls", views.CallRecordViewSet, basename="callrecord")
router.register(r"tasks", views.FollowUpViewSet, basename="task")
router.register(r"documents", views.DocumentViewSet, basename="document")
router.register(r"staff", views.StaffViewSet, basename="staff")
router.register(r"ai/analysis", AIAnalysisViewSet, basename="ai-analysis")
router.register(r"ai/documents", DocumentVerificationViewSet, basename="ai-documents")
router.register(r"roles", RoleViewSet, basename="role")
router.register(r"user-profiles", UserProfileViewSet, basename="userprofile")
router.register(r"notifications", views_notifications.NotificationViewSet, basename="notification")
router.register(r"integrations", AdIntegrationViewSet, basename="integration")
router.register(r"campaigns", AdCampaignViewSet, basename="campaign")

# Multi-tenant / White-label Config
from .views_tenant import VoiceAgentViewSet, PhoneNumberViewSet, TelephonyConfigViewSet
router.register(r"tenant/voice-agents", VoiceAgentViewSet, basename="voice-agent")
router.register(r"tenant/phone-numbers", PhoneNumberViewSet, basename="phone-number")
router.register(r"tenant/telephony-config", TelephonyConfigViewSet, basename="telephony-config")

# Tenant Admin
from .views_tenant_admin import TenantViewSet, ProductViewSet
router.register(r"admin/tenants", TenantViewSet, basename="admin-tenant")
router.register(r"admin/products", ProductViewSet, basename="admin-product")

urlpatterns = [
    # Lead intake endpoint (must be before router to avoid collision with leads/<pk>/)
    path("leads/portal/", PortalLeadView.as_view(), name="portal-lead"),
    path("leads/walk-in/", WalkInLeadView.as_view(), name="walk-in-lead"),

    # auth-like endpoints
    path("auth/login/", auth_views.login_view, name="api_login"),
    path("auth/test-login/", auth_views.test_login, name="api_test_login"),
    path("auth/login", auth_views.login_view, name="api_login_noslash"),
    path("auth/refresh/", auth_views.refresh_view, name="api_refresh"),
    path("auth/refresh", auth_views.refresh_view, name="api_refresh_noslash"),
    path("auth/logout/", auth_views.logout_view, name="api_logout"),
    path("auth/logout", auth_views.logout_view, name="api_logout_noslash"),
    path("auth/me/", auth_views.me_view, name="api_me"),
    path("auth/me", auth_views.me_view, name="api_me_noslash"),
    path("auth/change-password/", auth_views.change_password, name="change-password"),

    # ElevenLabs webhook / callback (single, canonical endpoint)
    # Ensure ELEVENLABS_POSTCALL_WEBHOOK in settings points to this route.
    path("elevenlabs/callback/", ElevenLabsWebhookView.as_view(), name="elevenlabs_callback"),
    path("webhooks/elevenlabs/postcall/", ElevenLabsPostcallWebhook.as_view(), name="eleven_postcall"),
    path('elevenlabs/postcall/', views_elevenlabs.elevenlabs_postcall, name='elevenlabs-postcall'),
    path('elevenlabs/audio/<str:conversation_id>/', views_elevenlabs.ElevenLabsAudioProxy.as_view(), name='elevenlabs-audio-proxy'),
    path('reports/summary/', ReportsSummary.as_view(), name='reports_summary'),

    path("v1/health/", health, name="api-health"),
    path("v1/csrf_cookie/", csrf_cookie, name="api-csrf-cookie"),

    # Analytics & Dashboard Config
    path("analytics/time-series/", views_analytics.analytics_time_series, name="analytics-time-series"),
    path("analytics/funnel/", views_analytics.analytics_funnel, name="analytics-funnel"),
    path("analytics/applications-status/", views_analytics.analytics_applications_status, name="analytics-applications-status"),
    path("analytics/cost-time-series/", views_analytics.analytics_cost_time_series, name="analytics-cost-time-series"),
    path("analytics/llm-usage/", views_analytics.analytics_llm_usage, name="analytics-llm-usage"),
    path("dashboard/overview/", views_dashboard.dashboard_overview, name="dashboard-overview"),
    path("dashboard/config/", views_dashboard.get_dashboard_config, name="get-dashboard-config"),
    path("dashboard/config/save/", views_dashboard.save_dashboard_config, name="save-dashboard-config"),
    path("dashboard/config/save-role/", views_dashboard.save_role_config, name="save-role-config"),
    path("dashboard/config/get-role/", views_dashboard.get_role_config, name="get-role-config"),
    
    # RBAC endpoints
    path("users/assign-role/", UserRoleAssignmentView.as_view(), name="user-role-assignment"),
    
    # Global Search
    path("search/", views_search.GlobalSearchView.as_view(), name="global-search"),
    
    # AI Call Scheduling
    path("ai-calls/schedule/", views.ScheduleAICallView.as_view(), name="schedule-ai-call"),
    path("ai-calls/trigger/", views.TriggerAICallNowView.as_view(), name="trigger-ai-call"),
    path("ai-calls/process-due/", views.ProcessDueAICallsView.as_view(), name="process-due-ai-calls"),
    path("ai-calls/sync-elevenlabs/", views.SyncElevenLabsCallsView.as_view(), name="sync-elevenlabs-calls"),
    
    # Tenant / White-Label endpoints
    path("tenant/branding/", views_tenant.get_tenant_branding, name="tenant-branding"),
    path("tenant/settings/", views_tenant.tenant_settings, name="tenant-settings"),
    path("tenant/current/", views_tenant.current_tenant, name="current-tenant"),
    
    # Smartflo AI Calling endpoints
    path("smartflo/call/initiate/", __import__('crm_app.smartflo_api', fromlist=['initiate_ai_call']).initiate_ai_call, name="smartflo-initiate-call"),
    path("smartflo/call/end/", __import__('crm_app.smartflo_api', fromlist=['end_call']).end_call, name="smartflo-end-call"),
    path("smartflo/call/<str:call_sid>/status/", __import__('crm_app.smartflo_api', fromlist=['get_call_status']).get_call_status, name="smartflo-call-status"),
    path("smartflo/dialplan/", __import__('crm_app.smartflo_api', fromlist=['dialplan_webhook']).dialplan_webhook, name="smartflo-dialplan"),
    
    # Document Upload Portal (public endpoints for lead document upload with OTP)
    path("upload-portal/initiate/", __import__('crm_app.views_document_portal', fromlist=['InitiateUploadView']).InitiateUploadView.as_view(), name="upload-portal-initiate"),
    path("upload-portal/generate/", __import__('crm_app.views_document_portal', fromlist=['GenerateUploadLinkView']).GenerateUploadLinkView.as_view(), name="upload-portal-generate"),
    path("upload-portal/<uuid:token_id>/info/", __import__('crm_app.views_document_portal', fromlist=['TokenInfoView']).TokenInfoView.as_view(), name="upload-portal-info"),
    path("upload-portal/<uuid:token_id>/request-otp/", __import__('crm_app.views_document_portal', fromlist=['RequestOTPView']).RequestOTPView.as_view(), name="upload-portal-request-otp"),
    path("upload-portal/<uuid:token_id>/verify-otp/", __import__('crm_app.views_document_portal', fromlist=['VerifyOTPView']).VerifyOTPView.as_view(), name="upload-portal-verify-otp"),
    path("upload-portal/<uuid:token_id>/upload/", __import__('crm_app.views_document_portal', fromlist=['UploadDocumentView']).UploadDocumentView.as_view(), name="upload-portal-upload"),
    
    # WhatsApp messaging endpoints
    path("whatsapp/send/", __import__('crm_app.views_whatsapp', fromlist=['SendWhatsAppMessageView']).SendWhatsAppMessageView.as_view(), name="whatsapp-send"),
    path("whatsapp/history/", __import__('crm_app.views_whatsapp', fromlist=['MessageHistoryView']).MessageHistoryView.as_view(), name="whatsapp-history"),
    path("whatsapp/stats/", __import__('crm_app.views_whatsapp', fromlist=['WhatsAppStatsView']).WhatsAppStatsView.as_view(), name="whatsapp-stats"),
    path("whatsapp/conversation/<int:lead_id>/", __import__('crm_app.views_whatsapp', fromlist=['LeadConversationView']).LeadConversationView.as_view(), name="whatsapp-conversation"),
    path("whatsapp/webhook/", __import__('crm_app.views_whatsapp', fromlist=['WhatsAppWebhookView']).WhatsAppWebhookView.as_view(), name="whatsapp-webhook"),
    
    # Message Templates (for post-call WhatsApp, etc.)
    path("templates/", __import__('crm_app.views_templates', fromlist=['MessageTemplateListView']).MessageTemplateListView.as_view(), name="template-list"),
    path("templates/<int:pk>/", __import__('crm_app.views_templates', fromlist=['MessageTemplateDetailView']).MessageTemplateDetailView.as_view(), name="template-detail"),
    path("templates/preview/", __import__('crm_app.views_templates', fromlist=['TemplatePreviewView']).TemplatePreviewView.as_view(), name="template-preview"),
    path("templates/<int:pk>/test-send/", __import__('crm_app.views_templates', fromlist=['TestSendTemplateView']).TestSendTemplateView.as_view(), name="template-test-send"),
]

urlpatterns += router.urls
