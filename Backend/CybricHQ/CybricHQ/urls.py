"""
URL configuration for CybricHQ project.
"""
from django.contrib import admin
from django.urls import path
from django.urls import include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/", include("crm_app.urls")),
    path("api/billing/", include("billing.urls")),  # Billing API
    path("api/ielts/", include("ielts_service.urls")),  # IELTS API
]

# Stripe webhook (separate for CSRF exemption)
from billing.urls import webhook_urlpatterns
urlpatterns += webhook_urlpatterns

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # Serve media files in production (if not handled by upstream server)
    from django.views.static import serve
    from django.urls import re_path
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]
