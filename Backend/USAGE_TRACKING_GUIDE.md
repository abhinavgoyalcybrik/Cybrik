# Complete Guide to API Usage Tracking System

## Table of Contents
1. [Overview & Purpose](#overview--purpose)
2. [Core Concepts](#core-concepts)
3. [Data Structure](#data-structure)
4. [Pricing & Calculations](#pricing--calculations)
5. [Setting Up Quotas](#setting-up-quotas)
6. [Alert System](#alert-system)
7. [API Endpoints](#api-endpoints)
8. [Practical Workflows](#practical-workflows)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Overview & Purpose

### What This System Does

Think of this as a **comprehensive metering and billing system** for AI services - similar to how utility companies track your water, electricity, and gas usage.

**The Big Picture:**
Your platform provides AI services (OpenAI, ElevenLabs, Smartflo) to multiple customers. Each customer has their own credentials and usage patterns. This system:

1. **Tracks** - Records every API call made by each customer
2. **Calculates** - Computes costs based on usage and current pricing
3. **Monitors** - Watches for quota limits and unusual patterns
4. **Alerts** - Notifies you and customers before problems occur
5. **Reports** - Provides dashboards and historical data for analysis

**Why You Need This:**
- 💰 Accurate billing and cost allocation
- 🛡️ Prevent unexpected overuse and costs
- 📊 Business intelligence and usage insights
- 🚨 Early warning system for issues
- 📈 Customer transparency and trust

---

## Core Concepts

### The Four Pillars of Usage Tracking

#### 1. Individual API Call Logs
**Think of it as:** Your itemized phone bill - every single call listed.

**What gets recorded:**
```python
{
  "id": "unique-id",
  "tenant_id": "customer-id",
  "service": "openai",
  "endpoint": "/v1/chat/completions",
  "model": "gpt-4",
  "timestamp": "2024-01-15T14:30:00Z",
  "input_tokens": 250,
  "output_tokens": 180,
  "total_tokens": 430,
  "cost": 0.0228,  # Calculated: (250 * 0.03 / 1000) + (180 * 0.06 / 1000)
  "status": "success",
  "response_time_ms": 1234,
  "error_message": null
}
```

**Why it's important:**
- Audit trail for billing disputes
- Debugging failed requests
- Performance monitoring
- Cost verification
- Compliance and regulatory requirements

**Retention:** Keep detailed logs for 90 days (configurable), then archive or delete.

---

#### 2. Monthly Usage Summaries
**Think of it as:** Your monthly credit card statement - all charges summarized.

**What gets calculated:**
```python
{
  "tenant_id": "customer-id",
  "tenant_name": "Acme Corp",
  "month": "2024-01",
  "summary": {
    "openai": {
      "total_tokens": 2_500_000,
      "total_cost": 125.50,
      "api_calls": 5_234,
      "gpt4_calls": 1_234,
      "gpt35_calls": 4_000
    },
    "elevenlabs": {
      "total_characters": 150_000,
      "total_cost": 4.50,
      "api_calls": 450
    },
    "smartflo": {
      "total_minutes": 680,
      "total_cost": 13.60,
      "api_calls": 124
    }
  },
  "total_cost": 143.60,
  "total_api_calls": 5_808,
  "last_updated": "2024-01-15T14:30:00Z"
}
```

**How summaries are updated:**
- Real-time: Updated immediately after each API call
- Aggregation: Uses database triggers or scheduled jobs
- Caching: Summary cached for fast dashboard loading

**Why it's important:**
- Fast dashboard performance (no need to sum thousands of records)
- Monthly billing calculations
- Trend analysis (month-over-month comparison)
- Quick overview for management

---

#### 3. Usage Quotas (Limits)
**Think of it as:** Data caps on your phone plan - preventing bill shock.

**Quota configuration example:**
```python
{
  "tenant_id": "customer-id",
  "quotas": {
    "openai_tokens_monthly": 5_000_000,    # 5 million tokens/month
    "elevenlabs_chars_monthly": 500_000,    # 500k characters/month
    "smartflo_minutes_monthly": 1_000,      # 1,000 minutes/month
    "total_cost_monthly": 500.00,           # $500/month maximum
    "requests_per_minute": 100              # Rate limiting: 100 req/min
  },
  "warning_threshold": 0.80,  # Alert at 80% usage
  "hard_limit": true,         # Block requests when exceeded
  "reset_day": 1              # Reset on 1st of each month
}
```

**Quota Types:**
```python
{
  "openai_tokens_monthly": 5_000_000,
  "elevenlabs_chars_monthly": 500_000,
  "smartflo_minutes_monthly": 1_000,
  "total_cost_monthly": 500.00,
  "requests_per_minute": 100
}
```

**Why it's important:**
- Budget control for customers
- Prevention of runaway costs
- Platform resource protection
- Fair usage policy enforcement

---

#### 4. Alerts and Notifications
**Think of it as:** Low-fuel warning light in your car - heads up before trouble.

**Alert types and triggers:**
```python
# Warning Alert (80% threshold)
{
  "alert_type": "quota_warning",
  "severity": "medium",
  "triggered_at": 0.80,  # 80% of quota
  "message": "Acme Corp has used 80% of their OpenAI token quota",
  "metadata": {
    "current_usage": 4_000_000,
    "quota_limit": 5_000_000,
    "remaining": 1_000_000,
    "estimated_days_remaining": 4
  }
}

# Critical Alert (100% threshold)
{
  "alert_type": "quota_exceeded",
  "severity": "high",
  "triggered_at": 1.00,
  "message": "Acme Corp has exceeded their OpenAI token quota",
  "metadata": {
    "current_usage": 5_100_000,
    "quota_limit": 5_000_000,
    "overage": 100_000,
    "overage_cost": 5.00
  }
}

# Rate Limit Alert
{
  "alert_type": "rate_limit_exceeded",
  "severity": "high",
  "message": "Acme Corp made 150 requests in 1 minute (limit: 100)",
  "metadata": {
    "requests_made": 150,
    "rate_limit": 100,
    "time_window": "1 minute"
  }
}

# Anomaly Alert
{
  "alert_type": "usage_anomaly",
  "severity": "medium",
  "message": "Unusual usage pattern detected for Acme Corp",
  "metadata": {
    "normal_daily_average": 50_000,
    "today_usage": 500_000,
    "deviation_percentage": 900
  }
}
```

**Alert lifecycle:**
1. **Created** - Condition met, alert generated
2. **Active** - Displayed in dashboards
3. **Acknowledged** - Admin has seen it
4. **Resolved** - Condition no longer true
5. **Archived** - Moved to historical records

**Why it's important:**
- Proactive problem prevention
- Immediate notification of issues
- Customer communication opportunities
- Audit trail of incidents

---

## Data Structure

### Database Schema Overview

**Table: `usage_logs`**
```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  service VARCHAR(50) NOT NULL,  -- 'openai', 'elevenlabs', 'smartflo'
  endpoint VARCHAR(255) NOT NULL,
  model VARCHAR(100),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Usage metrics
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  characters INTEGER,
  minutes DECIMAL(10, 2),
  
  -- Cost tracking
  cost DECIMAL(10, 4) NOT NULL,
  
  -- Request details
  status VARCHAR(20) NOT NULL,  -- 'success', 'error', 'timeout'
  response_time_ms INTEGER,
  error_code VARCHAR(50),
  error_message TEXT,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(255),
  
  -- Indexing
  INDEX idx_tenant_timestamp (tenant_id, timestamp DESC),
  INDEX idx_service_timestamp (service, timestamp DESC),
  INDEX idx_status (status)
);
```

**Table: `monthly_summaries`**
```sql
CREATE TABLE monthly_summaries (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  month DATE NOT NULL,  -- First day of month: '2024-01-01'
  
  -- OpenAI metrics
  openai_tokens_total BIGINT DEFAULT 0,
  openai_cost_total DECIMAL(10, 2) DEFAULT 0,
  openai_calls_total INTEGER DEFAULT 0,
  
  -- ElevenLabs metrics
  elevenlabs_chars_total BIGINT DEFAULT 0,
  elevenlabs_cost_total DECIMAL(10, 2) DEFAULT 0,
  elevenlabs_calls_total INTEGER DEFAULT 0,
  
  -- Smartflo metrics
  smartflo_minutes_total DECIMAL(10, 2) DEFAULT 0,
  smartflo_cost_total DECIMAL(10, 2) DEFAULT 0,
  smartflo_calls_total INTEGER DEFAULT 0,
  
  -- Aggregates
  total_cost DECIMAL(10, 2) GENERATED ALWAYS AS (
    openai_cost_total + elevenlabs_cost_total + smartflo_cost_total
  ) STORED,
  total_api_calls INTEGER GENERATED ALWAYS AS (
    openai_calls_total + elevenlabs_calls_total + smartflo_calls_total
  ) STORED,
  
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE (tenant_id, month),
  INDEX idx_month (month DESC)
);
```

**Table: `usage_quotas`**
```sql
CREATE TABLE usage_quotas (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id),
  
  -- Service-specific limits
  openai_tokens_monthly BIGINT,
  elevenlabs_chars_monthly BIGINT,
  smartflo_minutes_monthly DECIMAL(10, 2),
  
  -- Financial limits
  total_cost_monthly DECIMAL(10, 2),
  
  -- Rate limits
  requests_per_minute INTEGER DEFAULT 100,
  requests_per_hour INTEGER DEFAULT 5000,
  requests_per_day INTEGER DEFAULT 100000,
  
  -- Alert settings
  warning_threshold DECIMAL(3, 2) DEFAULT 0.80,  -- 80%
  hard_limit BOOLEAN DEFAULT FALSE,
  
  -- Admin notes
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Table: `usage_alerts`**
```sql
CREATE TABLE usage_alerts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,  -- 'low', 'medium', 'high', 'critical'
  message TEXT NOT NULL,
  metadata JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  
  INDEX idx_tenant_active (tenant_id, resolved_at)
    WHERE resolved_at IS NULL,
  INDEX idx_severity (severity, created_at DESC)
);
```

---

## Pricing & Calculations

### Current Service Pricing

#### OpenAI Pricing (as of 2024)

**GPT-4 Models:**
```python
PRICING_GPT4 = {
  "gpt-4": {
    "input": 0.03,   # $0.03 per 1,000 tokens
    "output": 0.06   # $0.06 per 1,000 tokens
  },
  "gpt-4-turbo": {
    "input": 0.01,
    "output": 0.03
  },
  "gpt-4-32k": {
    "input": 0.06,
    "output": 0.12
  }
}
```

**GPT-3.5 Models:**
```python
PRICING_GPT35 = {
  "gpt-3.5-turbo": {
    "input": 0.0005,   # $0.0005 per 1,000 tokens
    "output": 0.0015   # $0.0015 per 1,000 tokens
  },
  "gpt-3.5-turbo-16k": {
    "input": 0.003,
    "output": 0.004
  }
}
```

**Cost Calculation Example:**
```python
# Example API call
input_tokens = 250    # "Please write a short story about..."
output_tokens = 1800  # AI generates a 1,800 token story

# GPT-4 calculation
cost = (250 / 1000 * 0.03) + (1800 / 1000 * 0.06)
     = 0.0075 + 0.108
     = $0.1155

# GPT-3.5-turbo calculation
cost = (250 / 1000 * 0.0005) + (1800 / 1000 * 0.0015)
     = 0.000125 + 0.0027
     = $0.002825
```

**Token Estimation:**
- 1 token ≈ 4 characters for English
- "Hello, world!" = 4 tokens
- Average word = 1.3 tokens
- A page of text = ~500-750 tokens

---

#### ElevenLabs Pricing

```python
PRICING_ELEVENLABS = {
  "text_to_speech": 0.30,  # $0.30 per 1,000 characters
  "voice_cloning": 0.50    # $0.50 per 1,000 characters
}
```

**Cost Calculation Example:**
```python
text = "Hello, how are you doing today? I hope you're having a great day!"
characters = len(text)  # 73 characters

cost = characters / 1000 * 0.30
     = 73 / 1000 * 0.30
     = $0.0219
```

**Character Counting:**
- Includes all characters: letters, numbers, spaces, punctuation
- "Hello!" = 6 characters (including punctuation)
- Emojis count as 1-4 characters depending on encoding
- Typical sentence = 50-100 characters

---

#### Smartflo Pricing

```python
PRICING_SMARTFLO = {
  "inbound_call": 0.02,   # $0.02 per minute
  "outbound_call": 0.02,  # $0.02 per minute
  "sms": 0.01             # $0.01 per SMS
}
```

**Cost Calculation Example:**
```python
# 5 minute 30 second call
minutes = 5.5

cost = minutes * 0.02
     = 5.5 * 0.02
     = $0.11

# Billing is rounded up to nearest second
# 5:30 call = 5.5 minutes exactly
```

---

### Cost Calculation Implementation

**Python function for OpenAI:**
```python
def calculate_openai_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate cost for OpenAI API call"""
    pricing = PRICING_GPT4 if model.startswith('gpt-4') else PRICING_GPT35
    
    if model not in pricing:
        raise ValueError(f"Unknown model: {model}")
    
    input_cost = (input_tokens / 1000) * pricing[model]["input"]
    output_cost = (output_tokens / 1000) * pricing[model]["output"]
    
    return round(input_cost + output_cost, 4)  # Round to 4 decimal places
```

**Python function for ElevenLabs:**
```python
def calculate_elevenlabs_cost(characters: int, service: str = "text_to_speech") -> float:
    """Calculate cost for ElevenLabs API call"""
    price_per_1k = PRICING_ELEVENLABS[service]
    cost = (characters / 1000) * price_per_1k
    return round(cost, 4)
```

**Python function for Smartflo:**
```python
def calculate_smartflo_cost(duration_seconds: int, call_type: str = "inbound_call") -> float:
    """Calculate cost for Smartflo call"""
    minutes = duration_seconds / 60
    price_per_minute = PRICING_SMARTFLO[call_type]
    cost = minutes * price_per_minute
    return round(cost, 4)
```

---

## Setting Up Quotas

### Quota Configuration Workflow

#### Step 1: Assess Customer Needs

**Questions to ask:**
1. What is their expected monthly usage?
2. What is their budget?
3. Which services will they use most?
4. Do they need burst capacity?
5. What is their risk tolerance?

**Example Assessment:**
```
Customer: Acme Corp
Monthly Budget: $500
Primary Use: Customer service chatbot
Expected Volume: 10,000 conversations/month
Avg Tokens/Conversation: 500 tokens

Calculation:
- 10,000 conversations × 500 tokens = 5,000,000 tokens/month
- Using GPT-3.5-turbo: 5M tokens × $0.002/1K = $10/month
- Safety buffer: 2x = 10,000,000 tokens quota
- Cost cap: $500 (50x their expected use)
```

---

#### Step 2: Create Quota via API

**cURL Example:**
```bash
curl -X POST https://your-api.com/api/admin/usage/quotas/ \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "acme-corp-uuid",
    "openai_tokens_monthly": 10000000,
    "elevenlabs_chars_monthly": 500000,
    "smartflo_minutes_monthly": 1000,
    "total_cost_monthly": 500.00,
    "requests_per_minute": 100,
    "warning_threshold": 0.80,
    "hard_limit": false,
    "notes": "Initial quota for chatbot service"
  }'
```

**Python Example:**
```python
import requests

quota_config = {
    "tenant_id": "acme-corp-uuid",
    "openai_tokens_monthly": 10_000_000,
    "elevenlabs_chars_monthly": 500_000,
    "smartflo_minutes_monthly": 1_000,
    "total_cost_monthly": 500.00,
    "requests_per_minute": 100,
    "warning_threshold": 0.80,
    "hard_limit": False,
    "notes": "Initial quota for chatbot service"
}

response = requests.post(
    "https://your-api.com/api/admin/usage/quotas/",
    headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    json=quota_config
)

if response.status_code == 201:
    print("Quota created successfully!")
else:
    print(f"Error: {response.json()}")
```

---

#### Step 3: Monitor and Adjust

**Weekly Review Checklist:**
- [ ] Check customers at >70% of any quota
- [ ] Review alert history
- [ ] Identify growth trends
- [ ] Adjust quotas for expanding customers
- [ ] Remove quotas for churned customers

**Adjustment Scenarios:**
```python
# Current quota: 5M tokens
# Current usage: 4.5M tokens (90%)
# Growth trend: +50% month-over-month

# Action: Increase quota proactively
new_quota = 10_000_000  # 2x current usage
update_quota(tenant_id, openai_tokens_monthly=new_quota)
```

**Scenario 2: Customer Underutilizing**
```python
# Current quota: 5M tokens
# Current usage: 500K tokens (10%)
# Trend: Stable low usage

# Action: Consider reducing quota or checking in
# Maybe they're having technical issues
```

---

## Alert System

### Alert Configuration

**Setting Alert Thresholds:**
```python
ALERT_THRESHOLDS = {
    "warning": 0.80,    # 80% - Yellow warning
    "critical": 0.95,   # 95% - Orange alert
    "exceeded": 1.00    # 100% - Red critical
}
```

**Alert Generation Logic:**
```python
def check_quota_and_alert(tenant_id: str, service: str, current_usage: int):
    """Check if usage triggers any alerts"""
    quota = get_quota(tenant_id, service)
    
    if quota is None:
        return  # No quota set, no alerts
    
    usage_percentage = current_usage / quota
    
    if usage_percentage >= 1.00 and not alert_exists(tenant_id, service, "exceeded"):
        create_alert(
            tenant_id=tenant_id,
            alert_type="quota_exceeded",
            severity="critical",
            message=f"{service} quota exceeded: {current_usage}/{quota}",
            metadata={
                "service": service,
                "usage": current_usage,
                "quota": quota,
                "overage": current_usage - quota
            }
        )
        # Send immediate notification
        send_notification(tenant_id, "quota_exceeded", service)
    
    elif usage_percentage >= 0.80 and not alert_exists(tenant_id, service, "warning"):
        create_alert(
            tenant_id=tenant_id,
            alert_type="quota_warning",
            severity="medium",
            message=f"{service} quota at {usage_percentage*100:.0f}%",
            metadata={
                "service": service,
                "usage": current_usage,
                "quota": quota,
                "percentage": usage_percentage
            }
        )
        # Send warning notification
        send_notification(tenant_id, "quota_warning", service)
```

---

### Notification Channels

**Email Template Example:**
```html
<!-- Warning Email (80% threshold) -->
Subject: Usage Warning: Approaching OpenAI Quota Limit

Dear Acme Corp,

You have used 80% of your monthly OpenAI token quota.

Current Usage: 4,000,000 tokens
Monthly Quota: 5,000,000 tokens
Remaining: 1,000,000 tokens

At your current rate, you will exceed your quota in approximately 4 days.

Actions you can take:
- Review and optimize your API usage
- Request a quota increase
- Monitor your usage dashboard: https://dashboard.yourplatform.com/usage

Contact support if you need assistance.

Best regards,
Your Platform Team
```

**Webhook Payload Example:**
```json
{
  "event": "quota_warning",
  "timestamp": "2024-01-15T14:30:00Z",
  "tenant": {
    "id": "acme-corp-uuid",
    "name": "Acme Corp"
  },
  "alert": {
    "service": "openai",
    "current_usage": 4000000,
    "quota_limit": 5000000,
    "percentage": 0.80,
    "remaining": 1000000,
    "estimated_days_remaining": 4
  },
  "actions": {
    "view_dashboard": "https://dashboard.yourplatform.com/usage",
    "request_increase": "https://dashboard.yourplatform.com/quotas/increase",
    "contact_support": "support@yourplatform.com"
  }
}
```

---

## API Endpoints

### Complete API Reference

#### Admin Endpoints

**GET /api/admin/usage/summaries/**
```http
GET /api/admin/usage/summaries/?month=2024-01&tenant_id=uuid

Response 200:
[
  {
    "tenant_id": "uuid",
    "tenant_name": "Acme Corp",
    "month": "2024-01",
    "openai_cost": 125.50,
    "elevenlabs_cost": 4.50,
    "smartflo_cost": 13.60,
    "total_cost": 143.60,
    "total_calls": 5808
  }
]
```

**GET /api/admin/usage/logs/**
```http
GET /api/admin/usage/logs/?limit=50&offset=0&service=openai&tenant_id=uuid

Response 200:
{
  "count": 1234,
  "next": "?offset=50",
  "previous": null,
  "results": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "tenant_name": "Acme Corp",
      "service": "openai",
      "model": "gpt-4",
      "timestamp": "2024-01-15T14:30:00Z",
      "tokens": 430,
      "cost": 0.0228,
      "status": "success"
    }
  ]
}
```

**GET /api/admin/usage/alerts/**
```http
GET /api/admin/usage/alerts/?status=active&severity=high

Response 200:
[
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "tenant_name": "Acme Corp",
    "alert_type": "quota_exceeded",
    "severity": "high",
    "message": "OpenAI token quota exceeded",
    "created_at": "2024-01-15T14:30:00Z",
    "acknowledged": false,
    "metadata": {
      "current_usage": 5100000,
      "quota_limit": 5000000,
      "overage": 100000
    }
  }
]
```

**POST /api/admin/usage/quotas/**
```http
POST /api/admin/usage/quotas/

Request Body:
{
  "tenant_id": "uuid",
  "openai_tokens_monthly": 10000000,
  "elevenlabs_chars_monthly": 500000,
  "smartflo_minutes_monthly": 1000,
  "total_cost_monthly": 500.00,
  "requests_per_minute": 100,
  "warning_threshold": 0.80,
  "hard_limit": false
}

Response 201:
{
  "id": "uuid",
  "tenant_id": "uuid",
  "openai_tokens_monthly": 10000000,
  "created_at": "2024-01-15T14:30:00Z"
}
```

**PATCH /api/admin/usage/quotas/{id}/**
```http
PATCH /api/admin/usage/quotas/uuid/

Request Body:
{
  "openai_tokens_monthly": 15000000,
  "notes": "Increased due to growing usage"
}

Response 200:
{
  "id": "uuid",
  "tenant_id": "uuid",
  "openai_tokens_monthly": 15000000,
  "updated_at": "2024-01-15T14:35:00Z"
}
```

**POST /api/admin/usage/alerts/{id}/acknowledge/**
```http
POST /api/admin/usage/alerts/uuid/acknowledge/

Response 200:
{
  "id": "uuid",
  "acknowledged": true,
  "acknowledged_at": "2024-01-15T14:30:00Z",
  "acknowledged_by": "admin-user-uuid"
}
```

---

#### Customer Endpoints

**GET /api/tenant/usage/dashboard/**
```http
GET /api/tenant/usage/dashboard/

Response 200:
{
  "current_month": {
    "month": "2024-01",
    "total_cost": 143.60,
    "services": {
      "openai": {
        "cost": 125.50,
        "usage": 5000000,
        "quota": 10000000,
        "percentage": 50.0
      },
      "elevenlabs": {
        "cost": 4.50,
        "usage": 15000,
        "quota": 500000,
        "percentage": 3.0
      },
      "smartflo": {
        "cost": 13.60,
        "usage": 680,
        "quota": 1000,
        "percentage": 68.0
      }
    }
  },
  "active_alerts": [
    {
      "service": "smartflo",
      "message": "Smartflo usage at 68% of quota",
      "severity": "medium"
    }
  ]
}
```

**GET /api/tenant/usage/history/**
```http
GET /api/tenant/usage/history/?months=6

Response 200:
[
  {
    "month": "2024-01",
    "total_cost": 143.60,
    "openai_cost": 125.50,
    "elevenlabs_cost": 4.50,
    "smartflo_cost": 13.60,
    "total_calls": 5808
  },
  {
    "month": "2023-12",
    "total_cost": 98.30,
    "openai_cost": 85.20,
    "elevenlabs_cost": 3.10,
    "smartflo_cost": 10.00,
    "total_calls": 4521
  }
]
```

---

## Practical Workflows

### Workflow 1: Onboarding New Customer

```python
# Step 1: Create tenant in system
tenant = create_tenant(
    name="Acme Corp",
    email="contact@acmecorp.com",
    credentials={
        "openai_api_key": "sk-...",
        "elevenlabs_api_key": "ek-...",
        "smartflo_api_key": "sf-..."
    }
)

# Step 2: Set initial quotas (conservative)
create_quota(
    tenant_id=tenant.id,
    openai_tokens_monthly=1_000_000,      # 1M tokens
    elevenlabs_chars_monthly=100_000,     # 100K chars
    smartflo_minutes_monthly=100,         # 100 minutes
    total_cost_monthly=100.00,            # $100 cap
    warning_threshold=0.80,
    hard_limit=False  # Allow overage initially
)

# Step 3: Send welcome email with dashboard link
send_welcome_email(
    to=tenant.email,
    dashboard_url=f"https://dashboard.yourplatform.com/usage",
    credentials=tenant.credentials
)

# Step 4: Monitor first month closely
schedule_review(tenant.id, days=7)
schedule_review(tenant.id, days=30)
```

---

### Workflow 2: Handling Quota Exceeded Alert

```python
# Alert received: Acme Corp exceeded OpenAI quota
alert = get_alert(alert_id)

# Step 1: Acknowledge alert
acknowledge_alert(alert.id, admin_user_id)

# Step 2: Check if it's expected
usage_history = get_usage_history(alert.tenant_id, months=3)
is_growth_trend = analyze_growth(usage_history)

if is_growth_trend:
    # Expected growth - increase quota
    current_quota = get_quota(alert.tenant_id)
    new_quota = current_quota.openai_tokens_monthly * 1.5  # 50% increase
    
    update_quota(
        tenant_id=alert.tenant_id,
        openai_tokens_monthly=new_quota,
        notes=f"Increased due to growth trend. Previous: {current_quota.openai_tokens_monthly}"
    )
    
    # Notify customer
    send_email(
        to=alert.tenant_email,
        subject="Quota Increased",
        message=f"Your OpenAI quota has been increased to {new_quota:,} tokens/month"
    )
else:
    # Unexpected spike - investigate
    recent_logs = get_logs(
        tenant_id=alert.tenant_id,
        service="openai",
        limit=100
    )
    
    # Check for errors or unusual patterns
    error_rate = sum(1 for log in recent_logs if log.status == "error") / len(recent_logs)
    
    if error_rate > 0.1:  # >10% errors
        # Possible retry loop - contact customer
        send_alert_email(
            to=alert.tenant_email,
            subject="Unusual Usage Pattern Detected",
            message="We detected high error rates in your API calls. Please check your integration."
        )
    else:
        # Legitimate spike - offer quota increase
        send_email(
            to=alert.tenant_email,
            subject="Quota Increase Available",
            message="Would you like to increase your monthly quota?"
        )
```

---

### Workflow 3: Monthly Billing

```python
# Run on 1st of each month
def generate_monthly_invoices():
    # Get all tenants
    tenants = get_all_tenants()
    
    for tenant in tenants:
        # Get last month's summary
        last_month = get_previous_month()
        summary = get_monthly_summary(tenant.id, last_month)
        
        # Generate invoice
        invoice = create_invoice(
            tenant_id=tenant.id,
            period=last_month,
            line_items=[
                {
                    "service": "OpenAI",
                    "usage": f"{summary.openai_tokens_total:,} tokens",
                    "cost": summary.openai_cost_total
                },
                {
                    "service": "ElevenLabs",
                    "usage": f"{summary.elevenlabs_chars_total:,} characters",
                    "cost": summary.elevenlabs_cost_total
                },
                {
                    "service": "Smartflo",
                    "usage": f"{summary.smartflo_minutes_total:.1f} minutes",
                    "cost": summary.smartflo_cost_total
                }
            ],
            total=summary.total_cost
        )
        
        # Send invoice
        send_invoice_email(tenant.email, invoice)
        
        # Reset monthly quotas (quotas reset automatically on 1st)
        # Archive old data if needed
        if tenant.data_retention_days == 90:
            archive_old_logs(tenant.id, days=90)
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Costs Don't Match Expected Values

**Symptoms:**
- Customer reports charges don't match their expectations
- Dashboard shows higher costs than customer calculated

**Diagnosis:**
```python
# Check recent API calls
logs = get_logs(tenant_id, service="openai", limit=100)

# Verify pricing
for log in logs:
    recalculated_cost = calculate_openai_cost(
        log.model,
        log.input_tokens,
        log.output_tokens
    )
    
    if abs(recalculated_cost - log.cost) > 0.001:
        print(f"Discrepancy found in log {log.id}")
        print(f"Stored: ${log.cost}, Calculated: ${recalculated_cost}")
```

**Common Causes:**
1. **Wrong pricing tier** - Check if pricing was updated
2. **Token counting mismatch** - Verify tokenization method
3. **Cached costs** - Dashboard may be showing cached data

**Solutions:**
```python
# Recalculate all costs for the month
recalculate_monthly_costs(tenant_id, month)

# Update pricing if service provider changed rates
update_pricing_config(service="openai", new_pricing=UPDATED_PRICING)

# Clear dashboard cache
clear_cache(f"dashboard:{tenant_id}")
```

---

#### Issue 2: Alerts Not Triggering

**Symptoms:**
- Customer exceeds quota but no alert generated
- Warning threshold passed but no notification sent

**Diagnosis:**
```python
# Check alert generation function
test_alert_generation(
    tenant_id="test-tenant",
    service="openai",
    current_usage=4_500_000,  # Should trigger at 80% of 5M
    quota_limit=5_000_000
)

# Check alert history
alerts = get_all_alerts(tenant_id, include_resolved=True)
print(f"Total alerts generated: {len(alerts)}")

# Verify quota settings
quota = get_quota(tenant_id)
print(f"Warning threshold: {quota.warning_threshold}")
```

**Common Causes:**
1. **Alert already exists** - System prevents duplicate alerts
2. **Quota not set** - No quota means no alerts
3. **Threshold misconfigured** - Check warning_threshold value
4. **Alert generation disabled** - Check system settings

**Solutions:**
```python
# Enable alert generation
update_system_config("alerts_enabled", True)

# Lower warning threshold if needed
update_quota(tenant_id, warning_threshold=0.70)  # Alert at 70%

# Manually create alert for testing
create_alert(
    tenant_id=tenant_id,
    alert_type="test_alert",
    severity="low",
    message="Test alert - please acknowledge"
)
```

---

#### Issue 3: Dashboard Shows Stale Data

**Symptoms:**
- Usage numbers don't update after API calls
- Recent activity not showing
- Monthly total stuck

**Diagnosis:**
```python
# Check when summary was last updated
summary = get_monthly_summary(tenant_id, current_month)
print(f"Last updated: {summary.last_updated}")

# Check if recent API calls are logged
recent_logs = get_logs(tenant_id, limit=10)
print(f"Most recent log: {recent_logs[0].timestamp}")

# Check database triggers
verify_database_triggers()
```

**Common Causes:**
1. **Aggregation job failed** - Background job not running
2. **Database trigger disabled** - Auto-update not working
3. **Cache not invalidated** - Old data served from cache
4. **Database connection issue** - Writes not committing

**Solutions:**
```python
# Manually trigger aggregation
run_aggregation_job(tenant_id, force=True)

# Rebuild monthly summary
rebuild_monthly_summary(tenant_id, month)

# Clear all caches
clear_all_caches()

# Verify database health
check_database_connection()
check_database_locks()
```

---

#### Issue 4: Performance Issues with Large Datasets

**Symptoms:**
- Dashboard takes >5 seconds to load
- API timeouts when fetching logs
- Database queries are slow

**Diagnosis:**
```sql
-- Check table sizes
SELECT 
  table_name,
  pg_size_pretty(pg_total_relation_size(table_name::regclass)) AS size
FROM (
  VALUES ('usage_logs'), ('monthly_summaries'), ('usage_alerts')
) AS t(table_name);

-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%usage%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct
FROM pg_stats
WHERE tablename IN ('usage_logs', 'monthly_summaries')
  AND n_distinct > 1000
  AND attname NOT IN (
    SELECT indexname FROM pg_indexes
  );
```

**Common Causes:**
1. **Missing database indexes** - Queries doing table scans
2. **Too many log records** - Millions of rows slow queries
3. **No data pagination** - Trying to load all data at once
4. **Inefficient queries** - N+1 problems, unnecessary joins

**Solutions:**
```python
# Add database indexes
add_index("usage_logs", ["tenant_id", "timestamp"])
add_index("usage_logs", ["service", "timestamp"])
add_index("usage_alerts", ["tenant_id", "resolved_at"])

# Implement pagination
def get_logs_paginated(tenant_id, page=1, page_size=50):
    offset = (page - 1) * page_size
    return get_logs(tenant_id, limit=page_size, offset=offset)

# Archive old data
archive_logs_older_than(days=90)

# Use database views for complex queries
create_aggregated_view("monthly_usage_view")
```

---

## Best Practices

### 1. Quota Management

**Do:**
✅ Start with conservative quotas
✅ Monitor usage weekly
✅ Increase quotas proactively for growing customers
✅ Set both service-specific and total cost limits
✅ Use soft limits (warnings) before hard limits
✅ Document quota change history

**Don't:**
❌ Set unlimited quotas without monitoring
❌ Wait for customers to complain
❌ Make quota changes without notification
❌ Use only cost limits (also limit tokens/chars/minutes)
❌ Forget to adjust quotas seasonally

---

### 2. Alert Management

**Do:**
✅ Respond to alerts within 24 hours
✅ Acknowledge all alerts (even false positives)
✅ Set up email notifications for critical alerts
✅ Review alert patterns monthly
✅ Adjust thresholds based on customer behavior
✅ Document alert resolution steps

**Don't:**
❌ Ignore recurring alerts
❌ Set thresholds too low (alert fatigue)
❌ Auto-resolve alerts without investigation
❌ Disable alerts globally
❌ Forget to notify customers about their alerts

---

### 3. Data Management

**Do:**
✅ Archive logs older than 90 days
✅ Keep monthly summaries forever
✅ Back up usage data regularly
✅ Implement data retention policies
✅ Use database partitioning for large tables
✅ Monitor database size growth

**Don't:**
❌ Delete data without archiving
❌ Keep detailed logs indefinitely
❌ Ignore database performance issues
❌ Store unnecessary metadata
❌ Forget about data privacy compliance

---

### 4. Customer Communication

**Do:**
✅ Send proactive notifications at 80% usage
✅ Provide clear usage dashboards
✅ Explain pricing transparently
✅ Offer quota increase suggestions
✅ Share usage optimization tips
✅ Respond quickly to usage questions

**Don't:**
❌ Surprise customers with overage charges
❌ Hide usage information
❌ Use technical jargon in notifications
❌ Wait for customers to ask about costs
❌ Ignore usage pattern changes

---

### 5. System Maintenance

**Do:**
✅ Run health checks daily
✅ Test alert generation monthly
✅ Verify cost calculations quarterly
✅ Update pricing when providers change rates
✅ Optimize database queries regularly
✅ Monitor API response times

**Don't:**
❌ Assume everything is working
❌ Skip testing after code changes
❌ Ignore performance degradation
❌ Forget to update documentation
❌ Deploy changes without backups

---

## Appendix

### Glossary

- **Token**: Unit of text in OpenAI models (~4 characters)
- **Character**: Single text character in ElevenLabs
- **Minute**: 60 seconds of call time in Smartflo
- **Quota**: Maximum allowed usage per time period
- **Alert**: Automated notification about usage
- **Tenant**: Customer/organization using your platform
- **API Call**: Single request to AI service
- **Monthly Summary**: Aggregated usage data for one month
- **Cost**: Dollar amount charged for usage

---

### Quick Reference

**Token Estimates:**
- Word: ~1.3 tokens
- Sentence: ~15-25 tokens
- Paragraph: ~100-150 tokens
- Page: ~500-750 tokens

**Common Query Times:**
- Dashboard load: <2 seconds
- Recent logs (50): <500ms
- Monthly summary: <100ms
- Alert check: <50ms

**Recommended Limits:**
- Logs retention: 90 days
- API rate limit: 100 requests/minute
- Dashboard refresh: Every 5 minutes
- Alert check: Every 1 minute

---

## Conclusion

This usage tracking system provides:

✅ **Complete visibility** into customer API usage
✅ **Accurate cost calculation** for billing
✅ **Proactive alerts** to prevent issues
✅ **Flexible quotas** for customer control
✅ **Historical data** for analysis
✅ **Scalable architecture** for growth

With proper setup and monitoring, you can confidently manage API usage for hundreds of customers while keeping costs under control and customers informed.

For additional support or questions, refer to the admin dashboard guide or contact your development team.
