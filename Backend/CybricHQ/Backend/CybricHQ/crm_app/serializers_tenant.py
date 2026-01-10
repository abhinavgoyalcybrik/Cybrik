from rest_framework import serializers
from .models import VoiceAgent, PhoneNumber, TelephonyConfig, Tenant

class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'slug', 'domain', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']

class TenantSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        # Explicit fields or __all__ depending on model definition (which I need to check if exists there, likely yes)
        fields = '__all__' 

class VoiceAgentSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoiceAgent
        fields = ['id', 'name', 'type', 'provider', 'provider_agent_id', 'config', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']

class PhoneNumberSerializer(serializers.ModelSerializer):
    inbound_agent_details = VoiceAgentSerializer(source='inbound_agent', read_only=True)
    
    class Meta:
        model = PhoneNumber
        fields = ['id', 'number', 'provider', 'inbound_agent', 'inbound_agent_details', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']

class TelephonyConfigSerializer(serializers.ModelSerializer):
    # Write-only fields for setting secrets
    api_key = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = TelephonyConfig
        fields = ['id', 'provider', 'base_url', 'api_key', 'updated_at']
        read_only_fields = ['id', 'updated_at']

    def update(self, instance, validated_data):
        api_key = validated_data.pop('api_key', None)
        if api_key:
            instance.set_api_key(api_key)
        return super().update(instance, validated_data)

    def create(self, validated_data):
        api_key = validated_data.pop('api_key', None)
        instance = super().create(validated_data)
        if api_key:
            instance.set_api_key(api_key)
            instance.save()
        return instance
