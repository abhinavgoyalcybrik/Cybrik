from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from .serializers import UserSerializer

User = get_user_model()
ACCESS_COOKIE_NAME = getattr(settings, "ACCESS_COOKIE_NAME", "cyb_access_v2")

import sys

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    sys.stderr.write(f"DEBUG LOGIN: Request to login_view. Username='{username}'\n")
    
    if not username or not password:
        sys.stderr.write("DEBUG LOGIN: Missing username or password\n")
        return Response({'error': 'Username and password required'}, status=status.HTTP_400_BAD_REQUEST)

    # Deep Diagnostics logic removed for production cleanliness, but keeping the fix logic
    from django.db import connection
    
    # CRITICAL FIX: Login must ALWAYS happen in public schema to find users
    # Ignore any tenant context set by middleware/cookies for this request
    sys.stderr.write("DEBUG LOGIN: Forcing schema to PUBLIC for authentication.\n")
    try:
        connection.set_schema_to_public()
    except Exception:
        # Fallback for non-postgres or if method missing (common in some setups)
        # sys.stderr.write(f"DEBUG LOGIN: set_schema_to_public failed: {e}. Trying raw SQL.\n") # Silenced
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET search_path TO public")
        except Exception as sql_e:
             sys.stderr.write(f"DEBUG LOGIN: Raw SQL Schema Switch failed: {sql_e}\n")

    sys.stderr.write(f"DEBUG LOGIN: Calling authenticate for '{username}' in PUBLIC schema\\n")
    user = authenticate(username=username, password=password)
    sys.stderr.write(f"DEBUG LOGIN: Authenticate returned: {user}\\n")
    
    # If PUBLIC failed, try tenant schema (for tenant-specific users)
    if user is None:
        sys.stderr.write(f"DEBUG LOGIN: PUBLIC auth failed. Trying tenant context...\\n")
        
        # Get tenant from request context (set by middleware from subdomain/header)
        tenant = getattr(request, 'tenant', None)
        if tenant and hasattr(tenant, 'database_schema') and tenant.database_schema:
            sys.stderr.write(f"DEBUG LOGIN: Trying tenant schema: {tenant.database_schema}\\n")
            try:
                with connection.cursor() as cursor:
                    cursor.execute(f'SET search_path TO "{tenant.database_schema}", public')
                user = authenticate(username=username, password=password)
                sys.stderr.write(f"DEBUG LOGIN: Tenant auth returned: {user}\\n")
            except Exception as e:
                sys.stderr.write(f"DEBUG LOGIN: Tenant auth error: {e}\\n")
    
    if user is None:
        sys.stderr.write(f"DEBUG LOGIN: Auth failed for '{username}'. Sending 401.\\n")
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    
    if not user.is_active:
         return Response({'error': 'User account is disabled'}, status=status.HTTP_401_UNAUTHORIZED)
         
    refresh = RefreshToken.for_user(user)
    
    # Serialize user data
    user_data = UserSerializer(user).data
    
    res = Response(user_data)
    
    # Set cookies
    secure_cookie = getattr(settings, 'COOKIE_SECURE', False)
    samesite_val = getattr(settings, 'COOKIE_SAMESITE', 'Lax')
    
    res.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=str(refresh.access_token),
        httponly=True,
        samesite=samesite_val,
        secure=secure_cookie,
        max_age=3600 # 1 hour
    )
    
    res.set_cookie(
        key='cyb_refresh',
        value=str(refresh),
        httponly=True,
        samesite=samesite_val,
        secure=secure_cookie,
        max_age=3600 * 24 * 30 # 30 days
    )
    
    return res

@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_view(request):
    refresh_token = request.COOKIES.get('cyb_refresh')
    if not refresh_token:
        # Fallback to body
        refresh_token = request.data.get('refresh')
        
    if not refresh_token:
        return Response({'error': 'Refresh token missing'}, status=status.HTTP_401_UNAUTHORIZED)
        
    try:
        refresh = RefreshToken(refresh_token)
        
        # Get new access token
        access_token = str(refresh.access_token)
        
        res = Response({'access': access_token})
        
        secure_cookie = getattr(settings, 'COOKIE_SECURE', False)
        samesite_val = getattr(settings, 'COOKIE_SAMESITE', 'Lax')
        
        res.set_cookie(
            key=ACCESS_COOKIE_NAME,
            value=access_token,
            httponly=True,
            samesite=samesite_val,
            secure=secure_cookie,
            max_age=3600
        )
        return res
    except Exception as e:
        return Response({'error': 'Invalid refresh token'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        refresh_token = request.COOKIES.get('cyb_refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
    except Exception:
        pass
        
    res = Response({'message': 'Logged out'})
    res.delete_cookie(ACCESS_COOKIE_NAME)
    res.delete_cookie('cyb_refresh')
    return res

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """
    Change password for authenticated user.
    """
    user = request.user
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')
    
    if not old_password or not new_password:
        return Response({'error': 'Both old_password and new_password are required'}, status=status.HTTP_400_BAD_REQUEST)
    
    if confirm_password and new_password != confirm_password:
        return Response({'error': 'New passwords do not match'}, status=status.HTTP_400_BAD_REQUEST)
        
    if not user.check_password(old_password):
        return Response({'error': 'Current password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)
        
    user.set_password(new_password)
    user.save()
    
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def test_login(request):
    import sys
    sys.stderr.write("DEBUG: Executing test_login\n")
    username = request.data.get('username')
    sys.stderr.write(f"DEBUG: Received username: {username}\n")
    return Response({'message': 'Test Login Reached', 'received_username': username})
