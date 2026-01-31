from django.urls import path, include
from django.views.decorators.csrf import csrf_exempt
from rest_framework.routers import DefaultRouter
from . import views
from . import auth_views

# Public/Student routes
router = DefaultRouter()
router.register(r'tests', views.IELTSTestViewSet, basename='ielts-test')
router.register(r'sessions', views.UserTestSessionViewSet, basename='ielts-session')
router.register(r'tickets', views.SupportTicketViewSet, basename='support-ticket')

# Admin routes
admin_router = DefaultRouter()
admin_router.register(r'tests', views.AdminIELTSTestViewSet, basename='admin-test')
admin_router.register(r'modules', views.AdminTestModuleViewSet, basename='admin-module')
admin_router.register(r'question-groups', views.AdminQuestionGroupViewSet, basename='admin-question-group')
admin_router.register(r'questions', views.AdminQuestionViewSet, basename='admin-question')
admin_router.register(r'students', views.AdminStudentViewSet, basename='admin-student')
admin_router.register(r'tickets', views.SupportTicketViewSet, basename='admin-ticket')

# Helper to wrap all admin router URLs with csrf_exempt
def csrf_exempt_view(view):
    """Wrap a view with csrf_exempt"""
    return csrf_exempt(view)

urlpatterns = [
    # IELTS Auth endpoints
    path('auth/login/', auth_views.ielts_login, name='ielts-login'),
    path('auth/logout/', auth_views.ielts_logout, name='ielts-logout'),
    path('auth/me/', auth_views.ielts_me, name='ielts-me'),
    path('auth/google/', auth_views.ielts_google_auth, name='ielts-google-auth'),
    path('auth/register/', auth_views.ielts_register, name='ielts-register'),
    path('auth/onboarding/', auth_views.ielts_onboarding, name='ielts-onboarding'),
    path('auth/update-profile/', auth_views.update_user_profile, name='update-user-profile'),
    
    # Speaking evaluation endpoints
    path('speaking/evaluate-part/', views.evaluate_speaking_part, name='evaluate-speaking-part'),
    path('speaking/save-results/', views.save_speaking_results, name='save-speaking-results'),
    path('speaking/recordings/upload/', views.upload_speaking_recording, name='upload-speaking-recording'),
    path('evaluator-health/', views.check_evaluator_health, name='evaluator-health'),
    
    # Test completion check (for blocking repeat attempts)
    path('check-completion/<str:module_type>/<str:test_id>/', views.check_test_completion, name='check-test-completion'),
    
    # Main IELTS routes
    path('', include(router.urls)),
    path('admin/', include(admin_router.urls)),
    path('admin/import-test/', csrf_exempt(views.import_test), name='import-test'),
    path('analyze-handwriting/', views.analyze_handwriting, name='analyze-handwriting'),
    path('text-to-speech/', views.text_to_speech, name='text-to-speech'),
    path('speech-to-text/', views.speech_to_text, name='speech-to-text'),
]

# Apply csrf_exempt to all admin router patterns
for url in admin_router.urls:
    url.callback = csrf_exempt(url.callback)

