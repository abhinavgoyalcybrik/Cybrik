from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

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
    path('', include(router.urls)),
    path('admin/', include(admin_router.urls)),
    path('analyze-handwriting/', views.analyze_handwriting, name='analyze-handwriting'),
    path('text-to-speech/', views.text_to_speech, name='text-to-speech'),
    path('speech-to-text/', views.speech_to_text, name='speech-to-text'),
]

