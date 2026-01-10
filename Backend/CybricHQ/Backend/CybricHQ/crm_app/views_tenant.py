from rest_framework import viewsets, permissions
from rest_framework.response import Response
from .models import VoiceAgent, PhoneNumber, TelephonyConfig, Tenant
from .serializers_tenant import VoiceAgentSerializer, PhoneNumberSerializer, TelephonyConfigSerializer

class IsTenantAdmin(permissions.BasePermission):
    """
    Custom permission to only allow tenant admins to edit settings.
    For now, we allow any authenticated user with a tenant profile.
    """
    def has_permission(self, request, view):
        # Check if user is authenticated and belongs to a tenant
        if not request.user.is_authenticated:
            return False
        # Allow if user has a profile with a tenant (Expand logic later for strict 'admin' role)
        return hasattr(request.user, 'profile') and request.user.profile.tenant is not None

class TenantModelViewSet(viewsets.ModelViewSet):
    """Base ViewSet that filters by the user's tenant automatically."""
    permission_classes = [permissions.IsAuthenticated, IsTenantAdmin]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'profile') or not user.profile.tenant:
            return self.queryset.none()
        return self.queryset.filter(tenant=user.profile.tenant)

    def perform_create(self, serializer):
        user = self.request.user
        tenant = user.profile.tenant
        serializer.save(tenant=tenant)

class VoiceAgentViewSet(TenantModelViewSet):
    queryset = VoiceAgent.objects.all()
    serializer_class = VoiceAgentSerializer

class PhoneNumberViewSet(TenantModelViewSet):
    queryset = PhoneNumber.objects.all()
    serializer_class = PhoneNumberSerializer

class TelephonyConfigViewSet(TenantModelViewSet):
    queryset = TelephonyConfig.objects.all()
    serializer_class = TelephonyConfigSerializer

# ----------------------------------------------------------------------------
# PUBLIC / TENANT-AWARE ENDPOINTS
# ----------------------------------------------------------------------------

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_tenant_branding(request):
    """
    Get branding info for the authenticated user's tenant.
    Returns tenant-specific branding or safe defaults.
    """
    try:
        # Resolve tenant from authenticated user
        if not hasattr(request.user, 'profile') or not request.user.profile.tenant:
            # User has no tenant - return safe defaults
            return Response({
                "tenant_id": None,
                "name": "CybricHQ",
                "logo": None,
                "primary_color": "#2563eb",
                "secondary_color": "#0f172a"
            })
        
        tenant = request.user.profile.tenant
        
        # Get tenant settings if they exist
        tenant_settings = getattr(tenant, 'settings', None)
        
        # Build response with tenant data
        # Build response with tenant data
        logo_url = None
        if tenant_settings:
            if tenant_settings.logo:
                try:
                    logo_url = request.build_absolute_uri(tenant_settings.logo.url)
                except Exception:
                    logo_url = tenant_settings.logo.url
            elif hasattr(tenant_settings, 'logo_url') and tenant_settings.logo_url:
                logo_url = tenant_settings.logo_url

        branding_data = {
            "tenant_id": tenant.id,
            "name": tenant_settings.company_name if tenant_settings and tenant_settings.company_name else tenant.name,
            "logo": logo_url,
            "primary_color": tenant_settings.primary_color if tenant_settings and hasattr(tenant_settings, 'primary_color') else "#2563eb",
            "secondary_color": tenant_settings.secondary_color if tenant_settings and hasattr(tenant_settings, 'secondary_color') else "#0f172a"
        }
        
        return Response(branding_data)
        
    except Exception as e:
        # Never crash - return safe defaults on any error
        return Response({
            "tenant_id": None,
            "name": "CybricHQ",
            "logo": None,
            "primary_color": "#2563eb",
            "secondary_color": "#0f172a"
        })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_settings(request):
    """
    Get settings for the authenticated user's tenant.
    """
    if hasattr(request.user, 'profile') and request.user.profile.tenant:
        tenant = request.user.profile.tenant
        return Response({
            "id": tenant.id,
            "name": tenant.name,
            # Add other settings here
        })
    return Response({"error": "No tenant found"}, status=404)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_tenant(request):
    """
    Return simple info about current tenant context.
    """
    if hasattr(request.user, 'profile') and request.user.profile.tenant:
        t = request.user.profile.tenant
        return Response({
            "id": t.id,
            "name": t.name,
            "slug": t.slug
        })
    return Response(None)
