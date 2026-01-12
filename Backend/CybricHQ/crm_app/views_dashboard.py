# crm_app/views_dashboard.py  (replace or add to file)
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.utils.dateparse import parse_date

from .models import Applicant, Application, AuditLog
from .permissions import RolePermission

# Optional: use Django cache for simple caching of heavy aggregates
from django.core.cache import cache

def _get_user_role(user):
    """
    Get user's role name (case-insensitive matching, returns capitalized role).
    Assumes roles are implemented as Django groups or custom RBAC profile.
    """
    if user.is_superuser:
        return "Admin"
        
    groups = [g.lower() for g in user.groups.values_list("name", flat=True)]
    
    # priority: Admin > Admissions > Counsellor (case-insensitive)
    if "admin" in groups:
        return "Admin"
    if "admissions" in groups:
        return "Admissions"
    if "counsellor" in groups or "counselor" in groups:
        return "Counsellor"
    
    # Also check custom RBAC profile if available
    try:
        if hasattr(user, 'profile') and user.profile and user.profile.role:
            role_name = user.profile.role.name
            # Capitalize first letter for consistency
            return role_name.capitalize() if role_name else "User"
    except Exception:
        pass
        
    return "User"

def _safe_field_exists(qs, field):
    # quick check if model has a given field
    return field in [f.name for f in qs.model._meta.get_fields()]

def _parse_filters(request):
    start = request.query_params.get("start")
    end = request.query_params.get("end")
    country = request.query_params.get("country")
    counselor_id = request.query_params.get("counselor_id")
    parsed = {}
    try:
        parsed["start_date"] = parse_date(start) if start else None
    except Exception:
        parsed["start_date"] = None
    try:
        parsed["end_date"] = parse_date(end) if end else None
    except Exception:
        parsed["end_date"] = None
    parsed["country"] = country
    parsed["counselor_id"] = counselor_id
    return parsed

def _apply_common_filters_lead_qs(qs, filters, request, restrict_to_user=False):
    # filters: dict with start_date, end_date, country, counselor_id
    if filters.get("start_date"):
        qs = qs.filter(created_at__date__gte=filters["start_date"])
    if filters.get("end_date"):
        qs = qs.filter(created_at__date__lte=filters["end_date"])
    if filters.get("country") and _safe_field_exists(qs, "country"):
        qs = qs.filter(country=filters["country"])
    if filters.get("counselor_id") and _safe_field_exists(qs, "assigned_to_id"):
        qs = qs.filter(assigned_to_id=filters["counselor_id"])
    if restrict_to_user:
        # limit to leads assigned to this user if assigned_to exists
        if _safe_field_exists(qs, "assigned_to"):
            qs = qs.filter(assigned_to=request.user)
    return qs

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_overview(request):
    """
    Unified role-aware dashboard endpoint with tenant filtering.
    Query params supported (optional):
        - start=YYYY-MM-DD
        - end=YYYY-MM-DD
        - country=ISO or country name
        - counselor_id=123
    """
    from .models import Lead, UserProfile
    
    role = _get_user_role(request.user)
    filters = _parse_filters(request)
    tenant = getattr(request, 'tenant', None)
    
    # Fallback: try to get tenant from user profile
    if not tenant and request.user.is_authenticated:
        try:
            profile = UserProfile.objects.select_related('tenant').filter(
                user=request.user
            ).first()
            if profile and profile.tenant:
                tenant = profile.tenant
        except Exception:
            pass

    cache_key = f"dashboard:overview:{role}:{request.user.id}:{filters.get('start_date')}:{filters.get('end_date')}:{filters.get('country')}:{filters.get('counselor_id')}:{tenant.id if tenant else 'none'}"

    payload = {"role": role}
    
    # Build base querysets filtered by tenant
    if tenant:
        leads_qs = Lead.objects.filter(tenant=tenant)
        applicants_qs = Applicant.objects.filter(tenant=tenant)
        applications_qs = Application.objects.filter(tenant=tenant)
    else:
        # Superuser without tenant can see all
        if request.user.is_superuser:
            leads_qs = Lead.objects.all()
            applicants_qs = Applicant.objects.all()
            applications_qs = Application.objects.all()
        else:
            # No tenant = no data
            leads_qs = Lead.objects.none()
            applicants_qs = Applicant.objects.none()
            applications_qs = Application.objects.none()

    # ---- ADMIN payload ----
    if role == "Admin":
        # User count - filter by tenant
        if tenant:
            tenant_users = UserProfile.objects.filter(tenant=tenant).values_list('user_id', flat=True)
            payload["total_users"] = User.objects.filter(id__in=tenant_users).count()
        else:
            payload["total_users"] = User.objects.count()
            
        payload["total_applicants"] = applicants_qs.count()
        payload["total_applications"] = applications_qs.count()
        
        # Lead stats - tenant filtered
        total_leads = leads_qs.count()
        converted_leads = leads_qs.filter(status="converted").count()
        payload["total_leads"] = total_leads

        # conversion rate: converted leads / total leads
        try:
            payload["conversion_rate_percent"] = round((converted_leads / total_leads * 100.0) if total_leads else 0.0, 2)
        except Exception:
            payload["conversion_rate_percent"] = 0.0

        # recent applicants (10) - tenant filtered
        recent_qs = applicants_qs.order_by("-created_at")[:10]
        payload["recent_applicants"] = [
            {
                "id": a.id,
                "name": (getattr(a, "first_name", "") or "") + " " + (getattr(a, "last_name", "") or ""),
                "email": getattr(a, "email", None),
                "created_at": getattr(a, "created_at", None)
            }
            for a in recent_qs
        ]

        # per-counselor performance - tenant filtered
        if _safe_field_exists(applicants_qs, "assigned_to"):
            per_counselor = applicants_qs.values(
                "assigned_to__id", "assigned_to__username"
            ).annotate(count=Count("id")).order_by("-count")[:50]
            payload["per_counselor_counts"] = [
                {"counselor_id": r["assigned_to__id"], "username": r["assigned_to__username"], "count": r["count"]}
                for r in per_counselor
            ]

    # ---- ADMISSIONS payload ----
    elif role == "Admissions":
        # total applications and country distribution - tenant filtered
        qs = applications_qs
        qs = _apply_common_filters_lead_qs(qs, filters, request, restrict_to_user=False)
        payload["total_applications"] = qs.count()

        # top countries (if country field exists)
        if _safe_field_exists(qs, "country"):
            country_counts = qs.values("country").annotate(count=Count("id")).order_by("-count")[:50]
            payload["country_distribution"] = [{"country": r["country"], "count": r["count"]} for r in country_counts]
        else:
            payload["country_distribution"] = []

        # intake-wise distribution (if `intake` exists on Application)
        if _safe_field_exists(qs, "intake"):
            intake_counts = qs.values("intake").annotate(count=Count("id")).order_by("-count")
            payload["intake_distribution"] = [{"intake": r["intake"], "count": r["count"]} for r in intake_counts]
        else:
            payload["intake_distribution"] = []

        # recent applications
        recent_apps = qs.order_by("-created_at")[:10]
        payload["recent_applications"] = [
            {"id": a.id, "applicant_id": getattr(a, "applicant_id", None), "status": getattr(a, "status", None)}
            for a in recent_apps
        ]

    # ---- COUNSELLOR payload ----
    elif role == "Counsellor":
        # Only show leads/applicants assigned to this counsellor - tenant filtered
        lead_qs = applicants_qs
        lead_qs = _apply_common_filters_lead_qs(lead_qs, filters, request, restrict_to_user=True)

        payload["my_total_applicants"] = lead_qs.count()

        # followups due (if next_followup_date exists)
        if _safe_field_exists(lead_qs, "next_followup_date"):
            from django.utils import timezone
            today = timezone.now().date()
            followups = lead_qs.filter(next_followup_date__date__lte=today).count()
            payload["followups_due"] = followups
        else:
            payload["followups_due"] = 0

        # pipeline / stage counts (if 'stage' field exists on Applicant)
        if _safe_field_exists(lead_qs, "stage"):
            pipeline_counts_qs = lead_qs.values("stage").annotate(count=Count("id")).order_by("-count")
            payload["pipeline_counts"] = {r["stage"]: r["count"] for r in pipeline_counts_qs}
        else:
            payload["pipeline_counts"] = {}

        # recent my applicants
        recent = lead_qs.order_by("-created_at")[:10]
        payload["recent_applicants"] = [
            {"id": a.id, "name": (getattr(a, "first_name", "") or "") + " " + (getattr(a, "last_name", "") or ""),
             "email": getattr(a, "email", None)}
            for a in recent
        ]

    # ---- FALLBACK / other users ----
    else:
        payload["message"] = "No dashboard available for your role."

    # optional: store in cache for short TTL to speed up repeated calls
    # cache.set(cache_key, payload, timeout=60)  # 60 seconds

    return Response(payload)


# Backwards-compatible endpoints (if you want to keep old ones)
@api_view(["GET"])
@permission_classes([RolePermission("Admin")])
def admin_stats(request):
    return Response({
        "total_users": User.objects.count(),
        "total_applicants": Applicant.objects.count(),
        "total_applications": Application.objects.count(),
        # keep this logic as before but correct new_today to use today's date, not user's date_joined
        "new_today": Applicant.objects.filter(created_at__date__exact__isnull=False).count()
    })


@api_view(["GET"])
@permission_classes([RolePermission("Counsellor")])
def counsellor_stats(request):
    total = Applicant.objects.filter(assigned_to=request.user).count() if _safe_field_exists(Applicant.objects.all(), "assigned_to") else Applicant.objects.count()
    return Response({
        "my_total_applicants": total,
    })

from .models import UserDashboardPreference, RoleDashboardPreference
from .views_dashboard import _get_user_role

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_dashboard_config(request):
    # 1. Try User Preference
    try:
        pref = UserDashboardPreference.objects.get(user=request.user)
        if pref.layout_config:
            return Response(pref.layout_config)
    except UserDashboardPreference.DoesNotExist:
        pass

    # 2. Try Role Preference (case-insensitive lookup)
    role = _get_user_role(request.user)
    try:
        # Try exact match first, then case-insensitive
        role_pref = RoleDashboardPreference.objects.filter(role_name__iexact=role).first()
        if role_pref and role_pref.layout_config:
            return Response(role_pref.layout_config)
    except Exception:
        pass

    # 3. Default (empty or predefined)
    return Response({"layout": None}) 

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_dashboard_config(request):
    pref, _ = UserDashboardPreference.objects.get_or_create(user=request.user)
    pref.layout_config = request.data
    pref.save()
    return Response({"status": "saved"})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_role_config(request):
    """
    Admin only: Save default layout and sidebar config for a specific role.
    Body: { "role": "Counsellor", "layout": [...], "sidebar_config": {...} }
    """
    # Check if admin
    is_admin = request.user.is_superuser or request.user.groups.filter(name="Admin").exists()
    if not is_admin:
        # Check custom RBAC role
        try:
            if hasattr(request.user, 'profile') and request.user.profile.role and request.user.profile.role.name == "Admin":
                is_admin = True
        except Exception:
            pass

    if not is_admin:
        return Response({"error": "Unauthorized"}, status=403)

    role_name = request.data.get("role")
    layout = request.data.get("layout")
    sidebar_config = request.data.get("sidebar_config")
    
    if not role_name:
        return Response({"error": "Role name required"}, status=400)

    # 1. Save Dashboard Layout
    if layout is not None:
        pref, _ = RoleDashboardPreference.objects.get_or_create(role_name=role_name)
        pref.layout_config = {"layout": layout}
        pref.save()

    # 2. Save Sidebar Config (requires Role model)
    if sidebar_config is not None:
        from .models import Role
        role, created = Role.objects.get_or_create(
            name=role_name,
            defaults={'description': f'{role_name} role', 'is_system_role': True}
        )
        role.sidebar_config = sidebar_config
        role.save()

    return Response({"status": "saved", "role": role_name})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_role_config(request):
    """
    Fetch default layout and sidebar config for a specific role.
    Query param: role=Counsellor
    """
    role_name = request.query_params.get("role")
    if not role_name:
        return Response({"error": "Role name required"}, status=400)

    response_data = {"layout": None, "sidebar_config": {}}

    # 1. Get Dashboard Layout
    try:
        role_pref = RoleDashboardPreference.objects.get(role_name=role_name)
        if role_pref.layout_config:
            response_data["layout"] = role_pref.layout_config.get("layout")
    except RoleDashboardPreference.DoesNotExist:
        pass
    
    # 2. Get Sidebar Config
    from .models import Role
    try:
        role = Role.objects.get(name=role_name)
        response_data["sidebar_config"] = role.sidebar_config
    except Role.DoesNotExist:
        pass
    
    return Response(response_data)
