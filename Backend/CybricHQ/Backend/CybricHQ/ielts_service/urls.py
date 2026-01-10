from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import auth_views
from . import speaking_views

# Public/Student routes
router = DefaultRouter()
router.register(r'tests', views.IELTSTestViewSet, basename='ielts-test')
router.register(r'sessions', views.UserTestSessionViewSet, basename='ielts-session')

# Admin routes
admin_router = DefaultRouter()
admin_router.register(r'tests', views.AdminIELTSTestViewSet, basename='admin-test')
admin_router.register(r'modules', views.AdminTestModuleViewSet, basename='admin-module')
admin_router.register(r'question-groups', views.AdminQuestionGroupViewSet, basename='admin-question-group')
admin_router.register(r'questions', views.AdminQuestionViewSet, basename='admin-question')
admin_router.register(r'students', views.AdminStudentViewSet, basename='admin-student')

urlpatterns = [
    # Auth routes
    path('auth/register/', auth_views.register_view, name='ielts-register'),
    path('auth/login/', auth_views.login_view, name='ielts-login'),
    path('auth/google/', auth_views.google_auth_view, name='ielts-google-auth'),
    path('auth/me/', auth_views.me_view, name='ielts-me'),
    path('auth/logout/', auth_views.logout_view, name='ielts-logout'),
    path('auth/onboarding/', auth_views.update_onboarding_view, name='ielts-onboarding'),
    
    # Speaking Test routes
    path('speaking/sessions/', speaking_views.create_speaking_session, name='speaking-create-session'),
    path('speaking/sessions/<uuid:session_id>/', speaking_views.get_speaking_session, name='speaking-get-session'),
    path('speaking/sessions/<uuid:session_id>/complete/', speaking_views.complete_speaking_session, name='speaking-complete-session'),
    path('speaking/history/', speaking_views.list_speaking_sessions, name='speaking-history'),
    path('speaking/responses/<uuid:response_id>/', speaking_views.get_speaking_response, name='speaking-get-response'),
    path('speaking/stats/', speaking_views.speaking_statistics, name='speaking-stats'),
    path('speaking/recordings/upload/', speaking_views.upload_speaking_recording, name='speaking-upload-recording'),
    path('speaking/recordings/', speaking_views.list_speaking_recordings, name='speaking-list-recordings'),
    path('speaking/evaluate/', speaking_views.evaluate_speaking_session, name='speaking-evaluate'),
    path('speaking/evaluate-part/', speaking_views.evaluate_speaking_part_proxy, name='speaking-evaluate-part'),
    path('speaking/save-results/', speaking_views.save_speaking_results, name='speaking-save-results'),
    
    # API routes
    path('', include(router.urls)),
    path('admin/', include(admin_router.urls)),
    path('analyze-handwriting/', views.analyze_handwriting, name='analyze-handwriting'),
    path('text-to-speech/', views.text_to_speech, name='text-to-speech'),
    path('speech-to-text/', views.speech_to_text, name='speech-to-text'),
    path('ping/', views.ping_view, name='ielts-ping'),
]

