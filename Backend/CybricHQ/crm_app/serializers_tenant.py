"""
Tenant serializers for white-label multi-tenant API.
"""
from rest_framework import serializers
from crm_app.models import Tenant, TenantSettings


class TenantBrandingSerializer(serializers.Serializer):
    """
    Public-facing branding data (no auth required).
    Used by frontend to fetch logo, colors, company name.
    """
    name = serializers.CharField(source='tenant.name')
    slug = serializers.CharField(source='tenant.slug')
    company_name = serializers.CharField()
    logo_url = serializers.URLField(allow_null=True)
    favicon_url = serializers.URLField(allow_null=True)
    primary_color = serializers.CharField()
    secondary_color = serializers.CharField()
    accent_color = serializers.CharField()
    support_email = serializers.EmailField(allow_null=True)
    website_url = serializers.URLField(allow_null=True)

    class Meta:
        model = TenantSettings
        fields = [
            'name', 'slug', 'company_name', 'logo_url', 'favicon_url',
            'primary_color', 'secondary_color', 'accent_color',
            'support_email', 'website_url'
        ]


class TenantSettingsSerializer(serializers.ModelSerializer):
    """
    Full tenant settings for admin management.
    """
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    tenant_slug = serializers.CharField(source='tenant.slug', read_only=True)
    
    class Meta:
        model = TenantSettings
        fields = [
            'tenant_name', 'tenant_slug', 'company_name',
            'logo_url', 'favicon_url',
            'primary_color', 'secondary_color', 'accent_color',
            'custom_domain', 'features',
            'support_email', 'website_url',
            'smartflo_api_key', 'smartflo_voicebot_api_key', 'smartflo_caller_id', 'smartflo_config',
            'elevenlabs_api_key', 'elevenlabs_agent_id', 'elevenlabs_config',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['tenant_name', 'tenant_slug', 'created_at', 'updated_at']


class TenantSerializer(serializers.ModelSerializer):
    """
    Core tenant model serializer.
    """
    settings = TenantSettingsSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'slug', 'is_active', 'settings', 'member_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_member_count(self, obj):
        return obj.members.count() if hasattr(obj, 'members') else 0
