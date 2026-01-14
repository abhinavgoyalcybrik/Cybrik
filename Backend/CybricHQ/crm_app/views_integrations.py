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
#   A p p e n d   O A u t h   e n d p o i n t s   t o   v i e w s _ i n t e g r a t i o n s . p y  
  
 #   = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =  
 #   M E T A   A D S   O A U T H   E N D P O I N T S      
 #   = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =  
  
 @ a p i _ v i e w ( [ ' G E T ' ] )  
 @ p e r m i s s i o n _ c l a s s e s ( [ I s A u t h e n t i c a t e d ] )  
 d e f   m e t a _ o a u t h _ i n i t ( r e q u e s t ) :  
         " " "  
         I n i t i a l i z e   M e t a   A d s   O A u t h   f l o w .  
         G e n e r a t e s   O A u t h   U R L   a n d   r e d i r e c t s   u s e r   t o   F a c e b o o k   f o r   a u t h e n t i c a t i o n .  
         " " "  
         #   G e n e r a t e   r a n d o m   s t a t e   t o k e n   f o r   C S R F   p r o t e c t i o n  
         s t a t e   =   s e c r e t s . t o k e n _ u r l s a f e ( 3 2 )  
          
         #   S t o r e   s t a t e   a n d   u s e r   I D   i n   s e s s i o n   f o r   v e r i f i c a t i o n   i n   c a l l b a c k  
 < b e g _ c h u n k > r e q u e s t . s e s s i o n [ ' m e t a _ o a u t h _ s t a t e ' ]   =   s t a t e  
         r e q u e s t . s e s s i o n [ ' m e t a _ o a u t h _ u s e r _ i d ' ]   =   r e q u e s t . u s e r . i d  
         r e q u e s t . s e s s i o n . s a v e ( )  
          
         #   G e t   O A u t h   s e t t i n g s  
         m e t a _ a p p _ i d   =   g e t a t t r ( s e t t i n g s ,   ' M E T A _ A P P _ I D ' ,   ' ' )  
         r e d i r e c t _ u r i   =   g e t a t t r ( s e t t i n g s ,   ' M E T A _ O A U T H _ R E D I R E C T _ U R I ' ,   ' ' )  
          
         i f   n o t   m e t a _ a p p _ i d :  
                 r e t u r n   R e s p o n s e (  
                         { " e r r o r " :   " M e t a   A p p   I D   n o t   c o n f i g u r e d .   P l e a s e   c o n t a c t   s u p p o r t . " } ,  
                         s t a t u s = s t a t u s . H T T P _ 5 0 0 _ I N T E R N A L _ S E R V E R _ E R R O R  
                 )  
          
         #   B u i l d   F a c e b o o k   O A u t h   U R L  
         o a u t h _ u r l   =   (  
                 f " h t t p s : / / w w w . f a c e b o o k . c o m / v 1 8 . 0 / d i a l o g / o a u t h ? "  
                 f " c l i e n t _ i d = { m e t a _ a p p _ i d } & "  
                 f " r e d i r e c t _ u r i = { r e d i r e c t _ u r i } & "  
                 f " s t a t e = { s t a t e } & "  
                 f " s c o p e = a d s _ r e a d , a d s _ m a n a g e m e n t , r e a d _ i n s i g h t s "  
         )  
          
         l o g g e r . i n f o ( f " M e t a   O A u t h   i n i t   f o r   u s e r   { r e q u e s t . u s e r . i d } ,   s t a t e = { s t a t e [ : 1 0 ] } . . . " )  
          
         r e t u r n   R e s p o n s e ( { " o a u t h _ u r l " :   o a u t h _ u r l } )  
  
  
 @ a p i _ v i e w ( [ ' G E T ' ] )  
 @ p e r m i s s i o n _ c l a s s e s ( [ A l l o w A n y ] )     #   N o   a u t h e n t i c a t i o n   r e q u i r e d   f o r   c a l l b a c k  
 d e f   m e t a _ o a u t h _ c a l l b a c k ( r e q u e s t ) :  
         " " "  
         H a n d l e   O A u t h   c a l l b a c k   f r o m   F a c e b o o k .  
         E x c h a n g e s   a u t h o r i z a t i o n   c o d e   f o r   a c c e s s   t o k e n   a n d   f e t c h e s   u s e r ' s   a d   a c c o u n t s .  
         " " "  
         c o d e   =   r e q u e s t . G E T . g e t ( ' c o d e ' )  
         s t a t e   =   r e q u e s t . G E T . g e t ( ' s t a t e ' )  
         e r r o r   =   r e q u e s t . G E T . g e t ( ' e r r o r ' )  
          
         f r o n t e n d _ u r l   =   g e t a t t r ( s e t t i n g s ,   ' F R O N T E N D _ U R L ' ,   ' h t t p s : / / c r m . c y b r i k s o l u t i o n s . c o m ' )  
          
         #   H a n d l e   O A u t h   d e n i a l  
         i f   e r r o r :  
                 l o g g e r . w a r n i n g ( f " M e t a   O A u t h   d e n i e d :   { e r r o r } " )  
                 r e t u r n   r e d i r e c t ( f " { f r o n t e n d _ u r l } / m a r k e t i n g / a d s ? e r r o r = o a u t h _ d e n i e d " )  
          
         i f   n o t   c o d e   o r   n o t   s t a t e :  
                 r e t u r n   H t t p R e s p o n s e ( " M i s s i n g   c o d e   o r   s t a t e   p a r a m e t e r " ,   s t a t u s = 4 0 0 )  
          
         #   V e r i f y   s t a t e   t o k e n   ( C S R F   p r o t e c t i o n )  
         s t o r e d _ s t a t e   =   r e q u e s t . s e s s i o n . g e t ( ' m e t a _ o a u t h _ s t a t e ' )  
         i f   s t a t e   ! =   s t o r e d _ s t a t e :  
                 l o g g e r . e r r o r ( f " S t a t e   m i s m a t c h :   g o t   { s t a t e [ : 1 0 ] } ,   e x p e c t e d   { s t o r e d _ s t a t e [ : 1 0 ]   i f   s t o r e d _ s t a t e   e l s e   ' N o n e ' } " )  
                 r e t u r n   H t t p R e s p o n s e ( " I n v a l i d   s t a t e   t o k e n " ,   s t a t u s = 4 0 0 )  
          
         u s e r _ i d   =   r e q u e s t . s e s s i o n . g e t ( ' m e t a _ o a u t h _ u s e r _ i d ' )  
         i f   n o t   u s e r _ i d :  
                 r e t u r n   H t t p R e s p o n s e ( " S e s s i o n   e x p i r e d " ,   s t a t u s = 4 0 0 )  
          
         t r y :  
                 #   E x c h a n g e   c o d e   f o r   a c c e s s   t o k e n  
                 t o k e n _ u r l   =   " h t t p s : / / g r a p h . f a c e b o o k . c o m / v 1 8 . 0 / o a u t h / a c c e s s _ t o k e n "  
                 t o k e n _ r e s p o n s e   =   r e q u e s t s . g e t ( t o k e n _ u r l ,   p a r a m s = {  
                         ' c l i e n t _ i d ' :   s e t t i n g s . M E T A _ A P P _ I D ,  
                         ' c l i e n t _ s e c r e t ' :   s e t t i n g s . M E T A _ A P P _ S E C R E T ,  
                         ' c o d e ' :   c o d e ,  
                         ' r e d i r e c t _ u r i ' :   s e t t i n g s . M E T A _ O A U T H _ R E D I R E C T _ U R I  
                 } )  
                  
                 i f   t o k e n _ r e s p o n s e . s t a t u s _ c o d e   ! =   2 0 0 :  
                         l o g g e r . e r r o r ( f " M e t a   t o k e n   e x c h a n g e   f a i l e d :   { t o k e n _ r e s p o n s e . t e x t } " )  
                         r e t u r n   r e d i r e c t ( f " { f r o n t e n d _ u r l } / m a r k e t i n g / a d s ? e r r o r = t o k e n _ e x c h a n g e _ f a i l e d " )  
                  
                 t o k e n _ d a t a   =   t o k e n _ r e s p o n s e . j s o n ( )  
                 a c c e s s _ t o k e n   =   t o k e n _ d a t a . g e t ( ' a c c e s s _ t o k e n ' )  
                  
                 i f   n o t   a c c e s s _ t o k e n :  
                         r e t u r n   r e d i r e c t ( f " { f r o n t e n d _ u r l } / m a r k e t i n g / a d s ? e r r o r = n o _ a c c e s s _ t o k e n " )  
                  
                 #   E x c h a n g e   s h o r t - l i v e d   t o k e n   f o r   l o n g - l i v e d   t o k e n   ( 6 0   d a y s )  
                 l o n g _ l i v e d _ u r l   =   " h t t p s : / / g r a p h . f a c e b o o k . c o m / v 1 8 . 0 / o a u t h / a c c e s s _ t o k e n "  
                 l o n g _ l i v e d _ r e s p o n s e   =   r e q u e s t s . g e t ( l o n g _ l i v e d _ u r l ,   p a r a m s = {  
                         ' g r a n t _ t y p e ' :   ' f b _ e x c h a n g e _ t o k e n ' ,  
                         ' c l i e n t _ i d ' :   s e t t i n g s . M E T A _ A P P _ I D ,  
                         ' c l i e n t _ s e c r e t ' :   s e t t i n g s . M E T A _ A P P _ S E C R E T ,  
                         ' f b _ e x c h a n g e _ t o k e n ' :   a c c e s s _ t o k e n  
                 } )  
                  
                 i f   l o n g _ l i v e d _ r e s p o n s e . s t a t u s _ c o d e   = =   2 0 0 :  
                         l o n g _ l i v e d _ d a t a   =   l o n g _ l i v e d _ r e s p o n s e . j s o n ( )  
                         a c c e s s _ t o k e n   =   l o n g _ l i v e d _ d a t a . g e t ( ' a c c e s s _ t o k e n ' ,   a c c e s s _ t o k e n )  
                         l o g g e r . i n f o ( " E x c h a n g e d   f o r   l o n g - l i v e d   t o k e n " )  
                  
                 #   F e t c h   u s e r ' s   a d   a c c o u n t s  
                 a c c o u n t s _ u r l   =   " h t t p s : / / g r a p h . f a c e b o o k . c o m / v 1 8 . 0 / m e / a d a c c o u n t s "  
                 a c c o u n t s _ r e s p o n s e   =   r e q u e s t s . g e t ( a c c o u n t s _ u r l ,   p a r a m s = {  
                         ' a c c e s s _ t o k e n ' :   a c c e s s _ t o k e n ,  
                         ' f i e l d s ' :   ' i d , n a m e , a c c o u n t _ s t a t u s , c u r r e n c y , t i m e z o n e _ n a m e '  
                 } )  
                  
                 i f   a c c o u n t s _ r e s p o n s e . s t a t u s _ c o d e   ! =   2 0 0 :  
                         l o g g e r . e r r o r ( f " F a i l e d   t o   f e t c h   a d   a c c o u n t s :   { a c c o u n t s _ r e s p o n s e . t e x t } " )  
                         r e t u r n   r e d i r e c t ( f " { f r o n t e n d _ u r l } / m a r k e t i n g / a d s ? e r r o r = f e t c h _ a c c o u n t s _ f a i l e d " )  
                  
                 a c c o u n t s _ d a t a   =   a c c o u n t s _ r e s p o n s e . j s o n ( )  
                 a c c o u n t s   =   a c c o u n t s _ d a t a . g e t ( ' d a t a ' ,   [ ] )  
                  
                 i f   n o t   a c c o u n t s :  
                         r e t u r n   r e d i r e c t ( f " { f r o n t e n d _ u r l } / m a r k e t i n g / a d s ? e r r o r = n o _ a c c o u n t s _ f o u n d " )  
                  
                 #   S t o r e   t e m p o r a r y   t o k e n   a n d   a c c o u n t s   i n   c a c h e   ( 1 0   m i n u t e s )  
                 t e m p _ t o k e n   =   s e c r e t s . t o k e n _ u r l s a f e ( 3 2 )  
                 c a c h e _ k e y   =   f ' m e t a _ o a u t h _ { t e m p _ t o k e n } '  
                 c a c h e . s e t ( c a c h e _ k e y ,   {  
                         ' u s e r _ i d ' :   u s e r _ i d ,  
                         ' a c c e s s _ t o k e n ' :   a c c e s s _ t o k e n ,  
                         ' a c c o u n t s ' :   a c c o u n t s  
                 } ,   t i m e o u t = 6 0 0 )     #   1 0   m i n u t e s  
                  
                 #   C l e a r   s e s s i o n   d a t a  
                 i f   ' m e t a _ o a u t h _ s t a t e '   i n   r e q u e s t . s e s s i o n :  
                         d e l   r e q u e s t . s e s s i o n [ ' m e t a _ o a u t h _ s t a t e ' ]  
                 i f   ' m e t a _ o a u t h _ u s e r _ i d '   i n   r e q u e s t . s e s s i o n :  
                         d e l   r e q u e s t . s e s s i o n [ ' m e t a _ o a u t h _ u s e r _ i d ' ]  
                 r e q u e s t . s e s s i o n . s a v e ( )  
                  
                 l o g g e r . i n f o ( f " M e t a   O A u t h   s u c c e s s   f o r   u s e r   { u s e r _ i d } ,   f o u n d   { l e n ( a c c o u n t s ) }   a c c o u n t s " )  
                  
                 #   R e d i r e c t   t o   f r o n t e n d   s u c c e s s   p a g e   w i t h   t e m p   t o k e n  
                 r e t u r n   r e d i r e c t ( f " { f r o n t e n d _ u r l } / m a r k e t i n g / a d s / o a u t h - s u c c e s s ? t o k e n = { t e m p _ t o k e n } & p l a t f o r m = m e t a _ a d s " )  
                  
         e x c e p t   E x c e p t i o n   a s   e :  
                 l o g g e r . e x c e p t i o n ( f " M e t a   O A u t h   c a l l b a c k   e r r o r :   { e } " )  
                 r e t u r n   r e d i r e c t ( f " { f r o n t e n d _ u r l } / m a r k e t i n g / a d s ? e r r o r = o a u t h _ e r r o r " )  
  
  
 @ a p i _ v i e w ( [ ' G E T ' ] )  
 @ p e r m i s s i o n _ c l a s s e s ( [ I s A u t h e n t i c a t e d ] )  
 d e f   m e t a _ g e t _ a c c o u n t s ( r e q u e s t ,   t e m p _ t o k e n ) :  
         " " "  
         G e t   a v a i l a b l e   M e t a   a d   a c c o u n t s   u s i n g   t e m p o r a r y   O A u t h   t o k e n .  
         C a l l e d   b y   f r o n t e n d   a f t e r   s u c c e s s f u l   O A u t h   t o   s h o w   a c c o u n t   s e l e c t i o n .  
         " " "  
         c a c h e _ k e y   =   f ' m e t a _ o a u t h _ { t e m p _ t o k e n } '  
         o a u t h _ d a t a   =   c a c h e . g e t ( c a c h e _ k e y )  
          
         i f   n o t   o a u t h _ d a t a :  
                 r e t u r n   R e s p o n s e (  
                         { " e r r o r " :   " T o k e n   e x p i r e d   o r   i n v a l i d .   P l e a s e   t r y   c o n n e c t i n g   a g a i n . " } ,  
                         s t a t u s = s t a t u s . H T T P _ 4 0 0 _ B A D _ R E Q U E S T  
                 )  
          
         #   V e r i f y   u s e r   m a t c h e s  
         i f   o a u t h _ d a t a [ ' u s e r _ i d ' ]   ! =   r e q u e s t . u s e r . i d :  
                 r e t u r n   R e s p o n s e (  
                         { " e r r o r " :   " U n a u t h o r i z e d " } ,  
                         s t a t u s = s t a t u s . H T T P _ 4 0 3 _ F O R B I D D E N  
                 )  
          
         a c c o u n t s   =   o a u t h _ d a t a . g e t ( ' a c c o u n t s ' ,   [ ] )  
          
         #   F o r m a t   a c c o u n t s   f o r   f r o n t e n d  
         f o r m a t t e d _ a c c o u n t s   =   [ ]  
         f o r   a c c   i n   a c c o u n t s :  
                 f o r m a t t e d _ a c c o u n t s . a p p e n d ( {  
                         ' i d ' :   a c c [ ' i d ' ] ,  
                         ' n a m e ' :   a c c . g e t ( ' n a m e ' ,   a c c [ ' i d ' ] ) ,  
                         ' s t a t u s ' :   a c c . g e t ( ' a c c o u n t _ s t a t u s ' ,   ' A C T I V E ' ) ,  
                         ' c u r r e n c y ' :   a c c . g e t ( ' c u r r e n c y ' ,   ' U S D ' ) ,  
                         ' t i m e z o n e ' :   a c c . g e t ( ' t i m e z o n e _ n a m e ' ,   ' U T C ' )  
                 } )  
          
         r e t u r n   R e s p o n s e ( {  
                 ' a c c o u n t s ' :   f o r m a t t e d _ a c c o u n t s ,  
                 ' t e m p _ t o k e n ' :   t e m p _ t o k e n     #   R e t u r n   t o k e n   f o r   n e x t   s t e p  
         } )  
 