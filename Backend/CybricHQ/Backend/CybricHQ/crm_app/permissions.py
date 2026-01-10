from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):
    """
    Permission class for super admin (platform-level) operations.
    Only allows access to users with is_superuser=True.
    Used by the admin-panel for tenant/product management.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.is_superuser
        )


class IsTenantAdmin(BasePermission):
    """
    Permission class for tenant admin operations.
    Allows access to users who are either:
    - Superusers (platform admins)
    - Tenant admins (is_tenant_admin=True on their profile)
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        # Check if user has tenant admin privileges
        try:
            return request.user.profile.is_tenant_admin
        except AttributeError:
            return False


def RolePermission(role_name):
    class _RolePermission(BasePermission):
        def has_permission(self, request, view):
            if not request.user or not request.user.is_authenticated:
                return False
            if request.user.is_superuser:
                return True
            return request.user.groups.filter(name=role_name).exists()
    return _RolePermission
