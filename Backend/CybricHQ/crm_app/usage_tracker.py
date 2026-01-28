"""
Usage tracking utilities for recording API calls and calculating costs.
"""
from django.utils import timezone
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class UsageTracker:
    """
    Utility class for tracking API usage across services.
    """
    
    # Cost per unit (update these based on current API pricing)
    PRICING = {
        'openai': {
            'gpt-4': {'input': 0.03 / 1000, 'output': 0.06 / 1000},  # per 1K tokens
            'gpt-4-turbo': {'input': 0.01 / 1000, 'output': 0.03 / 1000},
            'gpt-3.5-turbo': {'input': 0.0005 / 1000, 'output': 0.0015 / 1000},
        },
        'elevenlabs': {
            'character': 0.00003,  # $0.30 per 10K characters
        },
        'smartflo': {
            'per_minute': 0.02,  # $0.02 per minute (adjust based on actual rate)
        }
    }
    
    @staticmethod
    def log_openai_usage(tenant, endpoint, tokens_input, tokens_output, model='gpt-4', 
                         response_time_ms=None, error=None, user_id=None, ip_address=None):
        """
        Log OpenAI API usage.
        
        Args:
            tenant: Tenant instance
            endpoint: API endpoint (e.g., '/v1/chat/completions')
            tokens_input: Input tokens used
            tokens_output: Output tokens generated
            model: Model used (gpt-4, gpt-4-turbo, gpt-3.5-turbo)
            response_time_ms: Response time in milliseconds
            error: Error message if failed
            user_id: User who made the request
            ip_address: IP address of request
        """
        from crm_app.models_usage import APIUsageLog
        
        total_tokens = tokens_input + tokens_output
        
        # Calculate cost
        pricing = UsageTracker.PRICING['openai'].get(model, UsageTracker.PRICING['openai']['gpt-4'])
        cost = Decimal(str(
            (tokens_input * pricing['input']) + (tokens_output * pricing['output'])
        ))
        
        log_entry = APIUsageLog.objects.create(
            tenant=tenant,
            service='openai',
            endpoint=endpoint,
            request_timestamp=timezone.now(),
            response_timestamp=timezone.now() if not error else None,
            response_status=200 if not error else 500,
            response_time_ms=response_time_ms,
            tokens_used=total_tokens,
            estimated_cost=cost,
            error=error,
            user_id=user_id,
            ip_address=ip_address,
            request_params={'model': model, 'tokens_input': tokens_input, 'tokens_output': tokens_output}
        )
        
        # Update monthly summary
        UsageTracker._update_monthly_summary(tenant, 'openai', total_tokens, cost)
        
        # Check quotas
        UsageTracker._check_quota(tenant, 'openai', total_tokens)
        
        return log_entry
    
    @staticmethod
    def log_elevenlabs_usage(tenant, endpoint, characters, duration_seconds=None,
                            response_time_ms=None, error=None, user_id=None, ip_address=None):
        """
        Log ElevenLabs API usage.
        
        Args:
            tenant: Tenant instance
            endpoint: API endpoint
            characters: Number of characters processed
            duration_seconds: Audio duration generated
            response_time_ms: Response time in milliseconds
            error: Error message if failed
            user_id: User who made the request
            ip_address: IP address of request
        """
        from crm_app.models_usage import APIUsageLog
        
        # Calculate cost
        cost = Decimal(str(characters * UsageTracker.PRICING['elevenlabs']['character']))
        
        log_entry = APIUsageLog.objects.create(
            tenant=tenant,
            service='elevenlabs',
            endpoint=endpoint,
            request_timestamp=timezone.now(),
            response_timestamp=timezone.now() if not error else None,
            response_status=200 if not error else 500,
            response_time_ms=response_time_ms,
            characters_used=characters,
            duration_seconds=Decimal(str(duration_seconds)) if duration_seconds else None,
            estimated_cost=cost,
            error=error,
            user_id=user_id,
            ip_address=ip_address,
            request_params={'characters': characters}
        )
        
        # Update monthly summary
        UsageTracker._update_monthly_summary(tenant, 'elevenlabs', characters, cost)
        
        # Check quotas
        UsageTracker._check_quota(tenant, 'elevenlabs', characters)
        
        return log_entry
    
    @staticmethod
    def log_smartflo_usage(tenant, endpoint, duration_seconds, from_number=None, to_number=None,
                          response_time_ms=None, error=None, user_id=None, ip_address=None):
        """
        Log Smartflo/telephony API usage.
        
        Args:
            tenant: Tenant instance
            endpoint: API endpoint
            duration_seconds: Call duration in seconds
            from_number: Caller number
            to_number: Called number
            response_time_ms: Response time in milliseconds
            error: Error message if failed
            user_id: User who made the request
            ip_address: IP address of request
        """
        from crm_app.models_usage import APIUsageLog
        
        # Calculate cost (per minute)
        duration_minutes = Decimal(str(duration_seconds)) / 60
        cost = duration_minutes * Decimal(str(UsageTracker.PRICING['smartflo']['per_minute']))
        
        log_entry = APIUsageLog.objects.create(
            tenant=tenant,
            service='smartflo',
            endpoint=endpoint,
            request_timestamp=timezone.now(),
            response_timestamp=timezone.now() if not error else None,
            response_status=200 if not error else 500,
            response_time_ms=response_time_ms,
            duration_seconds=Decimal(str(duration_seconds)),
            estimated_cost=cost,
            error=error,
            user_id=user_id,
            ip_address=ip_address,
            request_params={'from': from_number, 'to': to_number, 'duration': duration_seconds}
        )
        
        # Update monthly summary
        UsageTracker._update_monthly_summary(tenant, 'smartflo', duration_minutes, cost)
        
        # Check quotas
        UsageTracker._check_quota(tenant, 'smartflo', duration_minutes)
        
        return log_entry
    
    @staticmethod
    def _update_monthly_summary(tenant, service, usage_value, cost):
        """Update or create monthly usage summary"""
        from crm_app.models_usage import TenantUsageSummary
        from datetime import date
        
        # Get current month boundaries
        today = date.today()
        period_start = date(today.year, today.month, 1)
        
        # Get or create summary
        summary, created = TenantUsageSummary.objects.get_or_create(
            tenant=tenant,
            period_start=period_start,
            defaults={
                'period_end': date(today.year, today.month + 1, 1) if today.month < 12 
                              else date(today.year + 1, 1, 1)
            }
        )
        
        # Update service-specific fields
        if service == 'openai':
            summary.openai_requests += 1
            summary.openai_tokens += int(usage_value)
            summary.openai_cost += cost
        elif service == 'elevenlabs':
            summary.elevenlabs_requests += 1
            summary.elevenlabs_characters += int(usage_value)
            summary.elevenlabs_cost += cost
        elif service == 'smartflo':
            summary.smartflo_calls += 1
            summary.smartflo_duration_minutes += usage_value
            summary.smartflo_cost += cost
        
        # Update totals
        summary.total_requests += 1
        summary.total_cost = (
            summary.openai_cost + 
            summary.elevenlabs_cost + 
            summary.smartflo_cost + 
            summary.custom_cost
        )
        
        summary.save()
        logger.info(f"Updated usage summary for {tenant.name}: {service} +{usage_value}")
    
    @staticmethod
    def _check_quota(tenant, service, usage_value):
        """Check if tenant has exceeded quota and trigger alerts"""
        from crm_app.models_usage import UsageQuota, UsageAlert, TenantUsageSummary
        from datetime import date
        
        try:
            quota = UsageQuota.objects.get(tenant=tenant)
        except UsageQuota.DoesNotExist:
            return  # No quota set, unlimited usage
        
        # Get current month usage
        today = date.today()
        period_start = date(today.year, today.month, 1)
        
        try:
            summary = TenantUsageSummary.objects.get(tenant=tenant, period_start=period_start)
        except TenantUsageSummary.DoesNotExist:
            return
        
        # Check service-specific quotas
        alert_needed = False
        alert_type = 'quota_warning'
        message = ""
        current_value = 0
        threshold_value = 0
        
        if service == 'openai' and quota.openai_token_limit:
            check = quota.check_openai_quota(summary.openai_tokens)
            if check['alert_needed'] or check['exceeded']:
                alert_needed = True
                alert_type = 'quota_exceeded' if check['exceeded'] else 'quota_warning'
                message = f"OpenAI token usage at {check['usage_percent']:.1f}% ({summary.openai_tokens:,} / {quota.openai_token_limit:,} tokens)"
                current_value = summary.openai_tokens
                threshold_value = quota.openai_token_limit
        
        elif service == 'elevenlabs' and quota.elevenlabs_character_limit:
            usage_percent = (summary.elevenlabs_characters / quota.elevenlabs_character_limit) * 100
            if usage_percent >= quota.alert_at_percentage:
                alert_needed = True
                alert_type = 'quota_exceeded' if usage_percent >= 100 else 'quota_warning'
                message = f"ElevenLabs character usage at {usage_percent:.1f}% ({summary.elevenlabs_characters:,} / {quota.elevenlabs_character_limit:,} characters)"
                current_value = summary.elevenlabs_characters
                threshold_value = quota.elevenlabs_character_limit
        
        elif service == 'smartflo' and quota.smartflo_minute_limit:
            usage_percent = (float(summary.smartflo_duration_minutes) / float(quota.smartflo_minute_limit)) * 100
            if usage_percent >= quota.alert_at_percentage:
                alert_needed = True
                alert_type = 'quota_exceeded' if usage_percent >= 100 else 'quota_warning'
                message = f"Smartflo minute usage at {usage_percent:.1f}% ({summary.smartflo_duration_minutes} / {quota.smartflo_minute_limit} minutes)"
                current_value = float(summary.smartflo_duration_minutes)
                threshold_value = float(quota.smartflo_minute_limit)
        
        # Check cost limit
        if quota.monthly_cost_limit:
            cost_percent = (float(summary.total_cost) / float(quota.monthly_cost_limit)) * 100
            if cost_percent >= quota.alert_at_percentage:
                alert_needed = True
                alert_type = 'cost_warning'
                message = f"Monthly cost at {cost_percent:.1f}% (${summary.total_cost} / ${quota.monthly_cost_limit})"
                current_value = float(summary.total_cost)
                threshold_value = float(quota.monthly_cost_limit)
        
        # Create alert if needed
        if alert_needed:
            # Check if alert already exists for this period
            existing_alert = UsageAlert.objects.filter(
                tenant=tenant,
                alert_type=alert_type,
                service=service,
                status__in=['pending', 'sent'],
                created_at__gte=period_start
            ).first()
            
            if not existing_alert:
                UsageAlert.objects.create(
                    tenant=tenant,
                    alert_type=alert_type,
                    service=service,
                    message=message,
                    current_value=Decimal(str(current_value)),
                    threshold_value=Decimal(str(threshold_value)) if threshold_value else None,
                    status='pending'
                )
                logger.warning(f"Usage alert created for {tenant.name}: {message}")
    
    @staticmethod
    def get_current_usage(tenant, service=None):
        """
        Get current month usage for a tenant.
        
        Args:
            tenant: Tenant instance
            service: Optional service filter ('openai', 'elevenlabs', 'smartflo')
        
        Returns:
            TenantUsageSummary instance or dict with usage data
        """
        from crm_app.models_usage import TenantUsageSummary
        from datetime import date
        
        today = date.today()
        period_start = date(today.year, today.month, 1)
        
        try:
            summary = TenantUsageSummary.objects.get(tenant=tenant, period_start=period_start)
            
            if service:
                if service == 'openai':
                    return {
                        'requests': summary.openai_requests,
                        'tokens': summary.openai_tokens,
                        'cost': float(summary.openai_cost)
                    }
                elif service == 'elevenlabs':
                    return {
                        'requests': summary.elevenlabs_requests,
                        'characters': summary.elevenlabs_characters,
                        'cost': float(summary.elevenlabs_cost)
                    }
                elif service == 'smartflo':
                    return {
                        'calls': summary.smartflo_calls,
                        'duration_minutes': float(summary.smartflo_duration_minutes),
                        'cost': float(summary.smartflo_cost)
                    }
            
            return summary
        except TenantUsageSummary.DoesNotExist:
            return None
