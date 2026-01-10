# billing/serializers.py
"""
DRF Serializers for billing models.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Product, Plan, Subscription, Purchase, 
    Invoice, PaymentLog, AuditLog, WebhookEvent
)

User = get_user_model()


class ProductSerializer(serializers.ModelSerializer):
    plans_count = serializers.SerializerMethodField()
    code = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = Product
        fields = [
            'id', 'code', 'name', 'description', 'active',
            'stripe_product_id', 'plans_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_plans_count(self, obj):
        return obj.plans.filter(active=True).count()
    
    def create(self, validated_data):
        # Auto-generate code from name if not provided
        if not validated_data.get('code'):
            import re
            # Convert name to uppercase snake_case code
            name = validated_data.get('name', 'product')
            code = re.sub(r'[^a-zA-Z0-9]+', '_', name).upper().strip('_')
            # Ensure uniqueness by appending a number if needed
            base_code = code
            counter = 1
            while Product.objects.filter(code=code).exists():
                code = f"{base_code}_{counter}"
                counter += 1
            validated_data['code'] = code
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Don't update code during updates (keep original)
        validated_data.pop('code', None)
        return super().update(instance, validated_data)


class PlanSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    formatted_price = serializers.CharField(read_only=True)
    price_decimal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = Plan
        fields = [
            'id', 'product', 'product_name', 'name', 
            'price_cents', 'price_decimal', 'formatted_price', 'currency',
            'interval', 'interval_count', 'trial_days',
            'stripe_price_id', 'active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PlanListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listings."""
    product_name = serializers.CharField(source='product.name', read_only=True)
    formatted_price = serializers.CharField(read_only=True)
    
    class Meta:
        model = Plan
        fields = ['id', 'name', 'product_name', 'formatted_price', 'active']


class SubscriptionSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    product_name = serializers.CharField(source='plan.product.name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Subscription
        fields = [
            'id', 'user', 'user_email', 'plan', 'plan_name', 'product_name',
            'status', 'status_display',
            'start_date', 'current_period_start', 'current_period_end',
            'trial_start', 'trial_end',
            'cancel_at_period_end', 'canceled_at', 'ended_at',
            'stripe_subscription_id', 'stripe_customer_id',
            'metadata', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 
            'stripe_subscription_id', 'stripe_customer_id'
        ]


class SubscriptionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating subscriptions."""
    
    class Meta:
        model = Subscription
        fields = ['user', 'plan', 'metadata']
    
    def create(self, validated_data):
        from django.utils import timezone
        from dateutil.relativedelta import relativedelta
        
        plan = validated_data['plan']
        now = timezone.now()
        
        # Calculate trial period
        trial_start = None
        trial_end = None
        status = 'active'
        
        if plan.trial_days > 0:
            trial_start = now
            trial_end = now + relativedelta(days=plan.trial_days)
            status = 'trialing'
        
        # Calculate billing period
        period_start = now
        period_end = self._calculate_period_end(plan, period_start)
        
        subscription = Subscription.objects.create(
            user=validated_data['user'],
            plan=plan,
            status=status,
            start_date=now,
            current_period_start=period_start,
            current_period_end=period_end,
            trial_start=trial_start,
            trial_end=trial_end,
            metadata=validated_data.get('metadata', {})
        )
        
        return subscription
    
    def _calculate_period_end(self, plan, start):
        from dateutil.relativedelta import relativedelta
        
        delta_map = {
            'day': relativedelta(days=plan.interval_count),
            'week': relativedelta(weeks=plan.interval_count),
            'month': relativedelta(months=plan.interval_count),
            'year': relativedelta(years=plan.interval_count),
        }
        return start + delta_map.get(plan.interval, relativedelta(months=1))


class PurchaseSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = Purchase
        fields = [
            'id', 'user', 'user_email', 'product', 'product_name',
            'amount_cents', 'currency', 'payment_id', 'payment_method',
            'paid', 'paid_at', 'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'paid_at']


class InvoiceSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    subscription_plan = serializers.CharField(source='subscription.plan.name', read_only=True, allow_null=True)
    total_formatted = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_no', 'user', 'user_email',
            'subscription', 'subscription_plan', 'purchase',
            'subtotal_cents', 'tax_cents', 'total_cents', 'total_formatted', 'currency',
            'status', 'status_display',
            'issued_at', 'due_at', 'paid_at',
            'period_start', 'period_end',
            'pdf', 'pdf_url', 'stripe_invoice_id',
            'payment_method', 'metadata', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'invoice_no', 'created_at', 'updated_at', 
            'pdf', 'stripe_invoice_id'
        ]
    
    def get_total_formatted(self, obj):
        return f"{obj.currency} {obj.total_cents / 100:.2f}"
    
    def get_pdf_url(self, obj):
        if obj.pdf:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.pdf.url)
            return obj.pdf.url
        return None


class InvoiceCreateSerializer(serializers.Serializer):
    """Serializer for creating invoices from subscriptions."""
    subscription_id = serializers.UUIDField()
    
    def validate_subscription_id(self, value):
        try:
            subscription = Subscription.objects.get(id=value)
        except Subscription.DoesNotExist:
            raise serializers.ValidationError("Subscription not found")
        return subscription


class PaymentLogSerializer(serializers.ModelSerializer):
    invoice_no = serializers.CharField(source='invoice.invoice_no', read_only=True)
    
    class Meta:
        model = PaymentLog
        fields = [
            'id', 'invoice', 'invoice_no', 'gateway', 'gateway_payment_id',
            'amount_cents', 'currency', 'status', 'error_message',
            'received_at', 'created_at'
        ]
        # Exclude raw_response from default serialization for security
        read_only_fields = ['id', 'created_at']


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            'id', 'actor', 'actor_email', 'action',
            'target_type', 'target_id', 'changes', 'description',
            'ip_address', 'created_at'
        ]
        read_only_fields = fields  # Audit logs are read-only


class WebhookEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookEvent
        fields = [
            'id', 'source', 'event_id', 'event_type',
            'processed', 'processed_at', 'error', 'received_at'
        ]
        # Exclude payload from default serialization for security
        read_only_fields = fields


# ====== Reporting Serializers ======

class MRRReportSerializer(serializers.Serializer):
    """Monthly Recurring Revenue report."""
    period = serializers.CharField()
    mrr = serializers.DecimalField(max_digits=12, decimal_places=2)
    arr = serializers.DecimalField(max_digits=12, decimal_places=2)
    active_subscriptions = serializers.IntegerField()
    new_subscriptions = serializers.IntegerField()
    churned_subscriptions = serializers.IntegerField()
    net_mrr_change = serializers.DecimalField(max_digits=12, decimal_places=2)


class RevenueByProductSerializer(serializers.Serializer):
    """Revenue breakdown by product."""
    product_id = serializers.UUIDField()
    product_name = serializers.CharField()
    revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    invoices_count = serializers.IntegerField()
    percentage = serializers.DecimalField(max_digits=5, decimal_places=2)


class ChurnReportSerializer(serializers.Serializer):
    """Churn metrics."""
    period = serializers.CharField()
    churned_count = serializers.IntegerField()
    total_at_start = serializers.IntegerField()
    churn_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    churned_mrr = serializers.DecimalField(max_digits=12, decimal_places=2)
