from django.core.management.base import BaseCommand
from django.conf import settings
from crm_app.models import TelephonyConfig, VoiceAgent, PhoneNumber, Tenant, TenantSettings
import os

class Command(BaseCommand):
    help = 'Seeds development company data and encrypts secrets from .env'

    def handle(self, *args, **options):
        self.stdout.write("Starting development seeding...")

        # 1. Ensure a default tenant exists
        tenant, created = Tenant.objects.get_or_create(
            slug='cybric',
            defaults={'name': 'Cybric HQ'}
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created tenant: {tenant.name}'))
            # Create settings
            TenantSettings.objects.create(tenant=tenant, company_name="Cybric HQ")
        else:
            self.stdout.write(f"Using existing tenant: {tenant.name}")
        
        # 2. Smartflo Config
        sf_key = os.environ.get('SMARTFLO_API_KEY') or getattr(settings, 'SMARTFLO_API_KEY', '')
        if sf_key:
            config, _ = TelephonyConfig.objects.get_or_create(
                tenant=tenant,
                provider='smartflo'
            )
            # Store encrypted
            config.set_api_key(sf_key)
            config.save()
            self.stdout.write(self.style.SUCCESS('Encrypted and saved Smartflo API Key'))

        # 3. ElevenLabs Config
        el_key = os.environ.get('ELEVENLABS_API_KEY') or getattr(settings, 'ELEVENLABS_API_KEY', '')
        if el_key:
            config, _ = TelephonyConfig.objects.get_or_create(
                tenant=tenant,
                provider='elevenlabs'
            )
            config.set_api_key(el_key)
            config.save()
            self.stdout.write(self.style.SUCCESS('Encrypted and saved ElevenLabs API Key'))

        # 4. Voice Agents
        # Inbound
        inbound_agent_id = os.environ.get('ELEVENLABS_INBOUND_AGENT_ID')
        if inbound_agent_id:
            agent, _ = VoiceAgent.objects.get_or_create(
                tenant=tenant,
                provider='elevenlabs',
                name='Inbound Agent',
                defaults={'provider_agent_id': inbound_agent_id}
            )
            if agent.provider_agent_id != inbound_agent_id:
                agent.provider_agent_id = inbound_agent_id
                agent.save()
            self.stdout.write(self.style.SUCCESS(f'Synced Inbound Agent: {inbound_agent_id}'))

        # Outbound
        outbound_agent_id = os.environ.get('ELEVENLABS_AGENT_ID')
        if outbound_agent_id:
             agent, _ = VoiceAgent.objects.get_or_create(
                tenant=tenant,
                provider='elevenlabs',
                name='Outbound Agent',
                defaults={'provider_agent_id': outbound_agent_id}
            )
             if agent.provider_agent_id != outbound_agent_id:
                agent.provider_agent_id = outbound_agent_id
                agent.save()
             self.stdout.write(self.style.SUCCESS(f'Synced Outbound Agent: {outbound_agent_id}'))

        # 5. Phone Number
        did = os.environ.get('SMARTFLO_CALLER_ID')
        if did:
            phone, _ = PhoneNumber.objects.get_or_create(
                tenant=tenant,
                number=did,
                defaults={'provider': 'smartflo'}
            )
            # Link to inbound agent if exists
            inbound_agent = VoiceAgent.objects.filter(tenant=tenant, name='Inbound Agent').first()
            if inbound_agent:
                phone.inbound_agent = inbound_agent
                phone.save()
            self.stdout.write(self.style.SUCCESS(f'Synced DID: {did} -> Inbound Agent'))
        
        self.stdout.write(self.style.SUCCESS("Seeding completed successfully."))
