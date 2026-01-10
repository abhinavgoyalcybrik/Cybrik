from rest_framework_simplejwt.tokens import AccessToken
from rest_framework.authentication import BaseAuthentication
from django.contrib.auth import get_user_model
from rest_framework import exceptions
from django.conf import settings
import sys

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
        except User.DoesNotExist:
            # Fallback: If user not found in current schema (e.g. tenant context), 
            # check PUBLIC schema (for global admins/staff)
            try:
                from django.db import connection
                sys.stderr.write(f"DEBUG AUTH: User {user_id} not found in current schema. Checking PUBLIC.\n")
                
                # We need to temporarily force public schema to find the user
                # CAUTION: This user object will be "from" the public schema. 
                
                # Option A: Simple SQL check if we don't want to mess with connection state permanently
                # But we need a proper ORM object for request.user
                
                # Save current search path?
                # For safety, let's just do a quick lookup by temporarily switching.
                # Ideally, we should ensure 'public.auth_user' is visible, but if tables are shadowed it's hard.
                
                previous_tenant = getattr(connection, "tenant", None)
                
                # Check directly using public schema
                with connection.cursor() as cursor:
                    # READ-ONLY safe trick: force search path for just this query? Hard with ORM.
                    # We will switch, fetch, and switch back if needed? 
                    # Actually, if we are in a tenant request, we likely WANT the connection to stay tenant?
                    # BUT request.user must exist. 
                    
                    # Let's try explicit public schema Set
                    cursor.execute("SET search_path TO public")
                    user = User.objects.get(pk=user_id)
                    
                    # If successful, we have a user. 
                    # Does this user belong in this request? If Supervisor, yes.
                    sys.stderr.write(f"DEBUG AUTH: Found user {user.username} in PUBLIC schema. Is_staff={user.is_staff}\n")
                    
                    # Restore Tenant Context if we have a tenant set in middleware
                    # Since Auth runs AFTER middleware, request.tenant might be set.
                    # We can't access request.tenant easily here in a robust way without 'request' object (wait, authenticate gets 'request')
                    
                    if request and hasattr(request, "tenant") and request.tenant:
                         schema = request.tenant.database_schema
                         cursor.execute(f'SET search_path TO "{schema}", "public"')
                    else:
                         # Just ensure public is set? (Should be fine as we just set it)
                         pass
                         
                    return (user, None)

            except Exception as e:
                sys.stderr.write(f"DEBUG AUTH: Fallback to public failed: {e}\\n")
                return None
        except Exception as exc:
            import traceback
            print(f"DEBUG: JWT Auth failed: {exc}")
            traceback.print_exc()
            # If the user doesn't exist (e.g. wiped DB), return None to allow re-login
            return None
