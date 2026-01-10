# ielts_service/auth_views.py
"""
Authentication views for IELTS Portal.
Handles registration, login, logout, and Google OAuth.
"""
import logging
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from .models import IELTSStudentProfile

logger = logging.getLogger(__name__)
User = get_user_model()

# Cookie settings - use settings values for consistency with authentication.py
ACCESS_COOKIE_NAME = getattr(settings, "ACCESS_COOKIE_NAME", "cyb_access_v2")
REFRESH_COOKIE_NAME = getattr(settings, "REFRESH_COOKIE_NAME", "cyb_refresh_v2")
ACCESS_TOKEN_LIFETIME = 60 * 60  # 1 hour (match SimpleJWT settings)
REFRESH_TOKEN_LIFETIME = 60 * 60 * 24 * 7  # 7 days


def set_auth_cookies(response, user):
    """Set JWT cookies for authentication."""
    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)
    
    # Set access token cookie
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access_token,
        max_age=ACCESS_TOKEN_LIFETIME,
        httponly=True,
        samesite='Lax',
        secure=not settings.DEBUG,
    )
    
    # Set refresh token cookie
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=REFRESH_TOKEN_LIFETIME,
        httponly=True,
        samesite='Lax',
        secure=not settings.DEBUG,
    )
    
    return response


def clear_auth_cookies(response):
    """Clear JWT cookies."""
    response.delete_cookie(ACCESS_COOKIE_NAME)
    response.delete_cookie(REFRESH_COOKIE_NAME)
    return response


def get_user_data(user):
    """Get user data for response."""
    try:
        profile = user.ielts_profile
    except:
        profile = None
    return {
        'id': user.id,
        'email': user.email,
        'username': user.username,
        'name': user.get_full_name() or user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'onboarding_completed': profile.onboarding_completed if profile else False,
        'account_type': profile.account_type if profile else 'self_signup',
        'subscription_status': profile.subscription_status if profile else 'free',
        'has_full_access': profile.has_full_access() if profile else False,
        'evaluations_remaining': (
            profile.weekly_evaluation_limit - profile.evaluations_this_week 
            if profile and not profile.has_full_access() 
            else 999
        ),
        'profile': {
            'target_score': float(profile.target_score) if profile and profile.target_score else None,
            'exam_date': str(profile.exam_date) if profile and profile.exam_date else None,
            'test_type': profile.test_type if profile else None,
            'attempt_type': profile.attempt_type if profile else None,
            'purpose': profile.purpose if profile else None,
        } if profile else None,
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    """
    Register a new IELTS student.
    POST /api/ielts/auth/register/
    Body: { email, password, first_name, last_name, account_type? }
    """
    email = request.data.get('email', '').lower().strip()
    password = request.data.get('password', '')
    first_name = request.data.get('first_name', '').strip()
    last_name = request.data.get('last_name', '').strip()
    account_type = request.data.get('account_type', 'self_signup')
    
    if not email or not password:
        return Response(
            {'error': 'Email and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if len(password) < 6:
        return Response(
            {'error': 'Password must be at least 6 characters'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if user exists
    if User.objects.filter(email=email).exists():
        return Response(
            {'error': 'An account with this email already exists'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Create user
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        
        # Create IELTS profile with account type
        # Self-signup = free tier, CRM = full access
        subscription_status = 'crm_full' if account_type == 'crm' else 'free'
        IELTSStudentProfile.objects.create(
            user=user,
            account_type=account_type,
            subscription_status=subscription_status,
        )
        
        # Set auth cookies
        response = Response({
            'message': 'Registration successful',
            'user': get_user_data(user),
        }, status=status.HTTP_201_CREATED)
        
        return set_auth_cookies(response, user)
        
    except Exception as e:
        logger.error(f"Registration error: {e}")
        return Response(
            {'error': 'Registration failed. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Login with username/email and password.
    POST /api/ielts/auth/login/
    Body: { username, password } or { email, password }
    """
    # Accept both username and email fields
    username = request.data.get('username', '').strip()
    email = request.data.get('email', '').lower().strip()
    password = request.data.get('password', '')
    
    identifier = username or email
    
    if not identifier or not password:
        return Response(
            {'error': 'Username/email and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Try to find user by username first, then by email
    user = None
    try:
        user = User.objects.get(username=identifier)
    except User.DoesNotExist:
        try:
            user = User.objects.get(email=identifier.lower())
        except User.DoesNotExist:
            pass
    
    if not user:
        return Response(
            {'error': 'Invalid username or password'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not user.check_password(password):
        return Response(
            {'error': 'Invalid email or password'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not user.is_active:
        return Response(
            {'error': 'Account is disabled'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Ensure IELTS profile exists
    IELTSStudentProfile.objects.get_or_create(user=user)
    
    response = Response({
        'message': 'Login successful',
        'user': get_user_data(user),
    })
    
    return set_auth_cookies(response, user)


from rest_framework.decorators import api_view, permission_classes, authentication_classes
import traceback

@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def google_auth_view(request):
    """
    Authenticate with Google OAuth.
    POST /api/ielts/auth/google/
    Body: { token } - Google ID token from frontend
    """
    print("DEBUG: Entered google_auth_view")
    token = request.data.get('token')
    
    if not token:
        print("DEBUG: No token provided")
    
    if not token:
        return Response(
            {'error': 'Google token is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Verify the Google token
        google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None)
        if not google_client_id:
            logger.error("GOOGLE_CLIENT_ID not configured")
            return Response(
                {'error': 'Google authentication not configured'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        idinfo = id_token.verify_oauth2_token(
            token, 
            google_requests.Request(), 
            google_client_id
        )
        
        google_id = idinfo['sub']
        email = idinfo.get('email', '').lower()
        first_name = idinfo.get('given_name', '')
        last_name = idinfo.get('family_name', '')
        
        if not email:
            return Response(
                {'error': 'Email not provided by Google'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user exists with this Google ID
        profile = IELTSStudentProfile.objects.filter(google_id=google_id).first()
        
        if profile:
            user = profile.user
        else:
            # Check if user exists with this email
            try:
                user = User.objects.get(email=email)
                # Link Google ID to existing user
                profile, _ = IELTSStudentProfile.objects.get_or_create(user=user)
                profile.google_id = google_id
                profile.save()
            except User.DoesNotExist:
                # Create new user
                user = User.objects.create_user(
                    username=email,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                )
                profile = IELTSStudentProfile.objects.create(
                    user=user,
                    google_id=google_id,
                    account_type='self_signup',
                    subscription_status='free',
                )
        
        response = Response({
            'message': 'Google login successful',
            'user': get_user_data(user),
        })
        
        return set_auth_cookies(response, user)
        
    except ValueError as e:
        import traceback
        traceback.print_exc()
        logger.error(f"Google token verification failed: {e}")
        return Response(
            {'error': 'Invalid Google token'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.error(f"Google auth error: {e}")
        return Response(
            {'error': 'Google authentication failed'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def me_view(request):
    """
    Get current authenticated user.
    GET /api/ielts/auth/me/
    """
    from rest_framework_simplejwt.authentication import JWTAuthentication
    from rest_framework_simplejwt.tokens import AccessToken
    
    # Try to get user from cookie
    access_token = request.COOKIES.get(ACCESS_COOKIE_NAME)
    
    if not access_token:
        return Response(
            {'error': 'Not authenticated'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    try:
        token = AccessToken(access_token)
        user_id = token.get('user_id')
        user = User.objects.get(id=user_id)
        
        return Response({
            'user': get_user_data(user),
        })
        
    except Exception as e:
        import traceback
        print(f"DEBUG: me_view failed: {e}")
        traceback.print_exc()
        logger.debug(f"Token validation failed: {e}")
        return Response(
            {'error': 'Invalid or expired token'},
            status=status.HTTP_401_UNAUTHORIZED
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_view(request):
    """
    Logout and clear cookies.
    POST /api/ielts/auth/logout/
    """
    response = Response({'message': 'Logged out successfully'})
    return clear_auth_cookies(response)


@api_view(['POST'])
@permission_classes([AllowAny])
def update_onboarding_view(request):
    """
    Update onboarding data for the current user.
    POST /api/ielts/auth/onboarding/
    """
    from rest_framework_simplejwt.tokens import AccessToken
    
    access_token = request.COOKIES.get(ACCESS_COOKIE_NAME)
    
    if not access_token:
        return Response(
            {'error': 'Not authenticated'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    try:
        token = AccessToken(access_token)
        user_id = token.get('user_id')
        user = User.objects.get(id=user_id)
        
        profile, _ = IELTSStudentProfile.objects.get_or_create(user=user)
        
        # Update onboarding data
        data = request.data
        if 'target_score' in data:
            profile.target_score = data['target_score']
        if 'exam_date' in data:
            profile.exam_date = data['exam_date'] if data['exam_date'] != 'unknown' else None
        if 'test_type' in data:
            profile.test_type = data['test_type']
        if 'attempt_type' in data:
            profile.attempt_type = data['attempt_type']
        if 'purpose' in data:
            profile.purpose = data['purpose']
        if 'referral_source' in data:
            profile.referral_source = data['referral_source']
        
        profile.onboarding_completed = True
        profile.save()
        
        return Response({
            'message': 'Onboarding updated',
            'user': get_user_data(user),
        })
        
    except Exception as e:
        logger.error(f"Onboarding update error: {e}")
        return Response(
            {'error': 'Failed to update onboarding'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
