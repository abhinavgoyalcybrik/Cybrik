# auth_views.py
import logging
import os
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status, exceptions
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from django.contrib.auth import authenticate, get_user_model, logout as django_logout

logger = logging.getLogger(__name__)
User = get_user_model()

# Prefer centralized settings values if they exist, otherwise fall back to env defaults.
COOKIE_SECURE = getattr(
    settings,
    "COOKIE_SECURE",
    os.getenv("COOKIE_SECURE", "False").lower() in ("1", "true", "yes"),
)
COOKIE_SAMESITE = getattr(settings, "COOKIE_SAMESITE", os.getenv("COOKIE_SAMESITE", "Lax"))

ACCESS_COOKIE_NAME = getattr(
    settings, "ACCESS_COOKIE_NAME", os.getenv("ACCESS_COOKIE_NAME", "cyb_access_v2")
)
REFRESH_COOKIE_NAME = getattr(
    settings, "REFRESH_COOKIE_NAME", os.getenv("REFRESH_COOKIE_NAME", "cyb_refresh_v2")
)

# Legacy cookie names we used previously (kept here for safe cleanup/transition)
_LEGACY_ACCESS = "cyb_access"
_LEGACY_REFRESH = "cyb_refresh"


def set_cookie(resp, name, value, max_age):
    """
    Helper to set httpOnly cookie with configured flags.
    """
    # Use kwargs so older Django versions that don't support samesite don't fail
    try:
        resp.set_cookie(
            name,
            value,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            max_age=max_age,
            path="/",
        )
    except TypeError:
        # Fallback if set_cookie doesn't accept samesite on this Django version
        resp.set_cookie(
            name,
            value,
            httponly=True,
            secure=COOKIE_SECURE,
            max_age=max_age,
            path="/",
        )


def _clear_cookie_variants(resp, cookie_name):
    """
    Delete cookie variants to ensure it's cleared across browsers/paths/flags.
    """
    try:
        resp.delete_cookie(cookie_name, path="/", samesite=COOKIE_SAMESITE, secure=COOKIE_SECURE)
    except TypeError:
        # Some Django versions might not accept samesite/secure in delete_cookie signature
        try:
            resp.delete_cookie(cookie_name, path="/")
        except Exception:
            pass
    # Extra attempts for resilience
    try:
        resp.delete_cookie(cookie_name, path="/")
    except Exception:
        pass


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    """
    Login: authenticate user and set access+refresh cookies.
    Also validates that user's tenant has an active subscription.
    """
    username = request.data.get("username")
    password = request.data.get("password")
    logger.debug(f"Attempting login for user: {username}")

    user = authenticate(request, username=username, password=password)
    if not user:
        logger.warning(f"Authentication failed for user: {username}")
        return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

    logger.debug(f"Authentication successful for user: {user.username} (ID: {user.id})")

    # Subscription check - skip for superusers (platform admins)
    if not user.is_superuser:
        # Get user's tenant from profile
        tenant = None
        try:
            if hasattr(user, 'profile') and user.profile.tenant:
                tenant = user.profile.tenant
        except Exception:
            pass
        
        if tenant:
            # Check if tenant has any active or trialing subscription
            has_valid_subscription = tenant.subscriptions.filter(
                status__in=['active', 'trialing']
            ).exists()
            
            if not has_valid_subscription:
                logger.warning(f"Login blocked for {username}: Tenant '{tenant.name}' has no active subscription")
                return Response(
                    {
                        "detail": "Your subscription has expired or is inactive. Please contact support or renew your subscription.",
                        "error_code": "NO_SUBSCRIPTION"
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            # User has no tenant - block access (unless you want to allow orphan users)
            logger.warning(f"Login blocked for {username}: User has no tenant assigned")
            return Response(
                {
                    "detail": "Your account is not associated with any organization. Please contact support.",
                    "error_code": "NO_TENANT"
                },
                status=status.HTTP_403_FORBIDDEN
            )

    refresh = RefreshToken.for_user(user)
    access = refresh.access_token

    resp = Response({"detail": "Login successful"}, status=status.HTTP_200_OK)

    # SIMPLE_JWT lifetimes are timedelta objects
    refresh_ttl = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
    access_ttl = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())

    # Clear legacy / mismatched cookie names first to avoid stale-token confusion
    _clear_cookie_variants(resp, _LEGACY_ACCESS)
    _clear_cookie_variants(resp, _LEGACY_REFRESH)
    _clear_cookie_variants(resp, ACCESS_COOKIE_NAME)
    _clear_cookie_variants(resp, REFRESH_COOKIE_NAME)

    # Set new tokens as httponly cookies
    set_cookie(resp, REFRESH_COOKIE_NAME, str(refresh), refresh_ttl)
    set_cookie(resp, ACCESS_COOKIE_NAME, str(access), access_ttl)
    return resp



@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_view(request):
    """
    Refresh tokens using refresh cookie. Returns fresh access+refresh cookies.
    """
    token = request.COOKIES.get(REFRESH_COOKIE_NAME) or request.COOKIES.get(_LEGACY_REFRESH)
    if not token:
        return Response({"detail": "No refresh token"}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        old = RefreshToken(token)
        # extract user id from payload and resolve user
        user_id = old.get("user_id")
        if not user_id:
            raise exceptions.AuthenticationFailed("Invalid refresh token payload")

        try:
            user = User.objects.get(pk=int(user_id))
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed("User not found for token")

        # create new tokens for user
        new_refresh = RefreshToken.for_user(user)
        new_access = new_refresh.access_token

        resp = Response({"detail": "refreshed"}, status=status.HTTP_200_OK)

        refresh_ttl = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
        access_ttl = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())

        # Clear legacy/mismatched cookies before setting new ones
        _clear_cookie_variants(resp, _LEGACY_REFRESH)
        _clear_cookie_variants(resp, _LEGACY_ACCESS)
        _clear_cookie_variants(resp, REFRESH_COOKIE_NAME)
        _clear_cookie_variants(resp, ACCESS_COOKIE_NAME)

        set_cookie(resp, REFRESH_COOKIE_NAME, str(new_refresh), refresh_ttl)
        set_cookie(resp, ACCESS_COOKIE_NAME, str(new_access), access_ttl)

        # Try to blacklist old token if token blacklist app is installed
        try:
            old.blacklist()
        except Exception:
            # blacklist may not be configured; ignore
            pass

        return resp
    except exceptions.AuthenticationFailed:
        raise
    except Exception:
        return Response({"detail": "Invalid refresh"}, status=status.HTTP_401_UNAUTHORIZED)


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])  # Allow anyone to logout, even if not authenticated
def logout_view(request):
    """
    Logout: blacklist refresh token if present and clear cookies.
    """
    # Clear standard Django session
    try:
        django_logout(request)
    except Exception as e:
        logger.debug(f"django_logout error: {e}")

    # Try to blacklist refresh token if available
    token = request.COOKIES.get(REFRESH_COOKIE_NAME) or request.COOKIES.get(_LEGACY_REFRESH)
    if token:
        try:
            RefreshToken(token).blacklist()
        except Exception:
            pass

    resp = Response({"detail": "Logged out"}, status=status.HTTP_200_OK)

    # Delete cookies thoroughly
    cookies_to_clear = [REFRESH_COOKIE_NAME, ACCESS_COOKIE_NAME, _LEGACY_REFRESH, _LEGACY_ACCESS, "sessionid", "csrftoken"]
    for cookie_name in cookies_to_clear:
        _clear_cookie_variants(resp, cookie_name)

    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    """
    Return currently authenticated user. Prefer DRF authentication if available,
    otherwise try to read access token from cookie and resolve user.
    """
    user = getattr(request, "user", None)
    
    # If user not authenticated via DRF, try JWT cookie fallback
    if not user or not user.is_authenticated:
        token = request.COOKIES.get(ACCESS_COOKIE_NAME) or request.COOKIES.get(_LEGACY_ACCESS)
        if not token:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            access = AccessToken(token)
            user_id = access.get("user_id")
            if not user_id:
                raise exceptions.AuthenticationFailed("Invalid token payload")
            user = User.objects.get(pk=int(user_id))
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed("User not found")
        except exceptions.AuthenticationFailed:
            raise
        except Exception:
            return Response({"detail": "Invalid or expired token."}, status=status.HTTP_401_UNAUTHORIZED)

    # Get user roles from groups
    roles = list(user.groups.values_list("name", flat=True))
    
    # Fetch extended profile and role data
    role_name = None
    sidebar_config = {}
    
    try:
        from .models import UserProfile
        user_profile = UserProfile.objects.filter(user=user).select_related('role').first()
        if user_profile and user_profile.role:
            role_name = user_profile.role.name
            sidebar_config = user_profile.role.sidebar_config or {}
    except Exception:
        pass

    # Fallback: if no custom role, map group name to role_name for legacy support
    if not role_name and roles:
        role_name = roles[0]

    return Response(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_superuser": user.is_superuser,
            "roles": roles,
            "role_name": role_name,
            "sidebar_config": sidebar_config,
        }
    )
