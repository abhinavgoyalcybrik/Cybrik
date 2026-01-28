"""
Usage tracking models for multi-tenant API monitoring.
Tracks consumption across OpenAI, ElevenLabs, Smartflo, and custom services.
"""
from django.db import models
from django.utils import timezone
from decimal import Decimal


class APIUsageLog(models.Model):
    """
    Detailed log of every API call made by a tenant.
    Used for billing, monitoring, and debugging.
    """
    SERVICE_CHOICES = [
        ('openai', 'OpenAI'),
        ('elevenlabs', 'ElevenLabs'),
        ('smartflo', 'Smartflo'),
        ('custom', 'Custom API'),
    ]
    
    tenant = models.ForeignKey('crm_app.Tenant', on_delete=models.CASCADE, related_name='api_usage_logs')
    service = models.CharField(max_length=50, choices=SERVICE_CHOICES)
    endpoint = models.CharField(max_length=255, help_text="API endpoint called (e.g., /v1/chat/completions)")
    
    # Request details
    request_timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    request_method = models.CharField(max_length=10, default='POST')
    request_params = models.JSONField(default=dict, blank=True, help_text="Request parameters (sanitized)")
    
    # Response details
    response_timestamp = models.DateTimeField(null=True, blank=True)
    response_status = models.IntegerField(null=True, blank=True, help_text="HTTP status code")
    response_time_ms = models.IntegerField(null=True, blank=True, help_text="Response time in milliseconds")
    
    # Usage metrics (service-specific)
    tokens_used = models.IntegerField(null=True, blank=True, help_text="Tokens (OpenAI)")
    characters_used = models.IntegerField(null=True, blank=True, help_text="Characters (ElevenLabs)")
    duration_seconds = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Duration (Voice calls)")
    credits_used = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True, help_text="Credits consumed")
    
    # Cost tracking
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True, help_text="Cost in USD")
    
    # Error tracking
    error = models.TextField(blank=True, null=True, help_text="Error message if request failed")
    
    # Metadata
    user_id = models.CharField(max_length=255, blank=True, null=True, help_text="User who initiated the request")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    class Meta:
        ordering = ['-request_timestamp']
        indexes = [
            models.Index(fields=['tenant', 'service', '-request_timestamp']),
            models.Index(fields=['tenant', '-request_timestamp']),
            models.Index(fields=['service', '-request_timestamp']),
        ]
        verbose_name = "API Usage Log"
        verbose_name_plural = "API Usage Logs"
    
    def __str__(self):
        return f"{self.tenant.name} - {self.service} - {self.request_timestamp.strftime('%Y-%m-%d %H:%M')}"


class TenantUsageSummary(models.Model):
    """
    Aggregated usage summary per tenant per month.
    Pre-calculated for fast dashboard queries.
    """
    tenant = models.ForeignKey('crm_app.Tenant', on_delete=models.CASCADE, related_name='usage_summaries')
    period_start = models.DateField(help_text="Start of billing period (usually 1st of month)")
    period_end = models.DateField(help_text="End of billing period")
    
    # OpenAI usage
    openai_requests = models.IntegerField(default=0)
    openai_tokens = models.BigIntegerField(default=0)
    openai_cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    # ElevenLabs usage
    elevenlabs_requests = models.IntegerField(default=0)
    elevenlabs_characters = models.BigIntegerField(default=0)
    elevenlabs_cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    # Smartflo usage
    smartflo_calls = models.IntegerField(default=0)
    smartflo_duration_minutes = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    smartflo_cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    # Custom API usage
    custom_requests = models.IntegerField(default=0)
    custom_cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    # Totals
    total_requests = models.IntegerField(default=0)
    total_cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    # Metadata
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-period_start', 'tenant']
        unique_together = ['tenant', 'period_start']
        indexes = [
            models.Index(fields=['tenant', '-period_start']),
            models.Index(fields=['-period_start']),
        ]
        verbose_name = "Tenant Usage Summary"
        verbose_name_plural = "Tenant Usage Summaries"
    
    def __str__(self):
        return f"{self.tenant.name} - {self.period_start.strftime('%B %Y')}"
    
    @property
    def period_label(self):
        return self.period_start.strftime('%B %Y')


class UsageQuota(models.Model):
    """
    Usage limits and quotas per tenant.
    Enforces rate limiting and budget controls.
    """
    tenant = models.OneToOneField('crm_app.Tenant', on_delete=models.CASCADE, related_name='usage_quota')
    
    # Monthly quotas (null = unlimited)
    openai_token_limit = models.BigIntegerField(null=True, blank=True, help_text="Max tokens per month")
    elevenlabs_character_limit = models.BigIntegerField(null=True, blank=True, help_text="Max characters per month")
    smartflo_minute_limit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Max minutes per month")
    monthly_cost_limit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Max USD per month")
    
    # Rate limits (per minute)
    openai_rpm = models.IntegerField(null=True, blank=True, help_text="Requests per minute")
    elevenlabs_rpm = models.IntegerField(null=True, blank=True)
    smartflo_rpm = models.IntegerField(null=True, blank=True)
    
    # Alerts
    alert_at_percentage = models.IntegerField(default=80, help_text="Send alert when reaching X% of quota")
    alert_email = models.EmailField(blank=True, null=True, help_text="Email for quota alerts")
    
    # Status
    is_suspended = models.BooleanField(default=False, help_text="Suspend API access if quota exceeded")
    suspension_reason = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Usage Quota"
        verbose_name_plural = "Usage Quotas"
    
    def __str__(self):
        return f"Quota for {self.tenant.name}"
    
    def check_openai_quota(self, current_usage: int) -> dict:
        """Check if OpenAI quota is exceeded"""
        if not self.openai_token_limit:
            return {'exceeded': False, 'usage_percent': 0}
        
        usage_percent = (current_usage / self.openai_token_limit) * 100
        return {
            'exceeded': current_usage >= self.openai_token_limit,
            'usage_percent': usage_percent,
            'alert_needed': usage_percent >= self.alert_at_percentage
        }


class UsageAlert(models.Model):
    """
    Alerts triggered when usage exceeds thresholds.
    """
    ALERT_TYPES = [
        ('quota_warning', 'Quota Warning (80%)'),
        ('quota_exceeded', 'Quota Exceeded'),
        ('cost_warning', 'Cost Warning'),
        ('rate_limit', 'Rate Limit Hit'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('acknowledged', 'Acknowledged'),
        ('resolved', 'Resolved'),
    ]
    
    tenant = models.ForeignKey('crm_app.Tenant', on_delete=models.CASCADE, related_name='usage_alerts')
    alert_type = models.CharField(max_length=50, choices=ALERT_TYPES)
    service = models.CharField(max_length=50, blank=True)
    
    # Alert details
    message = models.TextField()
    current_value = models.DecimalField(max_digits=15, decimal_places=2)
    threshold_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Usage Alert"
        verbose_name_plural = "Usage Alerts"
    
    def __str__(self):
        return f"{self.tenant.name} - {self.get_alert_type_display()}"
