# Usage Tracking & API Key Management - Quick Answer

## Your Question: "How will I manage the usage for them, how to see them, different API keys for every tenant?"

## ✅ Answer:

### 1. Different API Keys Per Tenant (ALREADY DONE!)

Each tenant already has their own API keys stored in `TenantSettings`:

```python
# crm_app/models.py - TenantSettings model
class TenantSettings(models.Model):
    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name='settings')
    openai_api_key = models.CharField(max_length=255, blank=True)
    elevenlabs_api_key = models.CharField(max_length=255, blank=True)
    smartflo_api_key = models.CharField(max_length=255, blank=True)
    # ... other settings
```

**How to use:**
```python
tenant = Tenant.objects.get(id=tenant_id)

# Each tenant uses their OWN API key
openai_client = OpenAI(api_key=tenant.settings.openai_api_key)
elevenlabs_client = ElevenLabs(api_key=tenant.settings.elevenlabs_api_key)
smartflo_client = Smartflo(api_key=tenant.settings.smartflo_api_key)
```

### 2. Track Usage Per Tenant (JUST CREATED!)

**New System Tracks:**
- ✅ OpenAI tokens (input + output)
- ✅ ElevenLabs characters
- ✅ Smartflo call duration (minutes)
- ✅ Cost in USD per API call
- ✅ Monthly aggregated summaries
- ✅ Quotas and limits
- ✅ Automatic alerts

**Models Created:**
1. `APIUsageLog` - Every single API call logged
2. `TenantUsageSummary` - Monthly totals per tenant
3. `UsageQuota` - Limits per tenant
4. `UsageAlert` - Warnings when quotas exceeded

### 3. How to See Usage

#### Option A: Admin Panel (View All Tenants)

**API Endpoints:**
```
GET /api/admin/usage/logs/          # All API calls
GET /api/admin/usage/summaries/     # Monthly summaries
GET /api/admin/usage/quotas/        # Tenant quotas
GET /api/admin/usage/alerts/        # Active alerts
```

**Example Response:**
```json
{
  "tenant_name": "Acme Corp",
  "openai_total_tokens": 125000,
  "openai_total_cost": "7.50",
  "elevenlabs_total_characters": 50000,
  "elevenlabs_total_cost": "1.50",
  "total_cost_usd": "11.41",
  "total_api_calls": 245
}
```

#### Option B: Tenant Dashboard (Own Usage Only)

**API Endpoint:**
```
GET /api/tenant/usage/dashboard/
```

Returns current month usage with quota percentages:
```json
{
  "openai": {
    "total_tokens": 125000,
    "total_cost": "7.50",
    "quota_limit": 1000000,
    "percentage_used": 12.5
  },
  "total_cost": "11.41",
  "alerts": [...]
}
```

### 4. How to Actually Track Usage (Integration)

**Step 1:** Use the `UsageTracker` utility in your API calls:

```python
from crm_app.usage_tracker import UsageTracker

# When calling OpenAI
tracker = UsageTracker()
tracker.log_openai_usage(
    tenant=tenant,
    tokens_input=150,
    tokens_output=450,
    model='gpt-4',
    response_status=200
)

# When calling ElevenLabs
tracker.log_elevenlabs_usage(
    tenant=tenant,
    characters=1200,
    duration_seconds=15.5,
    response_status=200
)

# When calling Smartflo
tracker.log_smartflo_usage(
    tenant=tenant,
    duration_seconds=185,  # 3 min 5 sec
    response_status=200
)
```

**Step 2:** It automatically:
- Calculates cost based on current pricing
- Updates monthly summaries
- Checks quotas
- Creates alerts if limits exceeded

### 5. Set Quotas Per Tenant

```python
from crm_app.models_usage import UsageQuota

# Set limits for a tenant
quota = UsageQuota.objects.create(
    tenant=tenant,
    openai_token_limit=1_000_000,  # 1M tokens/month
    monthly_cost_limit=500.00,     # $500/month max
    alert_at_percentage=80         # Alert at 80%
)
```

## Current Status

✅ **COMPLETED:**
- Database models created
- Migration applied (0019)
- API endpoints created
- Usage tracker utility ready
- Documentation written

⏳ **NEXT STEPS:**
1. Integrate `UsageTracker` into your OpenAI/ElevenLabs/Smartflo API calls
2. Create admin panel UI at `admin-panel/app/(admin)/usage/page.tsx`
3. Set quotas for each tenant
4. Test with real API calls

## Where to Look

📁 **Backend Files:**
- `crm_app/models_usage.py` - Usage tracking models
- `crm_app/usage_tracker.py` - Tracking utility
- `crm_app/views_usage.py` - API endpoints
- `Backend/USAGE_TRACKING_GUIDE.md` - Full documentation

📁 **Your Integrations (where to add tracking):**
- Find your OpenAI API calls → Add `tracker.log_openai_usage()`
- Find your ElevenLabs API calls → Add `tracker.log_elevenlabs_usage()`
- Find your Smartflo API calls → Add `tracker.log_smartflo_usage()`

## Quick Test

```bash
# Open Django shell
cd "d:\cybrik server\Cybrik\Backend\CybricHQ"
python manage.py shell

# Test tracking
from crm_app.models import Tenant
from crm_app.usage_tracker import UsageTracker

tenant = Tenant.objects.first()
tracker = UsageTracker()

# Log some OpenAI usage
tracker.log_openai_usage(
    tenant=tenant,
    tokens_input=100,
    tokens_output=200,
    model='gpt-4'
)

# View usage
usage = tracker.get_current_usage(tenant, 'openai')
print(f"Tokens: {usage['openai_total_tokens']}")
print(f"Cost: ${usage['openai_total_cost']}")
```

## Summary

Your system now has complete usage tracking! Each tenant has their own API keys (already configured), and you can now:

1. **Track** every API call with detailed logs
2. **Monitor** usage via admin dashboard
3. **Set limits** with quotas per tenant
4. **Get alerts** when approaching limits
5. **Calculate costs** automatically
6. **View reports** with monthly summaries

The infrastructure is ready - just need to integrate the tracking calls into your existing API integrations.
