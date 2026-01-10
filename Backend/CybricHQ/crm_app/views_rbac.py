from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.db import transaction

from .models import Role, UserProfile
from .serializers import (
    RoleSerializer,
    UserProfileSerializer,
    UserRoleAssignmentSerializer,
)

User = get_user_model()


class RoleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing roles.
    Admin-only access.
    """
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAdminUser]

    def destroy(self, request, *args, **kwargs):
        """Prevent deletion of system roles"""
        role = self.get_object()
        if role.is_system_role:
            return Response(
                {"error": "Cannot delete system roles"},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def users(self, request, pk=None):
        """Get all users assigned to this role"""
        role = self.get_object()
        profiles = role.users.select_related('user').all()
        serializer = UserProfileSerializer(profiles, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def permission_schema(self, request):
        """
        Return the complete permission schema/template
        for building the permission UI
        """
        schema = {
            "applicants": {
                "view": {"label": "View Applicants", "default": True},
                "create": {"label": "Create Applicants", "default": False},
                "edit": {"label": "Edit Applicants", "default": False},
                "delete": {"label": "Delete Applicants", "default": False},
            },
            "applications": {
                "view": {"label": "View Applications", "default": True},
                "create": {"label": "Create Applications", "default": False},
                "edit": {"label": "Edit Applications", "default": False},
                "delete": {"label": "Delete Applications", "default": False},
                "approve": {"label": "Approve Applications", "default": False},
            },
            "calls": {
                "view": {"label": "View Calls", "default": True},
                "make_call": {"label": "Make Calls", "default": False},
                "view_transcript": {"label": "View Transcripts", "default": True},
            },
            "documents": {
                "view": {"label": "View Documents", "default": True},
                "upload": {"label": "Upload Documents", "default": False},
                "verify": {"label": "Verify Documents", "default": False},
                "delete": {"label": "Delete Documents", "default": False},
            },
            "analytics": {
                "view": {"label": "View Analytics", "default": True},
                "export": {"label": "Export Data", "default": False},
            },
            "followups": {
                "view": {"label": "View Follow-ups", "default": True},
                "create": {"label": "Create Follow-ups", "default": False},
                "edit": {"label": "Edit Follow-ups", "default": False},
                "delete": {"label": "Delete Follow-ups", "default": False},
            },
            "settings": {
                "view_roles": {"label": "View Roles", "default": False},
                "manage_roles": {"label": "Manage Roles", "default": False},
                "manage_users": {"label": "Manage Users", "default": False},
                "system_config": {"label": "System Configuration", "default": False},
            },
        }
        sidebar_items = {
            "dashboard": {"label": "Dashboard", "default": True},
            "applicants": {"label": "Applicants", "default": True},
            "applications": {"label": "Applications", "default": True},
            "calls": {"label": "Calls", "default": True},
            "documents": {"label": "Documents", "default": True},
            "analytics": {"label": "Analytics", "default": False},
            "followups": {"label": "Follow-ups", "default": True},
            "settings": {"label": "Settings", "default": False},
            "ai_insights": {"label": "AI Insights", "default": True},
        }
        dashboard_widgets = {
            "show_analytics": {"label": "Analytics Overview", "default": True},
            "show_applications_chart": {"label": "Applications Chart", "default": True},
            "show_cost_chart": {"label": "Cost Chart", "default": False},
            "show_funnel_chart": {"label": "Funnel Chart", "default": True},
            "show_llm_usage": {"label": "LLM Usage", "default": False},
            "show_recent_calls": {"label": "Recent Calls", "default": True},
            "show_followups": {"label": "Follow-ups", "default": True},
        }
        return Response({
            "permissions": schema,
            "sidebar_items": sidebar_items,
            "dashboard_widgets": dashboard_widgets,
        })


class UserRoleAssignmentView(APIView):
    """Assign or unassign roles to users"""
    permission_classes = [IsAdminUser]

    def post(self, request):
        """Assign a role to a user"""
        serializer = UserRoleAssignmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user_id = serializer.validated_data['user_id']
        role_id = serializer.validated_data.get('role_id')

        try:
            user = User.objects.get(id=user_id)
            
            with transaction.atomic():
                # Get or create user profile
                profile, created = UserProfile.objects.get_or_create(user=user)
                
                if role_id:
                    role = Role.objects.get(id=role_id)
                    profile.role = role
                else:
                    profile.role = None
                
                profile.save()

            return Response({
                "message": "Role assigned successfully",
                "user_id": user_id,
                "role_id": role_id,
                "role_name": profile.role.name if profile.role else None
            })
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Role.DoesNotExist:
            return Response({"error": "Role not found"}, status=status.HTTP_404_NOT_FOUND)


class UserProfileViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing user profiles with role information.
    Admin-only access.
    """
    queryset = UserProfile.objects.select_related('user', 'role').all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAdminUser]
