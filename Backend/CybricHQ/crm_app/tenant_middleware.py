"""
Tenant middleware for multi-tenant white-label support.
Automatically detects and sets the current tenant on each request.
"""
import logging
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class TenantMiddleware(MiddlewareMixin):
    """
    Middleware to identify tenant from:
    1. Custom domain (TenantSettings.custom_domain)
    2. Subdomain pattern (e.g., client1.cybrikhq.com)
    3. Authenticated user's tenant (from UserProfile)
    
    Sets request.tenant for use throughout the request lifecycle.
    """
    
    def process_request(self, request):
        # Import here to avoid circular imports
        from crm_app.models import TenantSettings, Tenant
        
        tenant = None
        host = request.get_host().split(':')[0]  # Remove port if present
        
        # 1. Try custom domain match first (highest priority)
        try:
            settings_obj = TenantSettings.objects.select_related('tenant').filter(
                custom_domain=host,
                tenant__is_active=True
            ).first()
            if settings_obj:
                tenant = settings_obj.tenant
        except Exception:
            pass
        
        # 2. Try subdomain pattern (e.g., tenant-slug.cybrikhq.com)
        if not tenant:
            # Extract subdomain from host
            # Assuming format: <tenant-slug>.cybrikhq.com or <tenant-slug>.localhost
            parts = host.split('.')
            if len(parts) >= 2:
                potential_slug = parts[0]
                # Skip if it's common non-tenant subdomains
                if potential_slug not in ['www', 'api', 'admin', 'localhost', '127']:
                    try:
                        tenant = Tenant.objects.filter(
                            slug=potential_slug,
                            is_active=True
                        ).first()
                    except Exception:
                        pass
        
        # 3. Try from authenticated user's profile
        if not tenant:
            user = request.user
            # Fallback: If not authenticated via session/headers, try JWT cookie
            if not user.is_authenticated:
                try:
                    from django.conf import settings
                    from rest_framework_simplejwt.tokens import AccessToken
                    from django.contrib.auth import get_user_model

                    cookie_name = getattr(settings, "ACCESS_COOKIE_NAME", "cyb_access_v2")
                    token = request.COOKIES.get(cookie_name) or request.COOKIES.get("cyb_access")
                    
                    if token:
                        access = AccessToken(token)
                        user_id = access.get("user_id")
                        User = get_user_model()
                        user = User.objects.get(pk=user_id)
                        logger.debug(f"Resolved user from JWT: {user.username}")
                except Exception as e:
                    logger.debug(f"JWT decode failed: {e}")
                    pass

            if user and user.is_authenticated:
                try:
                    if hasattr(user, 'profile') and user.profile.tenant:
                        tenant = user.profile.tenant
                        logger.debug(f"Resolved tenant from profile: {tenant.slug}")
                except Exception as e:
                    logger.debug(f"Profile tenant lookup failed: {e}")
                    pass
        
        # Set tenant on request for downstream use
        request.tenant = tenant
        
        return None  # Continue processing
    
    def process_response(self, request, response):
        """
        Optionally add tenant info to response headers for debugging.
        """
        if hasattr(request, 'tenant') and request.tenant:
            # Only add in debug mode or for internal use
            response['X-Tenant-ID'] = str(request.tenant.id)
            response['X-Tenant-Slug'] = request.tenant.slug
        return response
