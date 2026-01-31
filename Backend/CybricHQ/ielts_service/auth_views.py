"""
IELTS Portal Authentication Views
Handles login, logout, Google OAuth, and user session management for IELTS students.
"""
import logging
import os
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

logger = logging.getLogger(__name__)
User = get_user_model()

# Cookie settings
COOKIE_SECURE = getattr(settings, "COOKIE_SECURE", os.getenv("COOKIE_SECURE", "False").lower() in ("1", "true", "yes"))
COOKIE_SAMESITE = getattr(settings, "COOKIE_SAMESITE", os.getenv("COOKIE_SAMESITE", "Lax"))
ACCESS_COOKIE_NAME = getattr(settings, "ACCESS_COOKIE_NAME", "cyb_access_v2")
REFRESH_COOKIE_NAME = getattr(settings, "REFRESH_COOKIE_NAME", "cyb_refresh_v2")

# Google OAuth Client ID
GOOGLE_CLIENT_ID = getattr(settings, "GOOGLE_CLIENT_ID", "280708411866-aikji0349e6vqbeh66t7bujiaq9itpfe.apps.googleusercontent.com")


def set_auth_cookies(response, user):
    """Set JWT tokens as httpOnly cookies."""
    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)
    
    # Access token cookie (shorter lived)
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access_token,
        max_age=60 * 60,  # 1 hour
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path='/',  # Explicit path for consistent deletion
    )
    
    # Refresh token cookie (longer lived)
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=60 * 60 * 24 * 7,  # 7 days
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path='/',  # Explicit path for consistent deletion
    )
    
    return response


def get_user_data(user):
    """Get user data for frontend including IELTS profile."""
    from .models import IELTSUserProfile
    
    # Get or check for IELTS profile
    profile_data = {
        "onboarding_completed": False,
        "purpose": None,
        "test_type": None,
        "attempt_type": None,
        "target_score": None,
        "exam_date": None,
        "referral_source": None,
    }
    
    try:
        profile = IELTSUserProfile.objects.get(user=user)
        profile_data = {
            "onboarding_completed": profile.onboarding_completed,
            "purpose": profile.purpose or None,
            "test_type": profile.test_type or None,
            "attempt_type": profile.attempt_type or None,
            "target_score": float(profile.target_score) if profile.target_score else None,
            "exam_date": profile.exam_date or None,
            "referral_source": profile.referral_source or None,
        }
    except Exception:
        # Handle DoesNotExist, table not existing (migration not run), or any other error
        pass
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "account_type": getattr(user, "account_type", "self_signup"),
        "subscription_status": getattr(user, "subscription_status", "free"),
        "has_full_access": getattr(user, "has_full_access", False) or user.is_superuser,
        "evaluations_remaining": getattr(user, "evaluations_remaining", 0),
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        **profile_data,
    }


@api_view(["POST"])
@permission_classes([AllowAny])
def ielts_login(request):
    """
    Login endpoint for IELTS portal.
    Accepts username/email and password.
    """
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")
    
    if not username or not password:
        return Response({"error": "Username and password are required"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Try to authenticate with username
    user = authenticate(request, username=username, password=password)
    
    # If that fails, try with email as username
    if not user:
        try:
            user_by_email = User.objects.get(email=username)
            user = authenticate(request, username=user_by_email.username, password=password)
        except User.DoesNotExist:
            pass
    
    if not user:
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
    
    if not user.is_active:
        return Response({"error": "Account is disabled"}, status=status.HTTP_403_FORBIDDEN)
    
    # Create response with user data
    response = Response({
        "success": True,
        "user": get_user_data(user),
    })
    
    # Set auth cookies
    return set_auth_cookies(response, user)


@api_view(["POST"])
@permission_classes([AllowAny])
def ielts_logout(request):
    """Logout by clearing auth cookies."""
    response = Response({"success": True, "message": "Logged out successfully"})
    # Delete cookies - must match path used when setting them
    # Note: delete_cookie only uses key, path, domain - not samesite/secure
    response.delete_cookie(ACCESS_COOKIE_NAME, path='/')
    response.delete_cookie(REFRESH_COOKIE_NAME, path='/')
    return response


@api_view(["GET"])
@permission_classes([AllowAny])
def ielts_me(request):
    """
    Get current user info from JWT cookie.
    Returns user data if authenticated, otherwise returns error.
    """
    # Try to get user from cookie
    from rest_framework_simplejwt.tokens import AccessToken
    
    token = request.COOKIES.get(ACCESS_COOKIE_NAME)
    
    if not token:
        return Response({"error": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        access = AccessToken(token)
        user_id = access.get("user_id")
        user = User.objects.get(pk=user_id)
        
        return Response({
            "success": True,
            "user": get_user_data(user),
        })
    except Exception as e:
        logger.debug(f"IELTS me endpoint auth failed: {e}")
        return Response({"error": "Invalid or expired token"}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(["POST"])
@permission_classes([AllowAny])
def ielts_google_auth(request):
    """
    Google OAuth callback for IELTS portal.
    Receives Google ID token, verifies it, and creates/logs in user.
    """
    token = request.data.get("token")
    
    if not token:
        return Response({"error": "Google token is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(
            token, 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        
        # Get user info from Google token
        email = idinfo.get("email")
        email_verified = idinfo.get("email_verified", False)
        first_name = idinfo.get("given_name", "")
        last_name = idinfo.get("family_name", "")
        google_id = idinfo.get("sub")
        
        if not email:
            return Response({"error": "Email not provided by Google"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not email_verified:
            return Response({"error": "Google email not verified"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Find or create user
        try:
            user = User.objects.get(email=email)
            logger.info(f"IELTS Google login: existing user {email}")
        except User.DoesNotExist:
            # Create new user
            username = email.split("@")[0]
            
            # Ensure unique username
            base_username = username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1
            
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
            )
            # Set unusable password since they're using Google
            user.set_unusable_password()
            user.save()
            logger.info(f"IELTS Google login: created new user {email}")
        
        if not user.is_active:
            return Response({"error": "Account is disabled"}, status=status.HTTP_403_FORBIDDEN)
        
        # Update name if not set
        if not user.first_name and first_name:
            user.first_name = first_name
            user.last_name = last_name
            user.save(update_fields=["first_name", "last_name"])
        
        # Create response with user data
        response = Response({
            "success": True,
            "user": get_user_data(user),
        })
        
        # Set auth cookies
        return set_auth_cookies(response, user)
        
    except ValueError as e:
        logger.error(f"Invalid Google token: {e}")
        return Response({"error": "Invalid Google token"}, status=status.HTTP_401_UNAUTHORIZED)
    except Exception as e:
        logger.exception(f"Google auth error: {e}")
        return Response({"error": "Authentication failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@permission_classes([AllowAny])
def ielts_register(request):
    """
    Register new IELTS user with email/password.
    """
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "")
    first_name = request.data.get("first_name", "").strip()
    last_name = request.data.get("last_name", "").strip()
    
    if not email or not password:
        return Response({"error": "Email and password are required"}, status=status.HTTP_400_BAD_REQUEST)
    
    if len(password) < 6:
        return Response({"error": "Password must be at least 6 characters"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if user exists
    if User.objects.filter(email=email).exists():
        return Response({"error": "An account with this email already exists"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Create username from email
    username = email.split("@")[0]
    base_username = username
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1
    
    # Create user
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
    )
    
    logger.info(f"IELTS registration: created user {email}")
    
    # Create response with user data
    response = Response({
        "success": True,
        "user": get_user_data(user),
    }, status=status.HTTP_201_CREATED)
    
    # Set auth cookies
    return set_auth_cookies(response, user)


@api_view(["POST"])
@permission_classes([AllowAny])
def ielts_onboarding(request):
    """
    Save user onboarding data to IELTSUserProfile.
    """
    from rest_framework_simplejwt.tokens import AccessToken
    from .models import IELTSUserProfile
    from decimal import Decimal
    
    token = request.COOKIES.get(ACCESS_COOKIE_NAME)
    
    if not token:
        return Response({"error": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        access = AccessToken(token)
        user_id = access.get("user_id")
        user = User.objects.get(pk=user_id)
        
        # Get onboarding data from request
        purpose = request.data.get("purpose", "")
        test_type = request.data.get("testType", "")  # Frontend sends camelCase
        attempt_type = request.data.get("attemptType", "")
        target_score = request.data.get("targetScore")
        exam_date = request.data.get("examDate", "")
        referral_source = request.data.get("referralSource", "")
        
        # Convert target score to Decimal if provided
        target_score_decimal = None
        if target_score is not None:
            try:
                target_score_decimal = Decimal(str(target_score))
            except:
                pass
        
        # Create or update IELTS profile
        profile, created = IELTSUserProfile.objects.get_or_create(user=user)
        
        profile.purpose = purpose
        profile.test_type = test_type
        profile.attempt_type = attempt_type
        profile.target_score = target_score_decimal
        profile.exam_date = exam_date
        profile.referral_source = referral_source
        profile.onboarding_completed = True
        profile.save()
        
        logger.info(f"IELTS onboarding completed for user {user.email}")
        
        return Response({
            "success": True,
            "user": get_user_data(user),
        })
        
    except Exception as e:
        logger.exception(f"Onboarding error: {e}")
        return Response({"error": "Failed to save onboarding data"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_user_profile(request):
    """
    Update user's name (first_name and last_name).
    """
    try:
        user = request.user
        
        first_name = request.data.get("first_name", "").strip()
        last_name = request.data.get("last_name", "").strip()
        
        if first_name:
            user.first_name = first_name
        if last_name:
            user.last_name = last_name
            
        user.save()
        
        logger.info(f"Updated profile for user {user.email}")
        
        return Response({
            "success": True,
            "user": get_user_data(user),
        })
        
    except Exception as e:
        logger.exception(f"Profile update error: {e}")
        return Response({"error": "Failed to update profile"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

