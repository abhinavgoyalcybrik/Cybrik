# crm_app/services/google_ads_client.py
"""
Google Ads API client for fetching real campaign data.
"""
import logging
from decimal import Decimal
from datetime import datetime

logger = logging.getLogger(__name__)

# Try to import Google Ads SDK - may not be available
try:
    from google.ads.googleads.client import GoogleAdsClient
    from google.ads.googleads.errors import GoogleAdsException
    GOOGLE_ADS_AVAILABLE = True
except ImportError:
    GOOGLE_ADS_AVAILABLE = False
    GoogleAdsClient = None
    GoogleAdsException = Exception  # Fallback


def get_google_ads_client(credentials: dict):
    """
    Create a Google Ads API client from stored credentials.
    """
    if not GOOGLE_ADS_AVAILABLE:
        raise Exception("Google Ads SDK not installed. Run: pip install google-ads")
    
    config = {
        "developer_token": credentials.get("developer_token"),
        "client_id": credentials.get("client_id"),
        "client_secret": credentials.get("client_secret"),
        "refresh_token": credentials.get("refresh_token"),
        "use_proto_plus": True,
    }
    
    if credentials.get("login_customer_id"):
        config["login_customer_id"] = credentials["login_customer_id"]
    
    client = GoogleAdsClient.load_from_dict(config)
    return client


def fetch_google_ads_campaigns(integration) -> list:
    """
    Fetch real campaign data from Google Ads API.
    """
    if not GOOGLE_ADS_AVAILABLE:
        raise Exception("Google Ads SDK not installed. Run: pip install google-ads")
    
    # Parse credentials from integration
    metadata = integration.metadata or {}
    credentials = {
        "developer_token": metadata.get("developer_token"),
        "client_id": metadata.get("client_id"),
        "client_secret": metadata.get("client_secret"),
        "refresh_token": integration.refresh_token or integration.access_token,
        "login_customer_id": metadata.get("login_customer_id"),
    }
    
    # Validate required fields
    if not credentials["developer_token"]:
        raise Exception("Missing developer_token. Please reconnect with full credentials.")
    if not credentials["client_id"]:
        raise Exception("Missing client_id. Please reconnect with full credentials.")
    if not credentials["client_secret"]:
        raise Exception("Missing client_secret. Please reconnect with full credentials.")
    if not credentials["refresh_token"]:
        raise Exception("Missing refresh_token. Please reconnect with full credentials.")
    
    try:
        client = get_google_ads_client(credentials)
        customer_id = integration.account_id.replace("-", "")
        
        ga_service = client.get_service("GoogleAdsService")
        
        query = """
            SELECT
                campaign.id,
                campaign.name,
                campaign.status,
                campaign.advertising_channel_type,
                campaign_budget.amount_micros,
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.cost_micros,
                metrics.ctr,
                metrics.average_cpc,
                metrics.average_cpm
            FROM campaign
            WHERE campaign.status != 'REMOVED'
            ORDER BY metrics.cost_micros DESC
            LIMIT 50
        """
        
        response = ga_service.search(customer_id=customer_id, query=query)
        
        campaigns = []
        for row in response:
            campaign = row.campaign
            metrics = row.metrics
            budget = row.campaign_budget
            
            cost = Decimal(str(metrics.cost_micros / 1_000_000))
            daily_budget = Decimal(str(budget.amount_micros / 1_000_000)) if budget.amount_micros else None
            avg_cpc = Decimal(str(metrics.average_cpc / 1_000_000)) if metrics.average_cpc else Decimal("0")
            avg_cpm = Decimal(str(metrics.average_cpm / 1_000_000)) if metrics.average_cpm else Decimal("0")
            
            status_map = {"ENABLED": "active", "PAUSED": "paused", "REMOVED": "ended"}
            status = status_map.get(campaign.status.name, "draft")
            
            campaigns.append({
                "external_campaign_id": str(campaign.id),
                "name": campaign.name,
                "status": status,
                "objective": campaign.advertising_channel_type.name if campaign.advertising_channel_type else None,
                "daily_budget": daily_budget,
                "total_spend": cost,
                "currency": "USD",
                "impressions": metrics.impressions,
                "clicks": metrics.clicks,
                "conversions": int(metrics.conversions) if metrics.conversions else 0,
                "ctr": Decimal(str(metrics.ctr * 100)).quantize(Decimal("0.0001")) if metrics.ctr else Decimal("0"),
                "cpc": avg_cpc.quantize(Decimal("0.01")),
                "cpm": avg_cpm.quantize(Decimal("0.01")),
            })
        
        logger.info(f"Fetched {len(campaigns)} campaigns from Google Ads for account {integration.account_id}")
        return campaigns
        
    except GoogleAdsException as ex:
        error_msg = str(ex)
        if hasattr(ex, 'failure') and ex.failure and ex.failure.errors:
            error_msg = ex.failure.errors[0].message
        logger.error(f"Google Ads API error: {error_msg}")
        raise Exception(f"Google Ads API error: {error_msg}")
    except Exception as e:
        logger.error(f"Error fetching Google Ads campaigns: {e}")
        raise
