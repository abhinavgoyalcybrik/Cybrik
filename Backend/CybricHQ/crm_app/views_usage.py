"""
API views for usage tracking and monitoring.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import datetime, timedelta, date
from decimal import Decimal

from crm_app.models_usage import (
    APIUsageLog,
    TenantUsageSummary,
    UsageQuota,
    UsageAlert
)
from crm_app.models import Tenant
from crm_app.usage_tracker import UsageTracker
from rest_framework import serializers


class APIUsageLogSerializer(serializers.ModelSerializer):
    """Serializer for API usage logs"""
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    
    class Meta:
        model = APIUsageLog
        fields = [
            'id', 'tenant', 'tenant_name', 'service', 'endpoint',
            'request_timestamp', 'response_timestamp', 'response_status',
            'response_time_ms', 'tokens_used', 'characters_used',
            'duration_seconds', 'estimated_cost', 'error'
        ]


class TenantUsageSummarySerializer(serializers.ModelSerializer):
    """Serializer for tenant usage summaries"""
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    tenant_slug = serializers.CharField(source='tenant.slug', read_only=True)
    period_label = serializers.CharField(read_only=True)
    
    class Meta:
        model = TenantUsageSummary
        fields = [
            'id', 'tenant', 'tenant_name', 'tenant_slug',
            'period_start', 'period_end', 'period_label',
            'openai_requests', 'openai_tokens', 'openai_cost',
            'elevenlabs_requests', 'elevenlabs_characters', 'elevenlabs_cost',
            'smartflo_calls', 'smartflo_duration_minutes', 'smartflo_cost',
            'custom_requests', 'custom_cost',
            'total_requests', 'total_cost', 'last_updated'
        ]


class UsageQuotaSerializer(serializers.ModelSerializer):
    """Serializer for usage quotas"""
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    current_usage = serializers.SerializerMethodField()
    
    class Meta:
        model = UsageQuota
        fields = [
            'id', 'tenant', 'tenant_name',
            'openai_token_limit', 'elevenlabs_character_limit',
            'smartflo_minute_limit', 'monthly_cost_limit',
            'openai_rpm', 'elevenlabs_rpm', 'smartflo_rpm',
            'alert_at_percentage', 'alert_email',
            'is_suspended', 'suspension_reason',
            'current_usage', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_current_usage(self, obj):
        """Get current month usage for the tenant"""
        return UsageTracker.get_current_usage(obj.tenant)


class UsageAlertSerializer(serializers.ModelSerializer):
    """Serializer for usage alerts"""
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    alert_type_display = serializers.CharField(source='get_alert_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = UsageAlert
        fields = [
            'id', 'tenant', 'tenant_name', 'alert_type', 'alert_type_display',
            'service', 'message', 'current_value', 'threshold_value',
            'status', 'status_display', 'created_at', 'sent_at', 'acknowledged_at'
        ]


# ============================================================================
# ADMIN VIEWSETS (Staff only)
# ============================================================================

class UsageLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Admin endpoint for viewing all API usage logs.
    GET /api/admin/usage/logs/ - List all logs
    GET /api/admin/usage/logs/{id}/ - Get specific log
    """
    queryset = APIUsageLog.objects.all().select_related('tenant')
    serializer_class = APIUsageLogSerializer
    permission_classes = [IsAuthenticated]  # TODO: Add IsAdminUser
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by tenant
        tenant_id = self.request.query_params.get('tenant')
        if tenant_id:
            queryset = queryset.filter(tenant_id=tenant_id)
        
        # Filter by service
        service = self.request.query_params.get('service')
        if service:
            queryset = queryset.filter(service=service)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(request_timestamp__gte=start_date)
        if end_date:
            queryset = queryset.filter(request_timestamp__lte=end_date)
        
        return queryset


class UsageSummaryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Admin endpoint for viewing usage summaries.
    GET /api/admin/usage/summaries/ - List all summaries
    GET /api/admin/usage/summaries/{id}/ - Get specific summary
    """
    queryset = TenantUsageSummary.objects.all().select_related('tenant')
    serializer_class = TenantUsageSummarySerializer
    permission_classes = [IsAuthenticated]  # TODO: Add IsAdminUser
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by tenant
        tenant_id = self.request.query_params.get('tenant')
        if tenant_id:
            queryset = queryset.filter(tenant_id=tenant_id)
        
        # Filter by period
        period = self.request.query_params.get('period')  # YYYY-MM
        if period:
            year, month = period.split('-')
            period_start = date(int(year), int(month), 1)
            queryset = queryset.filter(period_start=period_start)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def current_month(self, request):
        """Get current month summaries for all tenants"""
        today = date.today()
        period_start = date(today.year, today.month, 1)
        
        summaries = TenantUsageSummary.objects.filter(
            period_start=period_start
        ).select_related('tenant')
        
        serializer = self.get_serializer(summaries, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def top_consumers(self, request):
        """Get top API consumers by cost"""
        today = date.today()
        period_start = date(today.year, today.month, 1)
        
        summaries = TenantUsageSummary.objects.filter(
            period_start=period_start
        ).select_related('tenant').order_by('-total_cost')[:10]
        
        serializer = self.get_serializer(summaries, many=True)
        return Response(serializer.data)


class UsageQuotaViewSet(viewsets.ModelViewSet):
    """
    Admin endpoint for managing usage quotas.
    GET /api/admin/usage/quotas/ - List all quotas
    POST /api/admin/usage/quotas/ - Create quota
    PATCH /api/admin/usage/quotas/{id}/ - Update quota
    DELETE /api/admin/usage/quotas/{id}/ - Delete quota
    """
    queryset = UsageQuota.objects.all().select_related('tenant')
    serializer_class = UsageQuotaSerializer
    permission_classes = [IsAuthenticated]  # TODO: Add IsAdminUser


class UsageAlertViewSet(viewsets.ModelViewSet):
    """
    Admin endpoint for viewing and managing usage alerts.
    """
    queryset = UsageAlert.objects.all().select_related('tenant')
    serializer_class = UsageAlertSerializer
    permission_classes = [IsAuthenticated]  # TODO: Add IsAdminUser
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by status
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
        
        # Filter by tenant
        tenant_id = self.request.query_params.get('tenant')
        if tenant_id:
            queryset = queryset.filter(tenant_id=tenant_id)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Mark alert as acknowledged"""
        alert = self.get_object()
        alert.status = 'acknowledged'
        alert.acknowledged_at = timezone.now()
        alert.save()
        
        serializer = self.get_serializer(alert)
        return Response(serializer.data)


# ============================================================================
# TENANT ENDPOINTS (Tenant-scoped)
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_usage_dashboard(request):
    """
    Get usage dashboard data for the current tenant.
    GET /api/tenant/usage/dashboard/
    """
    # Get user's tenant
    if not hasattr(request.user, 'profile') or not request.user.profile.tenant:
        return Response(
            {'error': 'User is not associated with any tenant'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    tenant = request.user.profile.tenant
    
    # Get current month usage
    today = date.today()
    period_start = date(today.year, today.month, 1)
    
    try:
        current_summary = TenantUsageSummary.objects.get(
            tenant=tenant,
            period_start=period_start
        )
    except TenantUsageSummary.DoesNotExist:
        current_summary = None
    
    # Get quota if exists
    try:
        quota = UsageQuota.objects.get(tenant=tenant)
        quota_data = UsageQuotaSerializer(quota).data
    except UsageQuota.DoesNotExist:
        quota_data = None
    
    # Get pending alerts
    pending_alerts = UsageAlert.objects.filter(
        tenant=tenant,
        status__in=['pending', 'sent']
    ).order_by('-created_at')[:5]
    
    # Get last 7 days usage
    seven_days_ago = timezone.now() - timedelta(days=7)
    recent_logs = APIUsageLog.objects.filter(
        tenant=tenant,
        request_timestamp__gte=seven_days_ago
    ).values('service').annotate(
        count=Count('id'),
        total_cost=Sum('estimated_cost')
    )
    
    return Response({
        'current_month': TenantUsageSummarySerializer(current_summary).data if current_summary else None,
        'quota': quota_data,
        'alerts': UsageAlertSerializer(pending_alerts, many=True).data,
        'recent_usage': list(recent_logs),
        'period_start': period_start,
        'period_end': date(today.year, today.month + 1, 1) if today.month < 12 else date(today.year + 1, 1, 1)
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_usage_history(request):
    """
    Get historical usage for the current tenant.
    GET /api/tenant/usage/history/?months=6
    """
    # Get user's tenant
    if not hasattr(request.user, 'profile') or not request.user.profile.tenant:
        return Response(
            {'error': 'User is not associated with any tenant'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    tenant = request.user.profile.tenant
    months = int(request.query_params.get('months', 6))
    
    # Get last N months
    summaries = TenantUsageSummary.objects.filter(
        tenant=tenant
    ).order_by('-period_start')[:months]
    
    serializer = TenantUsageSummarySerializer(summaries, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_usage_logs(request):
    """
    Get recent usage logs for the current tenant.
    GET /api/tenant/usage/logs/?limit=100&service=openai
    """
    # Get user's tenant
    if not hasattr(request.user, 'profile') or not request.user.profile.tenant:
        return Response(
            {'error': 'User is not associated with any tenant'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    tenant = request.user.profile.tenant
    limit = int(request.query_params.get('limit', 100))
    service = request.query_params.get('service')
    
    logs = APIUsageLog.objects.filter(tenant=tenant)
    
    if service:
        logs = logs.filter(service=service)
    
    logs = logs.order_by('-request_timestamp')[:limit]
    
    serializer = APIUsageLogSerializer(logs, many=True)
    return Response(serializer.data)
