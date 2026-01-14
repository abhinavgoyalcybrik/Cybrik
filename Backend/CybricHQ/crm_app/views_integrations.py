# crm_app/views_integrations.py
"""
Views for Ad Integrations (Google Ads, Meta Ads).
Uses REAL API calls to fetch campaign data.
"""
import logging
import secrets
import requests
from decimal import Decimal
from datetime import date, timedelta

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import AdIntegration, AdCampaign
from .serializers import AdIntegrationSerializer, AdCampaignSerializer

logger = logging.getLogger(__name__)


class AdIntegrationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing ad platform integrations.
    """
    serializer_class = AdIntegrationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AdIntegration.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, status="connected")

    @action(detail=True, methods=['post'])
    def sync(self, request, pk=None):
        """
        Sync campaign data from the ad platform using REAL API calls.
        """
        integration = self.get_object()
        
        try:
            if integration.platform == "google_ads":
                campaigns_data = self._sync_google_ads(integration)
            elif integration.platform == "meta_ads":
                campaigns_data = self._sync_meta_ads(integration)
            else:
                return Response(
                    {"error": f"Unsupported platform: {integration.platform}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Save campaigns to database
            for campaign_data in campaigns_data:
                AdCampaign.objects.update_or_create(
                    integration=integration,
                    external_campaign_id=campaign_data['external_campaign_id'],
                    defaults={
                        **campaign_data,
                        'last_synced_at': timezone.now(),
                    }
                )
            
            integration.last_synced_at = timezone.now()
            integration.status = "connected"
            integration.save()
            
            return Response({
                "message": f"Successfully synced {len(campaigns_data)} campaigns from {integration.get_platform_display()}",
                "synced_at": integration.last_synced_at,
                "campaigns_count": integration.campaigns.count()
            })
            
        except Exception as e:
            logger.error(f"Sync error for integration {integration.id}: {e}")
            integration.status = "error"
            integration.save()
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _sync_google_ads(self, integration):
        """Fetch real data from Google Ads API."""
        from .services.google_ads_client import fetch_google_ads_campaigns
        return fetch_google_ads_campaigns(integration)

    def _sync_meta_ads(self, integration):
        """Fetch real data from Meta Marketing API."""
        from .services.meta_ads_client import fetch_meta_ads_campaigns
        return fetch_meta_ads_campaigns(integration)

    @action(detail=True, methods=['post'])
    def disconnect(self, request, pk=None):
        """Disconnect and delete an integration along with all its campaigns."""
        integration = self.get_object()
        platform_name = integration.get_platform_display()
        account_name = integration.account_name or integration.account_id
        
        # Delete all campaigns associated with this integration
        campaigns_deleted = integration.campaigns.count()
        integration.campaigns.all().delete()
        
        # Delete the integration itself
        integration.delete()
        
        return Response({
            "message": f"Successfully disconnected {platform_name} ({account_name}). Removed {campaigns_deleted} campaigns."
        })

    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """Test if the integration credentials are valid."""
        integration = self.get_object()
        
        try:
            if integration.platform == "google_ads":
                from .services.google_ads_client import get_google_ads_client
                credentials = {
                    "developer_token": integration.metadata.get("developer_token") if integration.metadata else None,
                    "client_id": integration.metadata.get("client_id") if integration.metadata else None,
                    "client_secret": integration.metadata.get("client_secret") if integration.metadata else None,
                    "refresh_token": integration.refresh_token or integration.access_token,
                }
                get_google_ads_client(credentials)
                
            elif integration.platform == "meta_ads":
                from .services.meta_ads_client import get_meta_ads_client
                get_meta_ads_client(
                    access_token=integration.access_token,
                    app_secret=integration.metadata.get("app_secret") if integration.metadata else None,
                    app_id=integration.metadata.get("app_id") if integration.metadata else None,
                )
            
            integration.status = "connected"
            integration.save()
            return Response({"message": "Connection successful", "status": "connected"})
            
        except Exception as e:
            integration.status = "error"
            integration.save()
            return Response(
                {"error": str(e), "status": "error"},
                status=status.HTTP_400_BAD_REQUEST
            )


class AdCampaignViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for viewing campaign data.
    """
    serializer_class = AdCampaignSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = AdCampaign.objects.filter(integration__user=self.request.user)
        
        # Filter by platform
        platform = self.request.query_params.get('platform')
        if platform:
            queryset = queryset.filter(integration__platform=platform)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.select_related('integration')

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Get aggregated summary of all campaigns.
        """
        queryset = self.get_queryset()
        
        total_spend = sum(c.total_spend for c in queryset)
        total_impressions = sum(c.impressions for c in queryset)
        total_clicks = sum(c.clicks for c in queryset)
        total_conversions = sum(c.conversions for c in queryset)
        
        avg_ctr = (total_clicks / total_impressions * 100) if total_impressions else 0
        avg_cpc = (float(total_spend) / total_clicks) if total_clicks else 0
        avg_cpm = (float(total_spend) / total_impressions * 1000) if total_impressions else 0
        
        # Platform breakdown
        google_campaigns = queryset.filter(integration__platform='google_ads')
        meta_campaigns = queryset.filter(integration__platform='meta_ads')
        
        return Response({
            "total_campaigns": queryset.count(),
            "active_campaigns": queryset.filter(status='active').count(),
            "total_spend": float(total_spend),
            "total_impressions": total_impressions,
            "total_clicks": total_clicks,
            "total_conversions": total_conversions,
            "avg_ctr": round(avg_ctr, 2),
            "avg_cpc": round(avg_cpc, 2),
            "avg_cpm": round(avg_cpm, 2),
            "platform_breakdown": {
                "google_ads": {
                    "campaigns": google_campaigns.count(),
                    "spend": float(sum(c.total_spend for c in google_campaigns)),
                    "conversions": sum(c.conversions for c in google_campaigns),
                },
                "meta_ads": {
                    "campaigns": meta_campaigns.count(),
                    "spend": float(sum(c.total_spend for c in meta_campaigns)),
                    "conversions": sum(c.conversions for c in meta_campaigns),
                }
            },
            "currency": "USD"
        })


# ========================================
# META ADS OAUTH ENDPOINTS  
# ========================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def meta_oauth_init(request):
    """
    Initialize Meta Ads OAuth flow.
    Generates OAuth URL and redirects user to Facebook for authentication.
    """
    # Generate random state token for CSRF protection
    state = secrets.token_urlsafe(32)
    
    # Store state and user ID in session for verification in callback
    request.session['meta_oauth_state'] = state
    request.session['meta_oauth_user_id'] = request.user.id
    request.session.save()
    
    # Get OAuth settings
    meta_app_id = getattr(settings, 'META_APP_ID', '')
    redirect_uri = getattr(settings, 'META_OAUTH_REDIRECT_URI', '')
    
    if not meta_app_id:
        return Response(
            {"error": "Meta App ID not configured. Please contact support."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Build Facebook OAuth URL
    oauth_url = (
        f"https://www.facebook.com/v18.0/dialog/oauth?"
        f"client_id={meta_app_id}&"
        f"redirect_uri={redirect_uri}&"
        f"state={state}&"
        f"scope=ads_read,ads_management,read_insights"
    )
    
    logger.info(f"Meta OAuth init for user {request.user.id}, state={state[:10]}...")
    
    return Response({"oauth_url": oauth_url})


@api_view(['GET'])
@permission_classes([AllowAny])  # No authentication required for callback
def meta_oauth_callback(request):
    """
    Handle OAuth callback from Facebook.
    Exchanges authorization code for access token and fetches user's ad accounts.
    """
    code = request.GET.get('code')
    state = request.GET.get('state')
    error = request.GET.get('error')
    
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://crm.cybriksolutions.com')
    
    # Handle OAuth denial
    if error:
        logger.warning(f"Meta OAuth denied: {error}")
        return redirect(f"{frontend_url}/marketing/ads?error=oauth_denied")
    
    if not code or not state:
        return HttpResponse("Missing code or state parameter", status=400)
    
    # Verify state token (CSRF protection)
    stored_state = request.session.get('meta_oauth_state')
    if state != stored_state:
        logger.error(f"State mismatch: got {state[:10]}, expected {stored_state[:10] if stored_state else 'None'}")
        return HttpResponse("Invalid state token", status=400)
    
    user_id = request.session.get('meta_oauth_user_id')
    if not user_id:
        return HttpResponse("Session expired", status=400)
    
    try:
        # Exchange code for access token
        token_url = "https://graph.facebook.com/v18.0/oauth/access_token"
        token_response = requests.get(token_url, params={
            'client_id': settings.META_APP_ID,
            'client_secret': settings.META_APP_SECRET,
            'code': code,
            'redirect_uri': settings.META_OAUTH_REDIRECT_URI
        })
        
        if token_response.status_code != 200:
            logger.error(f"Meta token exchange failed: {token_response.text}")
            return redirect(f"{frontend_url}/marketing/ads?error=token_exchange_failed")
        
        token_data = token_response.json()
        access_token = token_data.get('access_token')
        
        if not access_token:
            return redirect(f"{frontend_url}/marketing/ads?error=no_access_token")
        
        # Exchange short-lived token for long-lived token (60 days)
        long_lived_url = "https://graph.facebook.com/v18.0/oauth/access_token"
        long_lived_response = requests.get(long_lived_url, params={
            'grant_type': 'fb_exchange_token',
            'client_id': settings.META_APP_ID,
            'client_secret': settings.META_APP_SECRET,
            'fb_exchange_token': access_token
        })
        
        if long_lived_response.status_code == 200:
            long_lived_data = long_lived_response.json()
            access_token = long_lived_data.get('access_token', access_token)
            logger.info("Exchanged for long-lived token")
        
        # Fetch user's ad accounts
        accounts_url = "https://graph.facebook.com/v18.0/me/adaccounts"
        accounts_response = requests.get(accounts_url, params={
            'access_token': access_token,
            'fields': 'id,name,account_status,currency,timezone_name'
        })
        
        if accounts_response.status_code != 200:
            logger.error(f"Failed to fetch ad accounts: {accounts_response.text}")
            return redirect(f"{frontend_url}/marketing/ads?error=fetch_accounts_failed")
        
        accounts_data = accounts_response.json()
        accounts = accounts_data.get('data', [])
        
        if not accounts:
            return redirect(f"{frontend_url}/marketing/ads?error=no_accounts_found")
        
        # Store temporary token and accounts in cache (10 minutes)
        temp_token = secrets.token_urlsafe(32)
        cache_key = f'meta_oauth_{temp_token}'
        cache.set(cache_key, {
            'user_id': user_id,
            'access_token': access_token,
            'accounts': accounts
        }, timeout=600)  # 10 minutes
        
        # Clear session data
        if 'meta_oauth_state' in request.session:
            del request.session['meta_oauth_state']
        if 'meta_oauth_user_id' in request.session:
            del request.session['meta_oauth_user_id']
        request.session.save()
        
        logger.info(f"Meta OAuth success for user {user_id}, found {len(accounts)} accounts")
        
        # Redirect to frontend success page with temp token
        return redirect(f"{frontend_url}/marketing/ads/oauth-success?token={temp_token}&platform=meta_ads")
        
    except Exception as e:
        logger.exception(f"Meta OAuth callback error: {e}")
        return redirect(f"{frontend_url}/marketing/ads?error=oauth_error")


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def meta_get_accounts(request, temp_token):
    """
    Get available Meta ad accounts using temporary OAuth token.
    Called by frontend after successful OAuth to show account selection.
    """
    cache_key = f'meta_oauth_{temp_token}'
    oauth_data = cache.get(cache_key)
    
    if not oauth_data:
        return Response(
            {"error": "Token expired or invalid. Please try connecting again."},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verify user matches
    if oauth_data['user_id'] != request.user.id:
        return Response(
            {"error": "Unauthorized"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    accounts = oauth_data.get('accounts', [])
    
    # Format accounts for frontend
    formatted_accounts = []
    for acc in accounts:
        formatted_accounts.append({
            'id': acc['id'],
            'name': acc.get('name', acc['id']),
            'status': acc.get('account_status', 'ACTIVE'),
            'currency': acc.get('currency', 'USD'),
            'timezone': acc.get('timezone_name', 'UTC')
        })
    
    return Response({
        'accounts': formatted_accounts,
        'temp_token': temp_token  # Return token for next step
    })