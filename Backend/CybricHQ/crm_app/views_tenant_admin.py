"""
ViewSets for tenant management (admin functionality).
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from django.utils.text import slugify

from crm_app.models import Tenant, TenantSettings
from crm_app.serializers_tenant import TenantSerializer, TenantSettingsSerializer
from billing.models import Product, Plan, Subscription
from billing.serializers import PlanSerializer


class TenantAdminSerializer:
    """Extended serializer for admin tenant management"""
    pass


from rest_framework import serializers

class TenantListSerializer(serializers.ModelSerializer):
    """Tenant list with summary info"""
    member_count = serializers.SerializerMethodField()
    subscription_count = serializers.SerializerMethodField()
    products = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'slug', 'is_active', 'created_at', 
                  'member_count', 'subscription_count', 'products', 'company_name']
    
    def get_member_count(self, obj):
        return obj.members.count()
    
    def get_subscription_count(self, obj):
        return obj.subscriptions.filter(status__in=['active', 'trialing']).count()
    
    def get_products(self, obj):
        from crm_app.feature_access import get_tenant_products
        return get_tenant_products(obj)
    
    def get_company_name(self, obj):
        try:
            return obj.settings.company_name
        except TenantSettings.DoesNotExist:
            return obj.name


class TenantDetailSerializer(serializers.ModelSerializer):
    """Full tenant details with settings"""
    settings = TenantSettingsSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()
    subscriptions = serializers.SerializerMethodField()
    available_features = serializers.SerializerMethodField()
    
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'slug', 'is_active', 'created_at', 'updated_at',
                  'settings', 'member_count', 'subscriptions', 'available_features']
    
    def get_member_count(self, obj):
        return obj.members.count()
    
    def get_subscriptions(self, obj):
        subs = obj.subscriptions.filter(status__in=['active', 'trialing', 'past_due'])
        return [{
            'id': str(sub.id),
            'product_name': sub.plan.product.name,
            'product_code': sub.plan.product.code,
            'plan_name': sub.plan.name,
            'status': sub.status,
            'current_period_end': sub.current_period_end,
        } for sub in subs.select_related('plan__product')]
    
    def get_available_features(self, obj):
        from crm_app.feature_access import get_tenant_features
        return get_tenant_features(obj)


class TenantCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating tenants with admin user"""
    company_name = serializers.CharField(write_only=True, required=False)
    primary_color = serializers.CharField(write_only=True, required=False, default='#6366f1')
    custom_domain = serializers.CharField(write_only=True, required=False, allow_blank=True)
    admin_email = serializers.EmailField(write_only=True, required=True)
    admin_first_name = serializers.CharField(write_only=True, required=False, default='Admin')
    admin_last_name = serializers.CharField(write_only=True, required=False, default='')
    slug = serializers.SlugField(required=False)
    
    # Output fields - shown once after creation
    generated_password = serializers.CharField(read_only=True)
    generated_username = serializers.CharField(read_only=True)
    
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'slug', 'is_active', 'company_name', 'primary_color', 
                  'custom_domain', 'admin_email', 'admin_first_name', 'admin_last_name',
                  'generated_password', 'generated_username']
        read_only_fields = ['id', 'generated_password', 'generated_username']
    
    def create(self, validated_data):
        import secrets
        import string
        from django.contrib.auth import get_user_model
        from crm_app.models import UserProfile, Role
        
        User = get_user_model()
        
        # Extract fields
        company_name = validated_data.pop('company_name', None)
        primary_color = validated_data.pop('primary_color', '#6366f1')
        custom_domain = validated_data.pop('custom_domain', '')
        admin_email = validated_data.pop('admin_email')
        admin_first_name = validated_data.pop('admin_first_name', 'Admin')
        admin_last_name = validated_data.pop('admin_last_name', '')
        
        # Auto-generate slug if not provided
        if not validated_data.get('slug'):
            validated_data['slug'] = slugify(validated_data['name'])
        
        # Create tenant
        tenant = super().create(validated_data)
        
        # Create settings with branding
        TenantSettings.objects.create(
            tenant=tenant,
            company_name=company_name or tenant.name,
            primary_color=primary_color,
            custom_domain=custom_domain if custom_domain else None
        )
        
        # Generate secure password (12 chars with letters, digits, symbols)
        alphabet = string.ascii_letters + string.digits + "!@#$%"
        generated_password = ''.join(secrets.choice(alphabet) for _ in range(12))
        
        # Create admin user
        username = admin_email.split('@')[0] + '_' + tenant.slug[:8]
        user = User.objects.create_user(
            username=username,
            email=admin_email,
            password=generated_password,
            first_name=admin_first_name,
            last_name=admin_last_name
        )
        
        # Get or create admin role
        admin_role, _ = Role.objects.get_or_create(
            name='Tenant Admin',
            defaults={
                'description': 'Administrator for a tenant organization',
                'is_system_role': True,
                'permissions': {
                    'users': {'create': True, 'read': True, 'update': True, 'delete': True},
                    'leads': {'create': True, 'read': True, 'update': True, 'delete': True},
                    'applicants': {'create': True, 'read': True, 'update': True, 'delete': True},
                    'applications': {'create': True, 'read': True, 'update': True, 'delete': True},
                    'settings': {'read': True, 'update': True},
                }
            }
        )
        
        # Create user profile linked to tenant
        UserProfile.objects.create(
            user=user,
            tenant=tenant,
            role=admin_role,
            is_tenant_admin=True
        )
        
        # Store credentials in instance for response (not saved to DB)
        tenant.generated_password = generated_password
        tenant.generated_username = username
        tenant.admin_email = admin_email
        
        return tenant


class ProductSerializer(serializers.ModelSerializer):
    """Product serializer for full CRUD operations"""
    plans = serializers.SerializerMethodField(read_only=True)
    features = serializers.JSONField(source='feature_flags', required=False)
    is_active = serializers.BooleanField(source='active', required=False, default=True)
    
    class Meta:
        model = Product
        fields = ['id', 'code', 'name', 'description', 'active', 'is_active', 'features', 'feature_flags', 'plans']
        read_only_fields = ['id', 'plans']
        extra_kwargs = {
            'code': {'required': True},
            'name': {'required': True},
            'description': {'required': False, 'default': ''},
            'active': {'required': False, 'default': True},
            'feature_flags': {'required': False, 'default': dict},
        }
    
    def get_plans(self, obj):
        return [{
            'id': str(plan.id),
            'name': plan.name,
            'price': plan.price_cents / 100,
            'currency': plan.currency,
            'interval': plan.interval,
        } for plan in obj.plans.filter(active=True)]


class TenantViewSet(viewsets.ModelViewSet):
    """Admin viewset for managing tenants"""
    queryset = Tenant.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated]  # TODO: Add IsAdminUser for production
    
    def get_serializer_class(self):
        if self.action == 'list':
            return TenantListSerializer
        elif self.action == 'create':
            return TenantCreateSerializer
        return TenantDetailSerializer
    
    @action(detail=True, methods=['patch'], url_path='update-settings', parser_classes=[MultiPartParser, FormParser, JSONParser])
    def update_settings(self, request, pk=None):
        """
        Update tenant branding settings (including logo/favicon uploads).
        Accepts multipart/form-data for file uploads or JSON for text fields.
        """
        tenant = self.get_object()
        
        try:
            settings_obj = tenant.settings
        except TenantSettings.DoesNotExist:
            settings_obj = TenantSettings.objects.create(
                tenant=tenant,
                company_name=tenant.name
            )
        
        # Handle file uploads + text fields
        serializer = TenantSettingsSerializer(
            settings_obj, 
            data=request.data, 
            partial=True,
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def add_subscription(self, request, pk=None):
        """Add a subscription to a tenant"""
        tenant = self.get_object()
        plan_id = request.data.get('plan_id')
        
        if not plan_id:
            return Response({'error': 'plan_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            plan = Plan.objects.get(id=plan_id)
        except Plan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if already subscribed to this product
        existing = Subscription.objects.filter(
            tenant=tenant,
            plan__product=plan.product,
            status__in=['active', 'trialing']
        ).first()
        
        if existing:
            return Response({
                'error': f'Tenant already has an active subscription to {plan.product.name}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create subscription
        from django.utils import timezone
        from dateutil.relativedelta import relativedelta
        
        now = timezone.now()
        subscription = Subscription.objects.create(
            tenant=tenant,
            plan=plan,
            status='active',
            start_date=now,
            current_period_start=now,
            current_period_end=now + relativedelta(months=1),
        )
        
        return Response({
            'message': f'Subscription to {plan.product.name} created',
            'subscription_id': str(subscription.id)
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def remove_subscription(self, request, pk=None):
        """Cancel a subscription"""
        tenant = self.get_object()
        subscription_id = request.data.get('subscription_id')
        
        if not subscription_id:
            return Response({'error': 'subscription_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            subscription = Subscription.objects.get(id=subscription_id, tenant=tenant)
            subscription.status = 'canceled'
            subscription.save()
            return Response({'message': 'Subscription canceled'})
        except Subscription.DoesNotExist:
            return Response({'error': 'Subscription not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['get'], url_path='dashboard_stats')
    def dashboard_stats(self, request):
        """
        Return dashboard statistics for admin overview.
        Returns total tenants, new tenants in last 30 days, active subscriptions, and MRR.
        """
        from datetime import timedelta
        from django.utils import timezone
        from django.db.models import Sum, Count
        
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)
        
        # Total tenants
        total_tenants = Tenant.objects.count()
        
        # New tenants in last 30 days
        new_tenants_30d = Tenant.objects.filter(created_at__gte=thirty_days_ago).count()
        
        # Active subscriptions
        active_subscriptions = Subscription.objects.filter(
            status__in=['active', 'trialing']
        ).count()
        
        # MRR calculation (sum of all active monthly recurring revenue)
        active_subs = Subscription.objects.filter(status__in=['active', 'trialing'])
        mrr = 0
        for sub in active_subs:
            if sub.plan:
                # Convert to monthly amount based on billing period
                if sub.plan.billing_period == 'monthly':
                    mrr += float(sub.plan.price)
                elif sub.plan.billing_period == 'yearly':
                    mrr += float(sub.plan.price) / 12
        
        # System status (simple check - can be expanded)
        system_status = 'Operational'
        if total_tenants == 0:
            system_status = 'No Tenants'
        
        return Response({
            'total_tenants': total_tenants,
            'new_tenants_30d': new_tenants_30d,
            'active_subscriptions': active_subscriptions,
            'mrr': round(mrr, 2),
            'system_status': system_status,
        })


class ProductViewSet(viewsets.ModelViewSet):
    """Full CRUD viewset for products (for subscription/billing management)"""
    queryset = Product.objects.all().order_by('name')
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]  # TODO: Add IsAdminUser for production
    
    def get_queryset(self):
        """Return all products for admin, optionally filter by active status"""
        qs = Product.objects.all().order_by('name')
        active_only = self.request.query_params.get('active', None)
        if active_only and active_only.lower() == 'true':
            qs = qs.filter(active=True)
        return qs
    
    @action(detail=True, methods=['post'], url_path='plans')
    def create_plan(self, request, pk=None):
        """Create a new plan for this product"""
        product = self.get_object()
        
        # Simple validation for plan creation
        name = request.data.get('name')
        price_cents = request.data.get('price_cents', 0)
        interval = request.data.get('interval', 'month')
        currency = request.data.get('currency', 'USD')
        active = request.data.get('active', True)
        
        if not name:
            return Response({'error': 'Plan name is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            price_cents = int(price_cents)
        except (ValueError, TypeError):
            return Response({'error': 'Invalid price'}, status=status.HTTP_400_BAD_REQUEST)
        
        plan = Plan.objects.create(
            product=product,
            name=name,
            price_cents=price_cents,
            interval=interval,
            currency=currency,
            active=active,
        )
        
        return Response({
            'id': str(plan.id),
            'name': plan.name,
            'price': plan.price_cents / 100,
            'currency': plan.currency,
            'interval': plan.interval,
            'active': plan.active,
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['delete'], url_path='plans/(?P<plan_id>[^/.]+)')
    def delete_plan(self, request, pk=None, plan_id=None):
        """Delete a plan from this product"""
        product = self.get_object()
        
        try:
            plan = Plan.objects.get(id=plan_id, product=product)
            plan.delete()
            return Response({'message': 'Plan deleted'}, status=status.HTTP_204_NO_CONTENT)
        except Plan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)

