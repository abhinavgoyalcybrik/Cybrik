from rest_framework.permissions import BasePermission

def RolePermission(role_name):
    class _RolePermission(BasePermission):
        def has_permission(self, request, view):
            if not request.user or not request.user.is_authenticated:
                return False
            if request.user.is_superuser:
                return True
            return request.user.groups.filter(name=role_name).exists()
    return _RolePermission
