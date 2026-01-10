# billing/usage_models.py
"""
Usage tracking models for real-time metrics.
Tracks API requests, AI tokens, storage per user.
"""
import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.db.models import Sum, Count
from datetime import timedelta


class UsageLog(models.Model):
    """
    Log of API requests per user.
    Used for rate limiting and usage analytics.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='usage_logs',
        null=True, blank=True  # Allow anonymous requests
    )
    
    endpoint = models.CharField(max_length=255, db_index=True)
    method = models.CharField(max_length=10)  # GET, POST, etc.
    status_code = models.PositiveIntegerField(default=200)
    response_time_ms = models.PositiveIntegerField(default=0)
    
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['endpoint', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.method} {self.endpoint} - {self.user_id or 'anon'}"
    
    @classmethod
    def get_user_request_count(cls, user_id, days=30):
        """Get request count for a user in the last N days."""
        since = timezone.now() - timedelta(days=days)
        return cls.objects.filter(user_id=user_id, created_at__gte=since).count()


class TokenUsage(models.Model):
    """
    Track AI token consumption per user.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='token_usages'
    )
    
    model = models.CharField(max_length=100, default='gpt-4')  # AI model used
    prompt_tokens = models.PositiveIntegerField(default=0)
    completion_tokens = models.PositiveIntegerField(default=0)
    total_tokens = models.PositiveIntegerField(default=0)
    
    # Cost tracking (in cents)
    cost_cents = models.PositiveIntegerField(default=0)
    
    # Context
    feature = models.CharField(max_length=100, blank=True)  # 'call_analysis', 'chat', etc.
    request_id = models.CharField(max_length=100, blank=True)  # For debugging
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.user_id} - {self.total_tokens} tokens ({self.model})"
    
    def save(self, *args, **kwargs):
        # Auto-calculate total if not set
        if not self.total_tokens:
            self.total_tokens = self.prompt_tokens + self.completion_tokens
        
        # Auto-calculate cost based on model
        if not self.cost_cents:
            self.cost_cents = self._calculate_cost()
        
        super().save(*args, **kwargs)
    
    def _calculate_cost(self):
        """Calculate cost in cents based on model and tokens."""
        # Pricing per 1K tokens (in cents)
        pricing = {
            'gpt-4': {'prompt': 3.0, 'completion': 6.0},
            'gpt-4-turbo': {'prompt': 1.0, 'completion': 3.0},
            'gpt-3.5-turbo': {'prompt': 0.05, 'completion': 0.15},
            'claude-3': {'prompt': 1.5, 'completion': 7.5},
        }
        
        rates = pricing.get(self.model, pricing['gpt-3.5-turbo'])
        prompt_cost = (self.prompt_tokens / 1000) * rates['prompt']
        completion_cost = (self.completion_tokens / 1000) * rates['completion']
        
        return int((prompt_cost + completion_cost) * 100)  # Convert to cents
    
    @classmethod
    def get_user_total(cls, user_id, days=30):
        """Get total tokens for a user in the last N days."""
        since = timezone.now() - timedelta(days=days)
        result = cls.objects.filter(
            user_id=user_id, 
            created_at__gte=since
        ).aggregate(
            total=Sum('total_tokens'),
            cost=Sum('cost_cents')
        )
        return {
            'tokens': result['total'] or 0,
            'cost_cents': result['cost'] or 0
        }


class StorageUsage(models.Model):
    """
    Track storage per user (files, documents, etc.).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='storage_usages'
    )
    
    file_type = models.CharField(max_length=50, blank=True)  # 'document', 'image', 'recording'
    file_name = models.CharField(max_length=255)
    size_bytes = models.PositiveBigIntegerField(default=0)
    
    # Reference to the file (if applicable)
    content_type = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=100, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user_id} - {self.file_name} ({self.size_bytes} bytes)"
    
    @property
    def size_mb(self):
        return self.size_bytes / (1024 * 1024)
    
    @classmethod
    def get_user_total(cls, user_id):
        """Get total storage for a user."""
        result = cls.objects.filter(
            user_id=user_id, 
            deleted_at__isnull=True
        ).aggregate(total=Sum('size_bytes'))
        return result['total'] or 0


class DailyUsageSummary(models.Model):
    """
    Aggregated daily usage stats per user.
    Generated by a daily task for faster queries.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='daily_usage_summaries'
    )
    date = models.DateField(db_index=True)
    
    # API usage
    api_requests = models.PositiveIntegerField(default=0)
    avg_response_time_ms = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    
    # Token usage
    total_tokens = models.PositiveIntegerField(default=0)
    token_cost_cents = models.PositiveIntegerField(default=0)
    
    # Storage
    storage_added_bytes = models.BigIntegerField(default=0)
    total_storage_bytes = models.BigIntegerField(default=0)
    
    # Activity counts
    leads_created = models.PositiveIntegerField(default=0)
    calls_made = models.PositiveIntegerField(default=0)
    applications_created = models.PositiveIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['user', 'date']
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.user_id} - {self.date}"
