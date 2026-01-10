# billing/admin_views.py
"""
Admin-only views for system stats and tenant usage.
"""
import logging
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from django.db.models import Sum, Count, Avg, Q
from django.contrib.auth import get_user_model

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser

from .models import Subscription, Invoice
from .usage_models import UsageLog, TokenUsage, StorageUsage

User = get_user_model()
logger = logging.getLogger(__name__)


class SystemStatsView(APIView):
    """
    Get system-wide statistics for admin dashboard.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request):
        now = timezone.now()
        today = now.date()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # User stats
        total_users = User.objects.count()
        active_today = User.objects.filter(last_login__date=today).count()
        
        # Get counts from crm_app models
        try:
            from crm_app.models import Lead, CallRecord, Applicant, Application
            total_leads = Lead.objects.count()
            total_calls = CallRecord.objects.count()
            total_applicants = Applicant.objects.count()
            total_applications = Application.objects.count()
        except ImportError:
            total_leads = 0
            total_calls = 0
            total_applicants = 0
            total_applications = 0
        
        # API usage
        api_requests_today = UsageLog.objects.filter(created_at__date=today).count()
        api_requests_month = UsageLog.objects.filter(created_at__gte=month_start).count()
        
        avg_response = UsageLog.objects.filter(
            created_at__date=today
        ).aggregate(avg=Avg('response_time_ms'))['avg'] or 0
        
        error_count = UsageLog.objects.filter(
            created_at__date=today,
            status_code__gte=400
        ).count()
        
        error_rate = (error_count / api_requests_today * 100) if api_requests_today > 0 else 0
        
        # Token usage
        token_stats = TokenUsage.objects.filter(
            created_at__gte=month_start
        ).aggregate(
            total_tokens=Sum('total_tokens'),
            total_cost=Sum('cost_cents')
        )
        
        # Storage
        total_storage = StorageUsage.objects.filter(
            deleted_at__isnull=True
        ).aggregate(total=Sum('size_bytes'))['total'] or 0
        
        # Subscription stats
        active_subs = Subscription.objects.filter(status__in=['active', 'trialing']).count()
        
        # This month's revenue
        month_revenue = Invoice.objects.filter(
            status='paid',
            paid_at__gte=month_start
        ).aggregate(total=Sum('total_cents'))['total'] or 0
        
        return Response({
            # Users
            'total_users': total_users,
            'active_users_today': active_today,
            
            # CRM stats
            'total_leads': total_leads,
            'total_calls': total_calls,
            'total_applicants': total_applicants,
            'total_applications': total_applications,
            
            # API usage
            'api_requests_today': api_requests_today,
            'api_requests_month': api_requests_month,
            'avg_response_time_ms': round(avg_response, 1),
            'error_rate': round(error_rate, 2),
            
            # Tokens
            'total_tokens_month': token_stats['total_tokens'] or 0,
            'token_cost_cents': token_stats['total_cost'] or 0,
            
            # Storage
            'total_storage_bytes': total_storage,
            'total_storage_mb': round(total_storage / (1024 * 1024), 2),
            
            # Billing
            'active_subscriptions': active_subs,
            'month_revenue': float(Decimal(month_revenue) / 100),
        })


class TenantUsageView(APIView):
    """
    Get per-user usage statistics for admin dashboard.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request):
        days = int(request.query_params.get('days', 30))
        limit = int(request.query_params.get('limit', 50))
        
        since = timezone.now() - timedelta(days=days)
        
        # Get all users with their usage
        users = User.objects.all()[:limit]
        
        # Pre-fetch counts
        try:
            from crm_app.models import Lead, CallRecord, Application
            
            # Get per-user counts
            lead_counts = dict(Lead.objects.values('created_by').annotate(count=Count('id')).values_list('created_by', 'count'))
            call_counts = dict(CallRecord.objects.values('created_by').annotate(count=Count('id')).values_list('created_by', 'count'))
            app_counts = dict(Application.objects.values('created_by').annotate(count=Count('id')).values_list('created_by', 'count'))
        except:
            lead_counts = {}
            call_counts = {}
            app_counts = {}
        
        # API request counts per user
        api_counts = dict(
            UsageLog.objects.filter(created_at__gte=since)
            .values('user').annotate(count=Count('id'))
            .values_list('user', 'count')
        )
        
        # Token usage per user
        token_usage = dict(
            TokenUsage.objects.filter(created_at__gte=since)
            .values('user').annotate(
                tokens=Sum('total_tokens'),
                cost=Sum('cost_cents')
            ).values_list('user', 'tokens', 'cost')
        )
        
        # Storage per user
        storage_usage = dict(
            StorageUsage.objects.filter(deleted_at__isnull=True)
            .values('user').annotate(total=Sum('size_bytes'))
            .values_list('user', 'total')
        )
        
        # Get subscription status per user
        sub_status = {}
        for sub in Subscription.objects.filter(status__in=['active', 'trialing']).select_related('plan'):
            sub_status[sub.user_id] = {
                'status': sub.status,
                'plan': sub.plan.name if sub.plan else 'Unknown',
                'monthly_cost': sub.plan.price_cents / 100 if sub.plan else 0
            }
        
        result = []
        for user in users:
            user_tokens = token_usage.get(user.id, (0, 0))
            if isinstance(user_tokens, tuple):
                tokens, cost = user_tokens
            else:
                tokens = user_tokens or 0
                cost = 0
            
            sub_info = sub_status.get(user.id, {'status': 'free', 'plan': 'Free', 'monthly_cost': 0})
            
            result.append({
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'role': getattr(user, 'role', 'user'),
                'is_active': user.is_active,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                
                # Activity counts
                'leads_count': lead_counts.get(user.id, 0),
                'calls_count': call_counts.get(user.id, 0),
                'applications_count': app_counts.get(user.id, 0),
                
                # Usage
                'api_requests': api_counts.get(user.id, 0),
                'ai_tokens_used': tokens or 0,
                'token_cost_cents': cost or 0,
                'storage_bytes': storage_usage.get(user.id, 0) or 0,
                'storage_mb': round((storage_usage.get(user.id, 0) or 0) / (1024 * 1024), 2),
                
                # Subscription
                'subscription_status': sub_info['status'],
                'plan_name': sub_info['plan'],
                'monthly_cost': sub_info['monthly_cost'],
            })
        
        # Sort by activity (tokens + api requests)
        result.sort(key=lambda x: x['ai_tokens_used'] + x['api_requests'], reverse=True)
        
        return Response({
            'period_days': days,
            'tenants': result,
            'total_count': User.objects.count()
        })


class TokenUsageStatsView(APIView):
    """
    Get detailed token usage statistics.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request):
        days = int(request.query_params.get('days', 30))
        since = timezone.now() - timedelta(days=days)
        month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Total token usage
        total = TokenUsage.objects.aggregate(
            tokens=Sum('total_tokens'),
            cost=Sum('cost_cents')
        )
        
        # This month
        month = TokenUsage.objects.filter(created_at__gte=month_start).aggregate(
            tokens=Sum('total_tokens'),
            cost=Sum('cost_cents')
        )
        
        # By model
        by_model = list(
            TokenUsage.objects.filter(created_at__gte=since)
            .values('model')
            .annotate(
                tokens=Sum('total_tokens'),
                cost=Sum('cost_cents'),
                count=Count('id')
            )
            .order_by('-tokens')
        )
        
        # By feature
        by_feature = list(
            TokenUsage.objects.filter(created_at__gte=since)
            .exclude(feature='')
            .values('feature')
            .annotate(
                tokens=Sum('total_tokens'),
                cost=Sum('cost_cents'),
                count=Count('id')
            )
            .order_by('-tokens')
        )
        
        return Response({
            'total_tokens': total['tokens'] or 0,
            'total_cost_cents': total['cost'] or 0,
            'month_tokens': month['tokens'] or 0,
            'month_cost_cents': month['cost'] or 0,
            'by_model': by_model,
            'by_feature': by_feature,
        })
