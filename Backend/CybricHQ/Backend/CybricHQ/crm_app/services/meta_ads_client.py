# crm_app/services/meta_ads_client.py
"""
Meta (Facebook) Marketing API client for fetching real campaign data.
"""
import logging
from decimal import Decimal
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Try to import Facebook Business SDK - may not be available
try:
    from facebook_business.api import FacebookAdsApi
    from facebook_business.adobjects.adaccount import AdAccount
    from facebook_business.adobjects.campaign import Campaign
    from facebook_business.adobjects.adsinsights import AdsInsights
    from facebook_business.exceptions import FacebookRequestError
    META_ADS_AVAILABLE = True
except ImportError:
    META_ADS_AVAILABLE = False
    FacebookAdsApi = None
    AdAccount = None
    Campaign = None
    AdsInsights = None
    FacebookRequestError = Exception


def get_meta_ads_client(access_token: str, app_secret: str = None, app_id: str = None):
    """
    Initialize Meta Marketing API.
    """
    if not META_ADS_AVAILABLE:
        raise Exception("Meta Ads SDK not installed. Run: pip install facebook-business")
    
    FacebookAdsApi.init(
        app_id=app_id,
        app_secret=app_secret,
        access_token=access_token,
    )
    return True


def fetch_meta_ads_campaigns(integration) -> list:
    """
    Fetch real campaign data from Meta Marketing API.
    """
    if not META_ADS_AVAILABLE:
        raise Exception("Meta Ads SDK not installed. Run: pip install facebook-business")
    
    metadata = integration.metadata or {}
    access_token = integration.access_token
    app_secret = metadata.get("app_secret")
    app_id = metadata.get("app_id")
    
    if not access_token:
        raise Exception("Missing access_token. Please reconnect with valid credentials.")
    
    try:
        # Initialize the API
        FacebookAdsApi.init(
            app_id=app_id,
            app_secret=app_secret,
            access_token=access_token,
        )
        
        # Account ID should be in format "act_XXXXX"
        account_id = integration.account_id
        if not account_id.startswith("act_"):
            account_id = f"act_{account_id}"
        
        ad_account = AdAccount(account_id)
        
        # Fetch campaigns with insights
        campaigns_data = ad_account.get_campaigns(
            fields=[
                Campaign.Field.id,
                Campaign.Field.name,
                Campaign.Field.status,
                Campaign.Field.objective,
                Campaign.Field.daily_budget,
                Campaign.Field.lifetime_budget,
                Campaign.Field.start_time,
                Campaign.Field.stop_time,
            ]
        )
        
        campaigns = []
        for campaign in campaigns_data:
            campaign_id = campaign.get(Campaign.Field.id)
            
            # Fetch insights for this campaign
            try:
                insights = Campaign(campaign_id).get_insights(
                    fields=[
                        AdsInsights.Field.spend,
                        AdsInsights.Field.impressions,
                        AdsInsights.Field.clicks,
                        AdsInsights.Field.ctr,
                        AdsInsights.Field.cpc,
                        AdsInsights.Field.cpm,
                    ],
                    params={'date_preset': 'last_30d'}
                )
                insight = insights[0] if insights else {}
            except Exception as e:
                logger.warning(f"Could not fetch insights for campaign {campaign_id}: {e}")
                insight = {}
            
            # Map status
            status_map = {"ACTIVE": "active", "PAUSED": "paused", "DELETED": "ended", "ARCHIVED": "ended"}
            raw_status = campaign.get(Campaign.Field.status, "")
            status = status_map.get(raw_status, "draft")
            
            # Parse budgets (Meta returns in cents)
            daily_budget = campaign.get(Campaign.Field.daily_budget)
            lifetime_budget = campaign.get(Campaign.Field.lifetime_budget)
            
            # Parse dates
            start_time = campaign.get(Campaign.Field.start_time)
            stop_time = campaign.get(Campaign.Field.stop_time)
            start_date = None
            end_date = None
            
            if start_time:
                try:
                    start_date = datetime.fromisoformat(start_time.replace('Z', '+00:00')).date()
                except:
                    pass
            if stop_time:
                try:
                    end_date = datetime.fromisoformat(stop_time.replace('Z', '+00:00')).date()
                except:
                    pass
            
            # Extract metrics from insights
            spend = Decimal(str(insight.get('spend', 0) or 0))
            impressions = int(insight.get('impressions', 0) or 0)
            clicks = int(insight.get('clicks', 0) or 0)
            ctr = Decimal(str(insight.get('ctr', 0) or 0))
            cpc = Decimal(str(insight.get('cpc', 0) or 0))
            cpm = Decimal(str(insight.get('cpm', 0) or 0))
            
            campaigns.append({
                "external_campaign_id": str(campaign_id),
                "name": campaign.get(Campaign.Field.name, f"Campaign {campaign_id}"),
                "status": status,
                "objective": campaign.get(Campaign.Field.objective),
                "daily_budget": Decimal(str(int(daily_budget) / 100)) if daily_budget else None,
                "lifetime_budget": Decimal(str(int(lifetime_budget) / 100)) if lifetime_budget else None,
                "total_spend": spend,
                "currency": "USD",
                "impressions": impressions,
                "clicks": clicks,
                "conversions": 0,  # Would need conversion tracking setup
                "ctr": ctr.quantize(Decimal("0.0001")),
                "cpc": cpc.quantize(Decimal("0.01")),
                "cpm": cpm.quantize(Decimal("0.01")),
                "start_date": start_date,
                "end_date": end_date,
            })
        
        logger.info(f"Fetched {len(campaigns)} campaigns from Meta Ads for account {integration.account_id}")
        return campaigns
        
    except FacebookRequestError as ex:
        logger.error(f"Meta Ads API error: {ex.api_error_message()}")
        raise Exception(f"Meta Ads API error: {ex.api_error_message()}")
    except Exception as e:
        logger.error(f"Error fetching Meta Ads campaigns: {e}")
        raise
