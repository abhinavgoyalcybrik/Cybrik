"""
Tenant middleware for multi-tenant white-label support.
Automatically detects and sets the current tenant on each request.
"""
from django.utils.deprecation import MiddlewareMixin


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
        
        
        # 3. Try from Header (Explicit Selection)
        if not tenant:
            tenant_slug = request.headers.get('X-Tenant-Slug')
            if tenant_slug:
                try:
                    tenant = Tenant.objects.filter(slug=tenant_slug, is_active=True).first()
                except Exception:
                    pass
        
        # 4. Try from authenticated user's profile
        if not tenant:
            user = request.user
            # Fallback: If not authenticated via session/headers, try JWT cookie
            if not user.is_authenticated:
                try:
                    from django.conf import settings
                    from rest_framework_simplejwt.tokens import AccessToken
                    from django.contrib.auth import get_user_model
                    import datetime
                    
                    with open('middleware_debug.log', 'a') as f:
                         f.write(f"\n[{datetime.datetime.now()}] Middleware processing {request.path}\n")
                         f.write(f"Cookies keys: {list(request.COOKIES.keys())}\n")

                    cookie_name = getattr(settings, "ACCESS_COOKIE_NAME", "cyb_access_v2")
                    token = request.COOKIES.get(cookie_name) or request.COOKIES.get("cyb_access")
                    
                    if token:
                        access = AccessToken(token)
                        user_id = access.get("user_id")
                        User = get_user_model()
                        user = User.objects.get(pk=user_id)
                        with open('middleware_debug.log', 'a') as f:
                             f.write(f"Resolved user from JWT: {user.username}\n")
                    else:
                        with open('middleware_debug.log', 'a') as f:
                             f.write(f"No token found in cookies. Expected {cookie_name}\n")
                except Exception as e:
                    with open('middleware_debug.log', 'a') as f:
                         f.write(f"JWT Decode Exception: {e}\n")
                    pass

            if user and user.is_authenticated:
                try:
                    if hasattr(user, 'profile') and user.profile.tenant:
                        tenant = user.profile.tenant
                        with open('middleware_debug.log', 'a') as f:
                             f.write(f"Resolved tenant from profile: {tenant.slug}\\n")
                except Exception as e:
                    # Fallback: Query UserProfile from PUBLIC schema explicitly
                    try:
                        from crm_app.models import UserProfile
                        from django.db import connection
                        with connection.cursor() as cursor:
                            cursor.execute("SET search_path TO public")
                        profile = UserProfile.objects.filter(user=user).first()
                        if profile and profile.tenant:
                            tenant = profile.tenant
                            with open('middleware_debug.log', 'a') as f:
                                 f.write(f"Resolved tenant from PUBLIC profile: {tenant.slug}\\n")
                    except Exception as fallback_err:
                        with open('middleware_debug.log', 'a') as f:
                             f.write(f"Profile Tenant Lookup Exception: {e}, Fallback Exception: {fallback_err}\\n")
                        pass
        
        # Set tenant on request for downstream use
        request.tenant = tenant
        
        # Switch to Tenant Schema (Isolated Database)
        if tenant and hasattr(tenant, 'database_schema') and tenant.database_schema:
            from django.db import connection
            cursor = connection.cursor()
            cursor.execute(f'SET search_path TO "{tenant.database_schema}", "public"')
        
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
