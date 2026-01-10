# billing/middleware.py
"""
Middleware for tracking API usage per user.
"""
import time
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


class UsageTrackingMiddleware:
    """
    Tracks API requests per user for usage analytics.
    Logs endpoint, method, response time, and status code.
    """
    
    # Endpoints to skip (static files, health checks, etc.)
    SKIP_PATHS = [
        '/static/',
        '/media/',
        '/favicon',
        '/admin/jsi18n/',
        '/health/',
        '/__debug__/',
    ]
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Skip non-API paths
        if any(request.path.startswith(skip) for skip in self.SKIP_PATHS):
            return self.get_response(request)
        
        # Skip if not an API request
        if not request.path.startswith('/api/'):
            return self.get_response(request)
        
        # Record start time
        start_time = time.time()
        
        # Process request
        response = self.get_response(request)
        
        # Calculate response time
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Log usage asynchronously to avoid blocking
        try:
            self._log_usage(request, response, response_time_ms)
        except Exception as e:
            logger.error(f"Failed to log usage: {e}")
        
        return response
    
    def _log_usage(self, request, response, response_time_ms):
        """Log the API request to the database."""
        # Import here to avoid circular imports
        from billing.usage_models import UsageLog
        
        # Get user
        user = None
        if hasattr(request, 'user') and request.user.is_authenticated:
            user = request.user
        
        # Get IP address
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0].strip()
        else:
            ip_address = request.META.get('REMOTE_ADDR')
        
        # Truncate endpoint to avoid storing query params
        endpoint = request.path[:255]
        
        # Create log entry
        UsageLog.objects.create(
            user=user,
            endpoint=endpoint,
            method=request.method,
            status_code=response.status_code,
            response_time_ms=response_time_ms,
            ip_address=ip_address,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500]
        )
