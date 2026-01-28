from django.urls import path, include
# Force reload
from rest_framework.routers import DefaultRouter
from .views import ElevenLabsPostcallWebhook
from . import auth_views
from . import views
from .views import TranscriptASRCallback, DashboardSummary, ElevenLabsWebhookView, ReportsSummary
from .views_leads import PortalLeadView, WalkInLeadView, WebLeadView
from .views_dashboard import dashboard_overview
from . import views_elevenlabs
from . import views_analytics
from . import views_dashboard
from .views_demo import health, csrf_cookie
from .views_ai import AIAnalysisViewSet, DocumentVerificationViewSet
from . import views_search
from .views_rbac import RoleViewSet, UserRoleAssignmentView, UserProfileViewSet
from . import views_notifications
from .views_integrations import (
    AdIntegrationViewSet, AdCampaignViewSet,
    meta_oauth_init, meta_oauth_callback, meta_get_accounts
)
from . import views_tenant  # Multi-tenant / white-label

app_name = "crm_app"


router = DefaultRouter()
router.register(r"applicants", views.ApplicantViewSet, basename="applicant")
router.register(r"academic-records", views.AcademicRecordViewSet, basename="academicrecord")
router.register(r"applications", views.ApplicationViewSet, basename="application")
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

# Tenant Admin
from .views_tenant_admin import TenantViewSet, ProductViewSet
router.register(r"admin/tenants", TenantViewSet, basename="admin-tenant")
router.register(r"admin/products", ProductViewSet, basename="admin-product")

# Usage Tracking (Admin)
from .views_usage import (
    UsageLogViewSet, UsageSummaryViewSet,
    UsageQuotaViewSet, UsageAlertViewSet,
    tenant_usage_dashboard, tenant_usage_history, tenant_usage_logs
)
router.register(r"admin/usage/logs", UsageLogViewSet, basename="admin-usage-logs")
router.register(r"admin/usage/summaries", UsageSummaryViewSet, basename="admin-usage-summaries")
router.register(r"admin/usage/quotas", UsageQuotaViewSet, basename="admin-usage-quotas")
router.register(r"admin/usage/alerts", UsageAlertViewSet, basename="admin-usage-alerts")

urlpatterns = [
    # Lead intake endpoint (must be before router to avoid collision with leads/<pk>/)
    path("leads/portal/", PortalLeadView.as_view(), name="portal-lead"),
    path("leads/walk-in/", WalkInLeadView.as_view(), name="walk-in-lead"),
    path("web-leads/", WebLeadView.as_view(), name="web-lead"),

    # auth-like endpoints
    path("auth/login/", auth_views.login_view, name="api_login"),
    path("auth/login", auth_views.login_view, name="api_login_noslash"),
    path("auth/refresh/", auth_views.refresh_view, name="api_refresh"),
    path("auth/refresh", auth_views.refresh_view, name="api_refresh_noslash"),
    path("auth/logout/", auth_views.logout_view, name="api_logout"),
    path("auth/logout", auth_views.logout_view, name="api_logout_noslash"),
    path("auth/me/", auth_views.me_view, name="api_me"),
    path("auth/me", auth_views.me_view, name="api_me_noslash"),
    path("auth/change-password/", auth_views.change_password_view, name="api_change_password"),

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
    path("dashboard/country-stats/", views_dashboard.country_wise_stats, name="dashboard-country-stats"),
    path("dashboard/config/", views_dashboard.get_dashboard_config, name="get-dashboard-config"),
    path("dashboard/config/save/", views_dashboard.save_dashboard_config, name="save-dashboard-config"),
    path("dashboard/config/save-role/", views_dashboard.save_role_config, name="save-role-config"),
    path("dashboard/config/get-role/", views_dashboard.get_role_config, name="get-role-config"),
    
    # RBAC endpoints
    path("users/assign-role/", UserRoleAssignmentView.as_view(), name="user-role-assignment"),
    
    # Global Search
    path("search/", views_search.GlobalSearchView.as_view(), name="global-search"),
    
    # Meta Ads OAuth
    path("integrations/meta_ads/oauth/init/", meta_oauth_init, name="meta-oauth-init"),
    path("integrations/meta_ads/callback/", meta_oauth_callback, name="meta-oauth-callback"),
    path("integrations/meta_ads/accounts/<str:temp_token>/", meta_get_accounts, name="meta-get-accounts"),
    
    # AI Call Scheduling
    path("ai-calls/schedule/", views.ScheduleAICallView.as_view(), name="schedule-ai-call"),
    path("ai-calls/trigger/", views.TriggerAICallNowView.as_view(), name="trigger-ai-call"),
    path("ai-calls/process-due/", views.ProcessDueAICallsView.as_view(), name="process-due-ai-calls"),
    path("ai-calls/sync-elevenlabs/", views.SyncElevenLabsCallsView.as_view(), name="sync-elevenlabs-calls"),
    
    # Tenant / White-Label endpoints
    path("tenant/branding/", views_tenant.get_tenant_branding, name="tenant-branding"),
    path("tenant/settings/", views_tenant.tenant_settings, name="tenant-settings"),
    path("tenant/current/", views_tenant.current_tenant, name="current-tenant"),
    path("tenant/usage/", views_tenant.tenant_usage, name="tenant-usage"),
    
    # Tenant Usage Tracking
    path("tenant/usage/dashboard/", tenant_usage_dashboard, name="tenant-usage-dashboard"),
    path("tenant/usage/history/", tenant_usage_history, name="tenant-usage-history"),
    path("tenant/usage/logs/", tenant_usage_logs, name="tenant-usage-logs"),
    
    # Smartflo AI Calling endpoints
    path("smartflo/call/initiate/", __import__('crm_app.smartflo_api', fromlist=['initiate_ai_call']).initiate_ai_call, name="smartflo-initiate-call"),
    path("smartflo/call/end/", __import__('crm_app.smartflo_api', fromlist=['end_call']).end_call, name="smartflo-end-call"),
    path("smartflo/call/<str:call_sid>/status/", __import__('crm_app.smartflo_api', fromlist=['get_call_status']).get_call_status, name="smartflo-call-status"),
    path("smartflo/dialplan/", __import__('crm_app.smartflo_api', fromlist=['dialplan_webhook']).dialplan_webhook, name="smartflo-dialplan"),
    path("smartflo/dialplan", __import__('crm_app.smartflo_api', fromlist=['dialplan_webhook']).dialplan_webhook, name="smartflo-dialplan-noslash"),
    
    # Public Uploads
    path("public/upload/", __import__('crm_app.views_public', fromlist=['PublicUploadView']).PublicUploadView.as_view(), name="public-upload"),
    path("generate-upload-link/", __import__('crm_app.views_public', fromlist=['GenerateUploadLinkView']).GenerateUploadLinkView.as_view(), name="generate-upload-link"),
    
    # WhatsApp Business API
    path("whatsapp/webhook/", __import__('crm_app.views_whatsapp', fromlist=['whatsapp_webhook']).whatsapp_webhook, name="whatsapp-webhook"),
    path("whatsapp/send/", __import__('crm_app.views_whatsapp', fromlist=['send_whatsapp_message']).send_whatsapp_message, name="whatsapp-send"),
    path("whatsapp/send-document-request/", __import__('crm_app.views_whatsapp', fromlist=['send_document_upload_request']).send_document_upload_request, name="whatsapp-document-request"),
    path("whatsapp/config-status/", __import__('crm_app.views_whatsapp', fromlist=['whatsapp_config_status']).whatsapp_config_status, name="whatsapp-config-status"),
]

urlpatterns += router.urls
