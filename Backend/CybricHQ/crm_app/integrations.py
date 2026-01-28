"""
Tenant-aware integration base classes for third-party API services.
Provides standardized access to tenant-specific API keys and configuration.
"""
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class TenantAwareIntegration:
    """
    Base class for tenant-aware third-party integrations.
    
    Ensures API keys and configuration are tenant-specific, not global.
    
    Usage:
        class MyServiceClient(TenantAwareIntegration):
            def __init__(self, tenant):
                super().__init__(tenant)
                self.api_key = self.get_api_key('myservice')
    """
    
    def __init__(self, tenant):
        """
        Initialize with tenant context.
        
        Args:
            tenant: Tenant model instance
        
        Raises:
            ValueError: If tenant is None or has no settings
        """
        if not tenant:
            raise ValueError("Tenant is required for tenant-aware integrations")
        
        self.tenant = tenant
        
        # Load tenant settings
        try:
            self.settings = tenant.settings
        except Exception as e:
            logger.error(f"[TENANT-API] Failed to load settings for tenant {tenant.slug}: {e}")
            self.settings = None
    
    def get_api_key(self, service_name: str) -> Optional[str]:
        """
        Get tenant-specific API key for a service.
        
        Args:
            service_name: Name of the service (e.g., 'elevenlabs', 'smartflo', 'openai')
        
        Returns:
            API key string or None if not configured
        
        Raises:
            ValueError: If settings not available
        """
        if not self.settings:
            raise ValueError(f"No settings found for tenant {self.tenant.slug}")
        
        # Construct field name: service_name_api_key
        key_field = f"{service_name}_api_key"
        api_key = getattr(self.settings, key_field, None)
        
        if not api_key:
            logger.warning(f"[TENANT-API] No {service_name} API key configured for tenant {self.tenant.slug}")
            return None
        
        logger.info(f"[TENANT-API] Retrieved {service_name} API key for tenant {self.tenant.slug}")
        return api_key
    
    def get_config(self, service_name: str) -> Dict[str, Any]:
        """
        Get tenant-specific configuration dict for a service.
        
        Args:
            service_name: Name of the service (e.g., 'elevenlabs', 'smartflo', 'openai')
        
        Returns:
            Configuration dictionary (empty dict if not configured)
        """
        if not self.settings:
            return {}
        
        # Construct field name: service_name_config
        config_field = f"{service_name}_config"
        config = getattr(self.settings, config_field, {})
        
        return config or {}
    
    def get_caller_id(self, service_name: str) -> Optional[str]:
        """
        Get tenant-specific caller ID or DID for telephony services.
        
        Args:
            service_name: Name of the service (e.g., 'smartflo')
        
        Returns:
            Caller ID string or None if not configured
        """
        if not self.settings:
            return None
        
        # Construct field name: service_name_caller_id
        caller_id_field = f"{service_name}_caller_id"
        caller_id = getattr(self.settings, caller_id_field, None)
        
        return caller_id
    
    def validate_configuration(self, required_keys: list) -> bool:
        """
        Validate that all required configuration keys are present.
        
        Args:
            required_keys: List of required field names (e.g., ['elevenlabs_api_key', 'elevenlabs_agent_id'])
        
        Returns:
            True if all required keys are present and non-empty
        """
        if not self.settings:
            logger.error(f"[TENANT-API] No settings for tenant {self.tenant.slug}")
            return False
        
        missing_keys = []
        for key in required_keys:
            value = getattr(self.settings, key, None)
            if not value:
                missing_keys.append(key)
        
        if missing_keys:
            logger.error(f"[TENANT-API] Missing configuration for tenant {self.tenant.slug}: {missing_keys}")
            return False
        
        logger.info(f"[TENANT-API] All required keys present for tenant {self.tenant.slug}")
        return True


class ElevenLabsIntegration(TenantAwareIntegration):
    """
    Tenant-aware ElevenLabs API integration.
    """
    
    def __init__(self, tenant):
        super().__init__(tenant)
        self.api_key = self.get_api_key('elevenlabs')
        self.config = self.get_config('elevenlabs')
        
        # Get agent IDs from both direct field and config
        self.agent_id = getattr(self.settings, 'elevenlabs_agent_id', None) or self.config.get('agent_id')
        self.followup_agent_id = self.config.get('followup_agent_id')
    
    def is_configured(self) -> bool:
        """Check if ElevenLabs integration is properly configured."""
        return bool(self.api_key and self.agent_id)
    
    def get_agent_id(self, is_followup: bool = False) -> Optional[str]:
        """
        Get appropriate agent ID based on call type.
        
        Args:
            is_followup: Whether this is a follow-up call
        
        Returns:
            Agent ID string or None
        """
        if is_followup and self.followup_agent_id:
            logger.info(f"[TENANT-API] Using follow-up agent ID for tenant {self.tenant.slug}")
            return self.followup_agent_id
        
        return self.agent_id


class SmartfloIntegration(TenantAwareIntegration):
    """
    Tenant-aware Smartflo (Tata) API integration.
    """
    
    def __init__(self, tenant):
        super().__init__(tenant)
        self.api_key = self.get_api_key('smartflo')
        self.voicebot_api_key = getattr(self.settings, 'smartflo_voicebot_api_key', None) if self.settings else None
        self.caller_id = self.get_caller_id('smartflo')
        self.config = self.get_config('smartflo')
    
    def is_configured(self) -> bool:
        """Check if Smartflo integration is properly configured."""
        return bool(self.api_key and self.caller_id)


class OpenAIIntegration(TenantAwareIntegration):
    """
    Tenant-aware OpenAI API integration.
    """
    
    def __init__(self, tenant):
        super().__init__(tenant)
        self.api_key = self.get_api_key('openai')
        self.config = self.get_config('openai')
        self.model = self.config.get('model', 'gpt-4o-mini')
    
    def is_configured(self) -> bool:
        """Check if OpenAI integration is properly configured."""
        return bool(self.api_key)
