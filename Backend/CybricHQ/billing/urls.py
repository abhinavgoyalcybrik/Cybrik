# billing/urls.py
"""
URL configuration for billing API.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import webhooks

router = DefaultRouter()
router.register(r'products', views.ProductViewSet, basename='product')
router.register(r'plans', views.PlanViewSet, basename='plan')
router.register(r'subscriptions', views.SubscriptionViewSet, basename='subscription')
router.register(r'purchases', views.PurchaseViewSet, basename='purchase')
router.register(r'invoices', views.InvoiceViewSet, basename='invoice')
router.register(r'payment-logs', views.PaymentLogViewSet, basename='payment-log')
router.register(r'audit-logs', views.AuditLogViewSet, basename='audit-log')
router.register(r'reports', views.ReportsViewSet, basename='report')
router.register(r'razorpay', views.RazorpayViewSet, basename='razorpay')

urlpatterns = [
    path('', include(router.urls)),
]

# Webhook URL (separate from API router for CSRF exemption)
webhook_urlpatterns = [
    path('webhooks/stripe/', webhooks.stripe_webhook, name='stripe-webhook'),
]
