"""
Example integration of UsageTracker with OpenAI, ElevenLabs, and Smartflo APIs.
This shows how to wrap your existing API calls with usage tracking.
"""

from crm_app.usage_tracker import UsageTracker
from crm_app.models import Tenant
import time


# ============================================================================
# EXAMPLE 1: OpenAI Integration
# ============================================================================

def call_openai_with_tracking(tenant_id: int, messages: list, model: str = "gpt-4"):
    """
    Wrapper for OpenAI API calls with automatic usage tracking.
    
    Args:
        tenant_id: ID of the tenant making the request
        messages: List of message dicts for ChatCompletion
        model: OpenAI model name
        
    Returns:
        The assistant's response text
    """
    from openai import OpenAI
    
    # Get tenant and their API key
    tenant = Tenant.objects.get(id=tenant_id)
    client = OpenAI(api_key=tenant.settings.openai_api_key)
    
    # Track request timing
    start_time = time.time()
    
    try:
        # Make the actual API call
        response = client.chat.completions.create(
            model=model,
            messages=messages
        )
        
        # Calculate response time
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Track successful usage
        tracker = UsageTracker()
        tracker.log_openai_usage(
            tenant=tenant,
            tokens_input=response.usage.prompt_tokens,
            tokens_output=response.usage.completion_tokens,
            model=model,
            endpoint='/v1/chat/completions',
            request_params={
                'model': model,
                'messages': [{'role': m['role']} for m in messages]  # Don't log full content
            },
            response_status=200,
            response_time_ms=response_time_ms
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        # Track failed usage
        tracker = UsageTracker()
        tracker.log_openai_usage(
            tenant=tenant,
            tokens_input=0,
            tokens_output=0,
            model=model,
            endpoint='/v1/chat/completions',
            response_status=500,
            error_message=str(e)
        )
        raise


# Usage Example:
"""
from crm_app.examples.usage_integration import call_openai_with_tracking

response = call_openai_with_tracking(
    tenant_id=1,
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is the capital of France?"}
    ],
    model="gpt-4"
)
print(response)
"""


# ============================================================================
# EXAMPLE 2: ElevenLabs Integration
# ============================================================================

def synthesize_speech_with_tracking(tenant_id: int, text: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM"):
    """
    Wrapper for ElevenLabs text-to-speech with automatic usage tracking.
    
    Args:
        tenant_id: ID of the tenant making the request
        text: Text to synthesize
        voice_id: ElevenLabs voice ID
        
    Returns:
        Audio data bytes
    """
    from elevenlabs import ElevenLabs
    
    # Get tenant and their API key
    tenant = Tenant.objects.get(id=tenant_id)
    client = ElevenLabs(api_key=tenant.settings.elevenlabs_api_key)
    
    start_time = time.time()
    
    try:
        # Make the API call
        audio = client.generate(
            text=text,
            voice=voice_id
        )
        
        duration_seconds = time.time() - start_time
        character_count = len(text)
        
        # Track usage
        tracker = UsageTracker()
        tracker.log_elevenlabs_usage(
            tenant=tenant,
            characters=character_count,
            duration_seconds=duration_seconds,
            endpoint='/v1/text-to-speech',
            request_params={
                'voice_id': voice_id,
                'text_length': character_count
            },
            response_status=200,
            response_time_ms=int(duration_seconds * 1000)
        )
        
        return audio
        
    except Exception as e:
        tracker = UsageTracker()
        tracker.log_elevenlabs_usage(
            tenant=tenant,
            characters=len(text),
            duration_seconds=0,
            endpoint='/v1/text-to-speech',
            response_status=500,
            error_message=str(e)
        )
        raise


# Usage Example:
"""
from crm_app.examples.usage_integration import synthesize_speech_with_tracking

audio = synthesize_speech_with_tracking(
    tenant_id=1,
    text="Hello, this is a test message.",
    voice_id="21m00Tcm4TlvDq8ikWAM"
)
# Save or play the audio
"""


# ============================================================================
# EXAMPLE 3: Smartflo Integration
# ============================================================================

def make_call_with_tracking(tenant_id: int, phone_number: str, call_duration_seconds: int):
    """
    Wrapper for Smartflo telephony calls with automatic usage tracking.
    
    Args:
        tenant_id: ID of the tenant making the request
        phone_number: Phone number to call
        call_duration_seconds: How long the call lasted
        
    Returns:
        Call result data
    """
    # Import your Smartflo client (adjust as needed)
    # from smartflo import SmartfloClient
    
    # Get tenant and their API key
    tenant = Tenant.objects.get(id=tenant_id)
    # client = SmartfloClient(api_key=tenant.settings.smartflo_api_key)
    
    start_time = time.time()
    
    try:
        # Make the call (adjust to your actual API)
        # result = client.make_call(
        #     phone=phone_number,
        #     duration=call_duration_seconds
        # )
        
        # For this example, simulate a call
        result = {
            'status': 'success',
            'call_id': 'call_12345',
            'duration': call_duration_seconds
        }
        
        # Track usage
        tracker = UsageTracker()
        tracker.log_smartflo_usage(
            tenant=tenant,
            duration_seconds=call_duration_seconds,
            endpoint='/api/make_call',
            request_params={
                'phone_number': phone_number[-4:],  # Only last 4 digits for privacy
                'duration': call_duration_seconds
            },
            response_status=200,
            response_time_ms=int((time.time() - start_time) * 1000)
        )
        
        return result
        
    except Exception as e:
        tracker = UsageTracker()
        tracker.log_smartflo_usage(
            tenant=tenant,
            duration_seconds=call_duration_seconds,
            endpoint='/api/make_call',
            response_status=500,
            error_message=str(e)
        )
        raise


# Usage Example:
"""
from crm_app.examples.usage_integration import make_call_with_tracking

result = make_call_with_tracking(
    tenant_id=1,
    phone_number="+1234567890",
    call_duration_seconds=185  # 3 min 5 sec
)
print(result)
"""


# ============================================================================
# EXAMPLE 4: Quota Checking Before API Calls
# ============================================================================

def check_tenant_quota(tenant_id: int, service: str) -> bool:
    """
    Check if tenant has remaining quota before making an API call.
    
    Args:
        tenant_id: ID of the tenant
        service: 'openai', 'elevenlabs', or 'smartflo'
        
    Returns:
        True if quota available, raises exception if exceeded
    """
    from crm_app.usage_tracker import UsageTracker
    
    tenant = Tenant.objects.get(id=tenant_id)
    
    # Check if tenant has quota configured
    if not hasattr(tenant, 'usage_quota'):
        return True  # No quota = unlimited
    
    quota = tenant.usage_quota
    tracker = UsageTracker()
    
    # Get current usage
    usage = tracker.get_current_usage(tenant, service)
    
    # Check service-specific limits
    if service == 'openai' and quota.openai_token_limit:
        tokens_used = usage.get('openai_total_tokens', 0)
        if tokens_used >= quota.openai_token_limit:
            raise Exception(f"OpenAI token quota exceeded: {tokens_used}/{quota.openai_token_limit}")
    
    elif service == 'elevenlabs' and quota.elevenlabs_character_limit:
        chars_used = usage.get('elevenlabs_total_characters', 0)
        if chars_used >= quota.elevenlabs_character_limit:
            raise Exception(f"ElevenLabs character quota exceeded: {chars_used}/{quota.elevenlabs_character_limit}")
    
    elif service == 'smartflo' and quota.smartflo_minute_limit:
        minutes_used = float(usage.get('smartflo_total_minutes', 0))
        if minutes_used >= float(quota.smartflo_minute_limit):
            raise Exception(f"Smartflo minute quota exceeded: {minutes_used}/{quota.smartflo_minute_limit}")
    
    # Check monthly cost limit
    if quota.monthly_cost_limit:
        cost_used = float(usage.get('total_cost_usd', 0))
        if cost_used >= float(quota.monthly_cost_limit):
            raise Exception(f"Monthly cost limit exceeded: ${cost_used}/${quota.monthly_cost_limit}")
    
    return True


# Usage Example with Quota Check:
"""
from crm_app.examples.usage_integration import check_tenant_quota, call_openai_with_tracking

# Check quota before calling API
try:
    check_tenant_quota(tenant_id=1, service='openai')
    response = call_openai_with_tracking(
        tenant_id=1,
        messages=[{"role": "user", "content": "Hello"}]
    )
except Exception as e:
    print(f"Quota exceeded: {e}")
"""


# ============================================================================
# EXAMPLE 5: View Current Usage
# ============================================================================

def print_tenant_usage(tenant_id: int):
    """
    Print current month usage summary for a tenant.
    """
    from crm_app.usage_tracker import UsageTracker
    
    tenant = Tenant.objects.get(id=tenant_id)
    tracker = UsageTracker()
    
    print(f"\n=== Usage Summary for {tenant.name} ===\n")
    
    # OpenAI usage
    openai_usage = tracker.get_current_usage(tenant, 'openai')
    print("OpenAI:")
    print(f"  Tokens: {openai_usage.get('openai_total_tokens', 0):,}")
    print(f"  Cost: ${openai_usage.get('openai_total_cost', 0)}")
    print(f"  API Calls: {openai_usage.get('total_api_calls', 0)}")
    
    # ElevenLabs usage
    elevenlabs_usage = tracker.get_current_usage(tenant, 'elevenlabs')
    print("\nElevenLabs:")
    print(f"  Characters: {elevenlabs_usage.get('elevenlabs_total_characters', 0):,}")
    print(f"  Cost: ${elevenlabs_usage.get('elevenlabs_total_cost', 0)}")
    print(f"  API Calls: {elevenlabs_usage.get('total_api_calls', 0)}")
    
    # Smartflo usage
    smartflo_usage = tracker.get_current_usage(tenant, 'smartflo')
    print("\nSmartflo:")
    print(f"  Minutes: {smartflo_usage.get('smartflo_total_minutes', 0)}")
    print(f"  Cost: ${smartflo_usage.get('smartflo_total_cost', 0)}")
    print(f"  API Calls: {smartflo_usage.get('total_api_calls', 0)}")
    
    # Total
    total_usage = tracker.get_current_usage(tenant)
    print(f"\nTotal Cost: ${total_usage.get('total_cost_usd', 0)}")
    print(f"Total API Calls: {total_usage.get('total_api_calls', 0)}")
    
    # Quota info
    if hasattr(tenant, 'usage_quota'):
        quota = tenant.usage_quota
        print(f"\n=== Quotas ===")
        if quota.openai_token_limit:
            print(f"OpenAI Token Limit: {quota.openai_token_limit:,}")
        if quota.monthly_cost_limit:
            print(f"Monthly Cost Limit: ${quota.monthly_cost_limit}")


# Usage Example:
"""
from crm_app.examples.usage_integration import print_tenant_usage

print_tenant_usage(tenant_id=1)
"""


# ============================================================================
# EXAMPLE 6: Create Quota for Tenant
# ============================================================================

def setup_tenant_quota(tenant_id: int, 
                       openai_tokens: int = None,
                       elevenlabs_chars: int = None,
                       smartflo_minutes: float = None,
                       monthly_cost: float = None):
    """
    Create or update quota limits for a tenant.
    
    Args:
        tenant_id: ID of the tenant
        openai_tokens: Max tokens per month (None = unlimited)
        elevenlabs_chars: Max characters per month (None = unlimited)
        smartflo_minutes: Max minutes per month (None = unlimited)
        monthly_cost: Max USD per month (None = unlimited)
    """
    from crm_app.models_usage import UsageQuota
    
    tenant = Tenant.objects.get(id=tenant_id)
    
    # Create or update quota
    quota, created = UsageQuota.objects.update_or_create(
        tenant=tenant,
        defaults={
            'openai_token_limit': openai_tokens,
            'elevenlabs_character_limit': elevenlabs_chars,
            'smartflo_minute_limit': smartflo_minutes,
            'monthly_cost_limit': monthly_cost,
            'alert_at_percentage': 80  # Alert at 80%
        }
    )
    
    action = "Created" if created else "Updated"
    print(f"{action} quota for {tenant.name}:")
    if openai_tokens:
        print(f"  OpenAI: {openai_tokens:,} tokens/month")
    if elevenlabs_chars:
        print(f"  ElevenLabs: {elevenlabs_chars:,} characters/month")
    if smartflo_minutes:
        print(f"  Smartflo: {smartflo_minutes} minutes/month")
    if monthly_cost:
        print(f"  Total: ${monthly_cost}/month")
    
    return quota


# Usage Example:
"""
from crm_app.examples.usage_integration import setup_tenant_quota

# Set up quota for a tenant
quota = setup_tenant_quota(
    tenant_id=1,
    openai_tokens=1_000_000,  # 1M tokens/month
    elevenlabs_chars=100_000,  # 100K characters/month
    smartflo_minutes=500,      # 500 minutes/month
    monthly_cost=500.00        # $500/month total
)
"""
