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
