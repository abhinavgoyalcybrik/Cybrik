# crm_app/views_integrations.py
"""
Views for Ad Integrations (Google Ads, Meta Ads).
Uses REAL API calls to fetch campaign data.
"""
import logging
from decimal import Decimal
from datetime import date, timedelta

from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

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
