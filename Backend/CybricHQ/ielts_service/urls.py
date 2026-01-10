from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Import auth views from crm_app
from crm_app import auth_views

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

urlpatterns = [
    # Auth endpoints (reuse CRM auth)
    path('auth/login/', auth_views.login_view, name='ielts-login'),
    path('auth/logout/', auth_views.logout_view, name='ielts-logout'),
    path('auth/refresh/', auth_views.refresh_view, name='ielts-refresh'),
    path('auth/me/', auth_views.me_view, name='ielts-me'),
    
    # Main IELTS routes
    path('', include(router.urls)),
    path('admin/', include(admin_router.urls)),
    path('analyze-handwriting/', views.analyze_handwriting, name='analyze-handwriting'),
    path('text-to-speech/', views.text_to_speech, name='text-to-speech'),
    path('speech-to-text/', views.speech_to_text, name='speech-to-text'),
]
