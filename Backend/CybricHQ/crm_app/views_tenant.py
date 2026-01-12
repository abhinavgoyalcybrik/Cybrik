"""
Tenant API views for white-label multi-tenant support.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from crm_app.models import Tenant, TenantSettings
from crm_app.serializers_tenant import (
    TenantBrandingSerializer,
    TenantSettingsSerializer,
    TenantSerializer
)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_tenant_branding(request):
    """
    Get branding for the current tenant (public endpoint, no auth required).
    Tenant is determined from:
    1. request.tenant (set by middleware)
    2. Authenticated user's profile tenant (fallback)
    3. Query param ?tenant=<slug> (for development)
    """
    from crm_app.models import UserProfile
    
    tenant = getattr(request, 'tenant', None)
    
    # Fallback: If no tenant from middleware, try authenticated user's profile
    if not tenant and request.user and request.user.is_authenticated:
        try:
            profile = UserProfile.objects.select_related('tenant').filter(
                user=request.user
            ).first()
            if profile and profile.tenant:
                tenant = profile.tenant
        except Exception:
            pass
    
    # Fallback: check query param for dev/testing
    if not tenant:
        tenant_slug = request.query_params.get('tenant')
        if tenant_slug:
            tenant = Tenant.objects.filter(slug=tenant_slug, is_active=True).first()
    
    if not tenant:
        # Return default branding if no tenant found
        return Response({
            'tenant_id': None,
            'name': 'CybrikHQ',
            'slug': 'default',
            'company_name': 'CybrikHQ',
            'logo': None,
            'logo_url': None,
            'favicon_url': None,
            'primary_color': '#6366f1',
            'secondary_color': '#4f46e5',
            'accent_color': '#8b5cf6',
            'support_email': None,
            'website_url': None,
        })
    
    try:
        settings_obj = tenant.settings
    except TenantSettings.DoesNotExist:
        # Create default settings if not exist
        settings_obj = TenantSettings.objects.create(
            tenant=tenant,
            company_name=tenant.name
        )
    
    serializer = TenantBrandingSerializer(settings_obj)
    return Response(serializer.data)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def tenant_settings(request):
    """
    Get or update tenant settings (requires tenant admin or staff).
    """
    # Get user's tenant
    if not hasattr(request.user, 'profile') or not request.user.profile.tenant:
        return Response(
            {'error': 'User is not associated with any tenant'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    tenant = request.user.profile.tenant
    
    # Check if user can manage tenant settings
    is_admin = request.user.is_staff or request.user.profile.is_tenant_admin
    if not is_admin:
        return Response(
            {'error': 'Only tenant administrators can access this endpoint'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        settings_obj = tenant.settings
    except TenantSettings.DoesNotExist:
        settings_obj = TenantSettings.objects.create(
            tenant=tenant,
            company_name=tenant.name
        )
    
    if request.method == 'GET':
        serializer = TenantSettingsSerializer(settings_obj)
        return Response(serializer.data)
    
    elif request.method == 'PATCH':
        serializer = TenantSettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_tenant(request):
    """
    Get the current user's tenant info.
    """
    if not hasattr(request.user, 'profile') or not request.user.profile.tenant:
        return Response(
            {'tenant': None, 'message': 'User is not associated with any tenant'},
            status=status.HTTP_200_OK
        )
    
    tenant = request.user.profile.tenant
    serializer = TenantSerializer(tenant)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_usage(request):
    """
    Get usage statistics for the current tenant.
    Query params:
        - year: Year to filter (default: current year)
        - month: Month to filter (default: current month)
    """
    from crm_app.models import TenantUsage, UserProfile
    from django.utils import timezone
    
    # Get tenant
    tenant = getattr(request, 'tenant', None)
    if not tenant:
        try:
            profile = UserProfile.objects.select_related('tenant').filter(user=request.user).first()
            if profile and profile.tenant:
                tenant = profile.tenant
        except Exception:
            pass
    
    if not tenant:
        return Response(
            {'error': 'No tenant associated with user'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Parse query params
    now = timezone.now()
    year = int(request.query_params.get('year', now.year))
    month = request.query_params.get('month')
    
    if month:
        # Get specific month
        try:
            usage = TenantUsage.objects.get(tenant=tenant, year=year, month=int(month))
            return Response({
                'tenant': tenant.name,
                'period': f"{year}/{int(month):02d}",
                'smartflo_calls_made': usage.smartflo_calls_made,
                'smartflo_calls_answered': usage.smartflo_calls_answered,
                'smartflo_call_minutes': float(usage.smartflo_call_minutes),
                'ai_api_calls': usage.ai_api_calls,
                'ai_tokens_used': usage.ai_tokens_used,
                'leads_created': usage.leads_created,
                'emails_sent': usage.emails_sent,
                'sms_sent': usage.sms_sent,
                'whatsapp_messages_sent': usage.whatsapp_messages_sent,
            })
        except TenantUsage.DoesNotExist:
            return Response({
                'tenant': tenant.name,
                'period': f"{year}/{int(month):02d}",
                'smartflo_calls_made': 0,
                'smartflo_calls_answered': 0,
                'smartflo_call_minutes': 0,
                'ai_api_calls': 0,
                'ai_tokens_used': 0,
                'leads_created': 0,
                'emails_sent': 0,
                'sms_sent': 0,
                'whatsapp_messages_sent': 0,
            })
    else:
        # Get all months for the year
        usage_records = TenantUsage.objects.filter(tenant=tenant, year=year).order_by('month')
        records = []
        for usage in usage_records:
            records.append({
                'month': usage.month,
                'period': f"{year}/{usage.month:02d}",
                'smartflo_calls_made': usage.smartflo_calls_made,
                'smartflo_calls_answered': usage.smartflo_calls_answered,
                'smartflo_call_minutes': float(usage.smartflo_call_minutes),
                'ai_api_calls': usage.ai_api_calls,
                'leads_created': usage.leads_created,
            })
        
        # Calculate totals
        totals = {
            'smartflo_calls_made': sum(r['smartflo_calls_made'] for r in records),
            'smartflo_calls_answered': sum(r['smartflo_calls_answered'] for r in records),
            'smartflo_call_minutes': sum(r['smartflo_call_minutes'] for r in records),
            'ai_api_calls': sum(r['ai_api_calls'] for r in records),
            'leads_created': sum(r['leads_created'] for r in records),
        }
        
        return Response({
            'tenant': tenant.name,
            'year': year,
            'months': records,
            'totals': totals,
        })
