"""
ViewSets for tenant management (admin functionality).
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from django.utils.text import slugify

from crm_app.models import Tenant, TenantSettings
from crm_app.serializers_tenant import TenantSerializer, TenantSettingsSerializer
from billing.models import Product, Plan, Subscription


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
    primary_color = serializers.SerializerMethodField()
    custom_domain = serializers.SerializerMethodField()
    phone_numbers = serializers.SerializerMethodField()
    
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'slug', 'is_active', 'created_at', 
                  'member_count', 'subscription_count', 'products', 'company_name', 'phone_numbers',
                  'primary_color', 'custom_domain']
    
    def get_phone_numbers(self, obj):
        return list(obj.phone_numbers.values_list('number', flat=True))
    
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
            
    def get_primary_color(self, obj):
        try:
            return obj.settings.primary_color
        except TenantSettings.DoesNotExist:
            return '#6366f1'

    def get_custom_domain(self, obj):
        try:
            return obj.settings.custom_domain
        except TenantSettings.DoesNotExist:
            return ''


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
    # API Keys & Numbers (Write Only)
    openai_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    elevenlabs_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    smartflo_numbers = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        help_text="List of Smartflo numbers to assign"
    )

    # White Labeling Fields (Write Only for Creation)
    company_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    primary_color = serializers.CharField(write_only=True, required=False, allow_blank=True)
    custom_domain = serializers.CharField(write_only=True, required=False, allow_blank=True)

    # Admin User Fields (Write Only)
    admin_email = serializers.EmailField(write_only=True, required=True)
    admin_first_name = serializers.CharField(write_only=True, required=False, default='Admin')
    admin_last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    # Generated Credentials (Read Only)
    generated_password = serializers.CharField(read_only=True)
    generated_username = serializers.CharField(read_only=True)

    class Meta:
        model = Tenant
        fields = ['id', 'name', 'slug', 'is_active', 'company_name', 'primary_color', 
                  'custom_domain', 'admin_email', 'admin_first_name', 'admin_last_name',
                  'generated_password', 'generated_username',
                  'openai_key', 'elevenlabs_key', 'smartflo_numbers']
        read_only_fields = ['id', 'generated_password', 'generated_username']
    
    def create(self, validated_data):
        import secrets
        import string
        from django.contrib.auth import get_user_model
        from crm_app.models import UserProfile, Role, TelephonyConfig, PhoneNumber, VoiceAgent
        
        User = get_user_model()
        
        # Extract fields
        company_name = validated_data.pop('company_name', None)
        primary_color = validated_data.pop('primary_color', '#6366f1')
        custom_domain = validated_data.pop('custom_domain', '')
        admin_email = validated_data.pop('admin_email')
        admin_first_name = validated_data.pop('admin_first_name', 'Admin')
        admin_last_name = validated_data.pop('admin_last_name', '')
        
        # Extract Keys & Numbers
        openai_key = validated_data.pop('openai_key', '')
        elevenlabs_key = validated_data.pop('elevenlabs_key', '')
        smartflo_numbers = validated_data.pop('smartflo_numbers', [])
        
        # Auto-generate slug if not provided
        if not validated_data.get('slug'):
            validated_data['slug'] = slugify(validated_data['name'])
        
        try:
            # Create tenant
            tenant = super().create(validated_data)
            
            # Create settings with branding
            TenantSettings.objects.create(
                tenant=tenant,
                company_name=company_name or tenant.name,
                primary_color=primary_color,
                custom_domain=custom_domain if custom_domain else None
            )

            # Store OpenAI Key
            if openai_key:
                openai_config, _ = TelephonyConfig.objects.get_or_create(
                    tenant=tenant,
                    provider='openai'
                )
                openai_config.set_api_key(openai_key)
                openai_config.save()
                
            # Store ElevenLabs Key
            if elevenlabs_key:
                el_config, _ = TelephonyConfig.objects.get_or_create(
                    tenant=tenant,
                    provider='elevenlabs'
                )
                el_config.set_api_key(elevenlabs_key)
                el_config.save()
            
            # Assign Phone Numbers
            if smartflo_numbers:
                # Create default inbound agent for routing if needed, or leave null
                # For now just assign numbers to tenant
                for number in smartflo_numbers:
                    # Check if number exists and is free, or create new
                    ph_obj, created = PhoneNumber.objects.get_or_create(
                        number=number,
                        defaults={
                            'provider': 'smartflo',
                            'tenant': tenant,
                            'description': 'Assigned during creation'
                        }
                    )
                    if not created:
                        # Reassign if it was system owned or updating
                        ph_obj.tenant = tenant
                        ph_obj.save()
            
            # ============================================================
            # DATABASE SCHEMA PROVISIONING
            # ============================================================
            from django.db import connection
            from django.conf import settings as django_settings
            
            db_engine = django_settings.DATABASES['default']['ENGINE']
            schema_name = f"tenant_{tenant.slug.replace('-', '_')}"
            
            with connection.cursor() as cursor:
                if 'postgresql' in db_engine:
                    # PostgreSQL: Create schema
                    # Check if schema exists
                    cursor.execute(
                        "SELECT schema_name FROM information_schema.schemata WHERE schema_name = %s",
                        [schema_name]
                    )
                    if cursor.fetchone():
                        raise serializers.ValidationError(f"Database schema '{schema_name}' already exists for this tenant.")
                    
                    cursor.execute(f'CREATE SCHEMA "{schema_name}"')
                    tenant.database_schema = schema_name
                    tenant.save(update_fields=['database_schema'] if hasattr(tenant, 'database_schema') else [])
                    
                    # Run migrations in the new schema to create isolated tables
                    from django.core.management import call_command
                    cursor.execute(f'SET search_path TO "{schema_name}"')
                    call_command('migrate', interactive=False, verbosity=0)
                    
                    # COPY TENANT RECORD TO SCHEMA so FKs work
                    # Since we are in the tenant schema search_path, this write goes to the tenant's Tenant table
                    Tenant.objects.create(
                        id=tenant.id,
                        name=tenant.name,
                        slug=tenant.slug,
                        is_active=tenant.is_active,
                        database_schema=tenant.database_schema,
                        # created_at/updated_at will be set to now, which is fine for the copy
                    )
 
                    # NOTE: We stay in the schema search_path so subsequent User/Role creation happens inside the schema
                    
                elif 'sqlite' in db_engine:
                    # SQLite: For dev, we can note this but can't create separate DBs easily
                    # Just log and continue (SQLite doesn't support schemas)
                    import logging
                    logging.info(f"[DEV] Tenant '{tenant.slug}' created. SQLite doesn't support schemas.")
            
            # ============================================================
            # IMPORTANT: Reset search_path to public BEFORE creating the admin user
            # This ensures the User record is stored in the PUBLIC schema where
            # Django's authenticate() will look for it during login.
            # ============================================================
            with connection.cursor() as cursor:
                if 'postgresql' in db_engine:
                    cursor.execute('SET search_path TO "public"')
            
            # Generate secure password (12 chars with letters, digits, symbols)
            alphabet = string.ascii_letters + string.digits + "!@#$%"
            generated_password = ''.join(secrets.choice(alphabet) for _ in range(12))
            
            # Create admin user
            username = admin_email.split('@')[0] + '_' + tenant.slug[:8]
            
            # Check if username exists, append random if so
            if User.objects.filter(username=username).exists():
                username = f"{username}_{secrets.token_hex(2)}"

            user = User.objects.create_user(
                username=username,
                email=admin_email,
                password=generated_password,
                first_name=admin_first_name,
                last_name=admin_last_name
            )
            
            # Get or create admin role
            admin_role, _ = Role.objects.get_or_create(
                name='Admin',
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
            
            # Store credentials in instance for response
            tenant.generated_password = generated_password
            tenant.generated_username = username
            tenant.admin_email = admin_email
            
            return tenant
            
        except Exception as e:
            # Clean up if tenant was created but other steps failed
            if 'tenant' in locals() and tenant.id:
                # IMPORTANT: Drop schema if it was created, because tenant.delete() 
                # on the model doesn't automatically trigger schema drop unless configured.
                # The ViewSet's perform_destroy does it, but we are calling model delete directly here.
                if hasattr(tenant, 'database_schema') and tenant.database_schema:
                    try:
                        with connection.cursor() as cursor:
                            cursor.execute(f'DROP SCHEMA IF EXISTS "{tenant.database_schema}" CASCADE')
                    except Exception as drop_err:
                        print(f"Failed to drop schema during cleanup: {drop_err}")
                
                tenant.delete()
            
            import traceback
            traceback.print_exc() # Print to console for debug
            raise serializers.ValidationError(f"Failed to create tenant: {str(e)}")

    def perform_destroy(self, instance):
        """
        Delete the tenant and drop their isolated schema.
        """
        from django.db import connection
        
        schema_name = getattr(instance, 'database_schema', None)
        if schema_name:
            try:
                with connection.cursor() as cursor:
                    # Generic SQL; Works for Postgres standard schema drop.
                    # For MySQL, same syntax works if it treats schema as Database.
                    cursor.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')
            except Exception as e:
                # Log usage error but proceed with record deletion to avoid orphan records in Public
                print(f"Error dropping schema {schema_name}: {e}")
        
        instance.delete()


class TenantUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating tenants (including legacy API keys)"""
    openai_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    elevenlabs_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    smartflo_numbers = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        help_text="List of Smartflo numbers to REPLACE existing ones"
    )
    # White Labeling Fields
    company_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    logo = serializers.ImageField(required=False, allow_empty_file=True, use_url=True, write_only=True)
    primary_color = serializers.CharField(required=False, allow_blank=True, write_only=True)
    custom_domain = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Tenant
        fields = ['name', 'is_active', 'openai_key', 'elevenlabs_key', 'smartflo_numbers',
                  'company_name', 'logo', 'primary_color', 'custom_domain']

    def update(self, instance, validated_data):
        from crm_app.models import TelephonyConfig, PhoneNumber
        from crm_app.models import TenantSettings

        # Extract extra fields
        openai_key = validated_data.pop('openai_key', None)
        elevenlabs_key = validated_data.pop('elevenlabs_key', None)
        smartflo_numbers = validated_data.pop('smartflo_numbers', None)
        
        # Branding
        company_name = validated_data.pop('company_name', None)
        logo = validated_data.pop('logo', None)
        primary_color = validated_data.pop('primary_color', None)
        custom_domain = validated_data.pop('custom_domain', None)

        # Standard update
        instance = super().update(instance, validated_data)

        # Update Branding
        if any([company_name is not None, logo is not None, primary_color is not None, custom_domain is not None]):
            try:
                # Provide defaults in case we create a new settings object
                defaults = {
                    'company_name': instance.name,  # Fallback to tenant name
                    'primary_color': '#6366f1'
                }
                if company_name is not None:
                    defaults['company_name'] = company_name
                if primary_color is not None:
                    defaults['primary_color'] = primary_color
                
                settings, created = TenantSettings.objects.get_or_create(
                    tenant=instance,
                    defaults=defaults
                )

                # If updated (not created), apply changes
                if not created:
                    if company_name is not None:
                        settings.company_name = company_name
                    if primary_color is not None:
                        settings.primary_color = primary_color
                
                # Apply other fields always
                if logo is not None:
                    settings.logo = logo
                if custom_domain is not None:
                    settings.custom_domain = custom_domain
                
                settings.save()
            except Exception as e:
                print(f"Error updating tenant branding: {e}")
                import traceback
                traceback.print_exc()
                # We don't re-raise to allow the main tenant update to succeed, 
                # but valid questions: should we? 
                # For now, let's fail soft or at least log.
                # Actually, raising it allows the user to see 500 and us to diagnose.
                # Let's re-raise to be visible.
                raise e

        # Update Keys if provided (empty string means clear it?)
        # Let's assume if provided as string, update it.
        if openai_key is not None:
             openai_config, _ = TelephonyConfig.objects.get_or_create(
                tenant=instance,
                provider='openai'
            )
             openai_config.set_api_key(openai_key)
             openai_config.save()
        
        if elevenlabs_key is not None:
             el_config, _ = TelephonyConfig.objects.get_or_create(
                tenant=instance,
                provider='elevenlabs'
            )
             el_config.set_api_key(elevenlabs_key)
             el_config.save()
        
        # Update Phone Numbers (Replace strategy)
        if smartflo_numbers is not None:
            # Clear existing logic? or Reassign?
            # Ideally:
            # 1. Release all currently assigned to this tenant back to pool (or delete if dynamic)
            # 2. Assign keys.
            
            # For simplicity: Set tenant=None for all numbers currently assigned to this tenant
            PhoneNumber.objects.filter(tenant=instance).update(tenant=None)
            
            for number in smartflo_numbers:
                ph_obj, _ = PhoneNumber.objects.get_or_create(
                    number=number,
                    defaults={'provider': 'smartflo'}
                )
                ph_obj.tenant = instance
                ph_obj.save()
                
        return instance


class ProductSerializer(serializers.ModelSerializer):
    """Product listing for subscription assignment"""
    plans = serializers.SerializerMethodField()
    features = serializers.JSONField(source='feature_flags')
    
    class Meta:
        model = Product
        fields = ['id', 'code', 'name', 'description', 'active', 'features', 'plans']
    
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
    permission_classes = [IsAuthenticated]  # IsSuperAdmin can be added for stricter access
    
    def get_serializer_class(self):
        if self.action == 'list':
            return TenantListSerializer
        elif self.action == 'create':
            return TenantCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return TenantUpdateSerializer
        return TenantDetailSerializer
    
    @action(detail=True, methods=['patch'], url_path='update-settings')
    def update_settings(self, request, pk=None):
        """Update tenant branding settings"""
        tenant = self.get_object()
        
        try:
            settings_obj = tenant.settings
        except TenantSettings.DoesNotExist:
            settings_obj = TenantSettings.objects.create(
                tenant=tenant,
                company_name=tenant.name
            )
        
        serializer = TenantSettingsSerializer(settings_obj, data=request.data, partial=True)
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

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """Get aggregate stats for admin dashboard"""
        from billing.models import Subscription
        from django.utils import timezone
        
        # 1. Tenant Counts
        total_tenants = Tenant.objects.count()
        new_tenants_last_30_days = Tenant.objects.filter(
            created_at__gte=timezone.now() - timezone.timedelta(days=30)
        ).count()
        
        # 2. Subscriptions & Revenue
        active_subs = Subscription.objects.filter(status__in=['active', 'trialing'])
        active_sub_count = active_subs.count()
        
        # Calculate MRR (Monthly Recurring Revenue)
        mrr_cents = 0
        for sub in active_subs:
            # Assuming monthly interval. If yearly, divide by 12.
            # Logic can be refined based on plan.interval
            price = sub.plan.price_cents
            if sub.plan.interval == 'year':
                price = price / 12
            mrr_cents += price
            
        mrr = mrr_cents / 100
        
        # 3. System Status (Simple check)
        # If we are here, DB is reachable
        
        return Response({
            'total_tenants': total_tenants,
            'new_tenants_30d': new_tenants_last_30_days,
            'active_subscriptions': active_sub_count,
            'mrr': mrr,
            'system_status': 'Online'
        })
    
    def perform_destroy(self, instance):
        """
        Delete the tenant and drop their isolated PostgreSQL schema.
        Also cleans up related user profiles.
        """
        from django.db import connection
        from django.conf import settings as django_settings
        
        schema_name = getattr(instance, 'database_schema', None)
        db_engine = django_settings.DATABASES['default']['ENGINE']
        
        # Drop the schema if it exists (PostgreSQL only)
        if schema_name and 'postgresql' in db_engine:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')
                    print(f"Dropped schema: {schema_name}")
            except Exception as e:
                print(f"Error dropping schema {schema_name}: {e}")
                # Continue with record deletion even if schema drop fails
        
        # Delete associated user profiles and users
        try:
            from crm_app.models import UserProfile
            profiles = UserProfile.objects.filter(tenant=instance)
            for profile in profiles:
                user = profile.user
                profile.delete()
                # Delete user if not a superuser
                if not user.is_superuser:
                    user.delete()
        except Exception as e:
            print(f"Error cleaning up users for tenant {instance.slug}: {e}")
        
        # Finally delete the tenant record
        instance.delete()


class ProductCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating products"""
    class Meta:
        model = Product
        fields = ['id', 'code', 'name', 'description', 'active', 'feature_flags']


class PlanCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating plans"""
    price = serializers.DecimalField(max_digits=10, decimal_places=2, write_only=True)
    
    class Meta:
        model = Plan
        fields = ['id', 'name', 'price', 'currency', 'interval', 'active']
    
    def create(self, validated_data):
        # Convert price to cents
        price = validated_data.pop('price', 0)
        validated_data['price_cents'] = int(price * 100)
        return super().create(validated_data)


class ProductViewSet(viewsets.ModelViewSet):
    """Full CRUD viewset for products"""
    queryset = Product.objects.all().order_by('name')
    permission_classes = [IsAuthenticated]  # IsSuperAdmin can be added for stricter access
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ProductCreateSerializer
        return ProductSerializer
    
    @action(detail=True, methods=['post'], url_path='plans')
    def create_plan(self, request, pk=None):
        """Create a new plan for this product"""
        product = self.get_object()
        
        serializer = PlanCreateSerializer(data=request.data)
        if serializer.is_valid():
            plan = serializer.save(product=product)
            return Response({
                'id': str(plan.id),
                'name': plan.name,
                'price': plan.price_cents / 100,
                'interval': plan.interval,
                'message': 'Plan created successfully'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
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
