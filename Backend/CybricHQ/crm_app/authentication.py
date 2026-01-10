from rest_framework_simplejwt.tokens import AccessToken
from rest_framework.authentication import BaseAuthentication
from django.contrib.auth import get_user_model
from rest_framework import exceptions
from django.conf import settings

User = get_user_model()
ACCESS_COOKIE_NAME = getattr(settings, "ACCESS_COOKIE_NAME", "cyb_access_v2")

class JWTAuthFromCookie(BaseAuthentication):
    def authenticate(self, request):
        token = request.COOKIES.get(ACCESS_COOKIE_NAME)
        if not token:
            token = request.COOKIES.get("cyb_access") # Legacy fallback
        
        if not token:
            return None  # fall through to next auth class
        try:
            access = AccessToken(token)
            user_id = access.get("user_id")
            if not user_id:
                raise exceptions.AuthenticationFailed("Invalid token")
            user = User.objects.get(pk=user_id)
            return (user, None)
        except Exception as exc:
            raise exceptions.AuthenticationFailed("Invalid/expired token")
