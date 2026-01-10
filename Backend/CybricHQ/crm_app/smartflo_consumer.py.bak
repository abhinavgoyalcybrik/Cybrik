"""
Smartflo <-> ElevenLabs Agent Bridge

Bridges audio between Smartflo telephony and ElevenLabs Conversational AI Agent.
The ElevenLabs Agent handles the entire conversation (STT + AI + TTS) with your knowledge base.
"""

import json
import base64
import asyncio
import logging
import struct
import time
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

logger = logging.getLogger(__name__)


# μ-law to linear PCM conversion table (for 8-bit mulaw to 16-bit PCM)
MULAW_DECODE_TABLE = [
    -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956,
    -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
    -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412,
    -11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316,
    -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
    -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
    -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
    -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
    -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
    -1372, -1308, -1244, -1180, -1116, -1052, -988, -924,
    -876, -844, -812, -780, -748, -716, -684, -652,
    -620, -588, -556, -524, -492, -460, -428, -396,
    -372, -356, -340, -324, -308, -292, -276, -260,
    -244, -228, -212, -196, -180, -164, -148, -132,
    -120, -112, -104, -96, -88, -80, -72, -64,
    -56, -48, -40, -32, -24, -16, -8, 0,
    32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
    23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
    15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
    11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316,
    7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140,
    5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092,
    3900, 3772, 3644, 3516, 3388, 3260, 3132, 3004,
    2876, 2748, 2620, 2492, 2364, 2236, 2108, 1980,
    1884, 1820, 1756, 1692, 1628, 1564, 1500, 1436,
    1372, 1308, 1244, 1180, 1116, 1052, 988, 924,
    876, 844, 812, 780, 748, 716, 684, 652,
    620, 588, 556, 524, 492, 460, 428, 396,
    372, 356, 340, 324, 308, 292, 276, 260,
    244, 228, 212, 196, 180, 164, 148, 132,
    120, 112, 104, 96, 88, 80, 72, 64,
    56, 48, 40, 32, 24, 16, 8, 0,
]


def mulaw_to_pcm(mulaw_bytes: bytes) -> bytes:
    """Convert μ-law audio to 16-bit PCM"""
    pcm_samples = []
    for byte in mulaw_bytes:
        pcm_samples.append(MULAW_DECODE_TABLE[byte])
    return struct.pack(f'<{len(pcm_samples)}h', *pcm_samples)


def upsample_8k_to_16k(pcm_8k: bytes) -> bytes:
    """Upsample 8kHz PCM audio to 16kHz using linear interpolation.
    ElevenLabs requires 16kHz input audio.
    """
    samples = struct.unpack(f'<{len(pcm_8k)//2}h', pcm_8k)
    upsampled = []
    
    for i in range(len(samples)):
        upsampled.append(samples[i])
        if i < len(samples) - 1:
            # Linear interpolation: average of current and next sample
            interpolated = (samples[i] + samples[i + 1]) // 2
            upsampled.append(interpolated)
        else:
            # Last sample: duplicate it
            upsampled.append(samples[i])
    
    return struct.pack(f'<{len(upsampled)}h', *upsampled)


def downsample_16k_to_8k(pcm_16k: bytes) -> bytes:
    """Downsample 16kHz PCM audio to 8kHz.
    Smartflo requires 8kHz mulaw audio.
    Uses averaging (boxcar filter) to reduce aliasing.
    """
    samples = struct.unpack(f'<{len(pcm_16k)//2}h', pcm_16k)
    downsampled = []
    
    # Process 2 samples at a time
    for i in range(0, len(samples), 2):
        if i + 1 < len(samples):
            # Average the two samples
            avg_sample = (samples[i] + samples[i+1]) // 2
            downsampled.append(avg_sample)
        else:
            # Handle odd number of samples
            downsampled.append(samples[i])
            
    return struct.pack(f'<{len(downsampled)}h', *downsampled)


def amplify_pcm(pcm_bytes: bytes, gain: float = 4.0) -> bytes:
    """Amplify PCM audio by a gain factor.
    Args:
        pcm_bytes: 16-bit signed PCM audio
        gain: Volume multiplier (default 4.0 = 4x louder for phone audio)
    Returns:
        Amplified PCM audio with clipping protection
    """
    samples = struct.unpack(f'<{len(pcm_bytes)//2}h', pcm_bytes)
    amplified = []
    for sample in samples:
        # Amplify and clip to 16-bit range
        new_sample = int(sample * gain)
        new_sample = max(-32768, min(32767, new_sample))
        amplified.append(new_sample)
    return struct.pack(f'<{len(amplified)}h', *amplified)


# μ-law encoding constants
MULAW_BIAS = 0x84
MULAW_CLIP = 32635

def pcm_to_mulaw(pcm_bytes: bytes) -> bytes:
    """Convert 16-bit signed PCM to μ-law (8-bit).
    Standard ITU-T G.711 μ-law encoding.
    """
    samples = struct.unpack(f'<{len(pcm_bytes)//2}h', pcm_bytes)
    mulaw_bytes = []
    
    for sample in samples:
        # Clip the sample
        sign = 0x80 if sample < 0 else 0x00
        sample = min(abs(sample), MULAW_CLIP)
        
        # Add bias
        sample = sample + MULAW_BIAS
        
        # Find the exponent (segment)
        exponent = 7
        exp_mask = 0x4000
        for exp in range(8):
            if sample & exp_mask:
                exponent = 7 - exp
                break
            exp_mask >>= 1
        
        # Extract the mantissa (4 bits)
        mantissa = (sample >> (exponent + 3)) & 0x0F
        
        # Combine and complement
        mulaw_byte = ~(sign | (exponent << 4) | mantissa) & 0xFF
        mulaw_bytes.append(mulaw_byte)
    
    return bytes(mulaw_bytes)


class SmartfloAudioConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer that bridges Smartflo telephony to ElevenLabs Conversational AI Agent.
    
    Flow:
    1. Smartflo connects with call audio
    2. We forward caller audio to ElevenLabs Agent
    3. ElevenLabs Agent (with your knowledge base) processes and responds
    4. We forward ElevenLabs audio back to Smartflo -> Caller hears AI
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.stream_sid = None
        self.call_sid = None
        self.caller_from = None
        self.caller_to = None
        self.chunk_number = 0
        self.elevenlabs_ws = None
        
        # Lead context for ElevenLabs dynamic variables
        self.lead_context = {}
        
        # Audio buffer for Smartflo (must send 160-byte multiples)
        self.audio_buffer = bytearray()
        
        # Flag to track when ElevenLabs is ready to receive audio
        self.elevenlabs_ready = False
        
        # Track call direction (inbound/outbound)
        self.call_direction = 'unknown'
        

        # Input Jitter Buffer (User -> ElevenLabs)
        # Buffer incoming audio to send larger chunks (smooths out jitter)
        self.input_audio_buffer = bytearray()
        self.INPUT_CHUNK_SIZE = 480  # 60ms of 8kHz mulaw per Smartflo spec


    async def connect(self):
        """Accept WebSocket connection from Smartflo"""
        try:
            await self.accept()
            logger.info("=" * 60)
            logger.info("[SMARTFLO] WebSocket CONNECTED - Waiting for audio stream...")
            logger.info("=" * 60)
        except Exception as e:
            logger.exception(f"[SMARTFLO] Error in connect: {e}")
        # Don't do anything else here - wait for Smartflo to send events
        # ElevenLabs will be connected when we receive the first audio data
        
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        logger.info(f"Smartflo WebSocket DISCONNECTED: {close_code}")
        if self.elevenlabs_ws:
            await self.elevenlabs_ws.close()
            
    async def receive(self, text_data=None, bytes_data=None):
        """Handle incoming messages from Smartflo"""
        
        if bytes_data:
            # Handle raw binary audio (mulaw) directly from Smartflo
            await self.handle_binary_audio(bytes_data)
            return
        
        if text_data:
            try:
                message = json.loads(text_data)
                event = message.get('event')
                # logger.debug(f"[SMARTFLO] Event type: {event}")
                
                if event == 'connected':
                    await self.handle_connected(message)
                elif event == 'start':
                    await self.handle_start(message)
                elif event == 'media':
                    await self.handle_media(message)
                elif event == 'dtmf':
                    await self.handle_dtmf(message)
                elif event == 'stop':
                    await self.handle_stop(message)
                elif event == 'mark':
                    await self.handle_mark(message)
                else:
                    logger.warning(f"[SMARTFLO] Unknown event: {event}")
                    
            except json.JSONDecodeError as e:
                logger.error(f"[SMARTFLO] Invalid JSON: {e}")
            except Exception as e:
                logger.exception(f"[SMARTFLO] Error handling event: {e}")

    async def handle_binary_audio(self, audio_bytes):
        """Handle raw binary audio from Smartflo (mulaw 8kHz format)
        
        We convert it to PCM 16kHz which is the standard input format for ElevenLabs.
        We buffer input audio to 100ms (800 bytes) chunks to ensure stability.
        """
        # Connect to ElevenLabs if not already connected
        if not self.elevenlabs_ws:
            logger.info("[SMARTFLO] First audio received - connecting to ElevenLabs...")
            await self.connect_elevenlabs_agent()
            if not self.elevenlabs_ws:
                logger.error("[SMARTFLO] Failed to connect to ElevenLabs")
                return
            
        # Accumulate in buffer
        self.input_audio_buffer.extend(audio_bytes)
        
        # Wait for ElevenLabs handshake
        if not self.elevenlabs_ready:
            # Just keep buffering limit check
            if len(self.input_audio_buffer) > 320000: 
                 self.input_audio_buffer = self.input_audio_buffer[-320000:]
            return
        
        # Process audio if we have enough buffered (100ms = 800 bytes of mulaw)
        # This reduces WebSocket overhead and packet rate
        THRESHOLD = 800 
        
        if len(self.input_audio_buffer) >= THRESHOLD:
            try:
                # Process all buffered audio
                chunk_to_process = self.input_audio_buffer
                # Reset buffer immediately
                self.input_audio_buffer = bytearray()
                
                # Convert: Mulaw 8k -> PCM 16k
                pcm_8k = mulaw_to_pcm(chunk_to_process)
                pcm_16k = upsample_8k_to_16k(pcm_8k)
                
                await self.elevenlabs_ws.send(json.dumps({
                    "user_audio_chunk": base64.b64encode(pcm_16k).decode('utf-8')
                }))
                
                self.chunk_number += 1
                    
            except Exception as e:
                logger.error(f"[SMARTFLO] Error forwarding audio: {e}")
                # Reset buffer to avoid lag loop
                self.input_audio_buffer = bytearray()

    async def handle_connected(self, message):
        """Handle Smartflo connected event (WebSocket handshake complete)"""
        logger.info("[SMARTFLO] Handshake received - stream starting soon...")

    @database_sync_to_async
    def get_lead_from_db(self, phone_number):
        """
        Fetch Lead from database using phone number.
        Try multiple formats: raw, with +91, without +91, etc.
        """
        if not phone_number:
            return None
            
        from crm_app.models import Lead
        from crm_app.smartflo_api import build_lead_context
        
        # Clean phone number
        cleaned = phone_number.replace('+', '').replace('-', '').strip()
        
        # Try finding lead with various formats
        candidates = [
            phone_number,
            cleaned,
            '+' + cleaned,
        ]
        if len(cleaned) == 12 and cleaned.startswith('91'):
            candidates.append(cleaned[2:]) # 10 digit
        if len(cleaned) == 10:
            candidates.append('91' + cleaned)
            candidates.append('+91' + cleaned)
            
        logger.info(f"[SMARTFLO] Searching DB for lead: {cleaned}")
        
        for candidate in candidates:
            lead = Lead.objects.filter(phone=candidate).first()
            if lead:
                logger.info(f"[SMARTFLO] Found Lead in DB: {lead.id} - {lead.name}")
                return build_lead_context(lead)
                
        logger.warning("[SMARTFLO] No Lead found in DB for number")
        return None

    @database_sync_to_async
    def create_inbound_call_record(self, customer_phone):
        """
        Create a CallRecord for an inbound call.
        Links to Lead/Applicant if found by phone number.
        """
        from crm_app.models import CallRecord, Lead, Applicant
        
        # Clean phone number
        cleaned = customer_phone.replace('+', '').replace('-', '').strip() if customer_phone else ''
        
        # Try to find Lead or Applicant by phone
        lead = None
        applicant = None
        
        candidates = [customer_phone, cleaned]
        if len(cleaned) == 12 and cleaned.startswith('91'):
            candidates.append(cleaned[2:])
        if len(cleaned) == 10:
            candidates.append('91' + cleaned)
            candidates.append('+91' + cleaned)
        
        for candidate in candidates:
            lead = Lead.objects.filter(phone=candidate).first()
            if lead:
                break
                
        if not lead:
            for candidate in candidates:
                applicant = Applicant.objects.filter(phone=candidate).first()
                if applicant:
                    break
        
        # Create CallRecord
        call_record = CallRecord.objects.create(
            lead=lead,
            applicant=applicant,
            direction='inbound',
            status='in_progress',
            provider='smartflo',
            external_call_id=self.call_sid,
            metadata={
                'customer_phone': customer_phone,
                'our_did': self.caller_to,
                'stream_sid': self.stream_sid,
                'inbound': True,
            }
        )
        
        logger.info(f"[SMARTFLO] Created INBOUND CallRecord {call_record.id} for {customer_phone}")
        return call_record

    async def handle_start(self, message):
        """Handle stream start with metadata"""
        start_data = message.get('start', {})
        self.stream_sid = message.get('streamSid')
        self.call_sid = start_data.get('callSid')
        self.caller_from = start_data.get('from')
        self.caller_to = start_data.get('to')
        
        # 1. Start with custom params from Smartflo (least reliable)
        raw_custom_params = start_data.get('customParameters') or {}
        if not isinstance(raw_custom_params, dict):
            raw_custom_params = {}
        
        lead_context = {}
        
        # Unpack "key:value" strings
        for k, v in raw_custom_params.items():
            if isinstance(v, str) and ':' in v:
                try:
                    parts = v.split(':', 1)
                    if len(parts) == 2:
                        key, val = parts[0].strip(), parts[1].strip()
                        if key and val:
                            lead_context[key] = val
                except Exception:
                    pass
            # Also copy raw values
            lead_context[k] = v
            
        # 2. Fetch from DB using phone number (Most reliable)
        # Smartflo sends 'to' as the customer number in outbound calls
        # Note: In inbound calls 'from' is customer number. 
        
        # Determine call direction
        our_did = getattr(settings, 'SMARTFLO_CALLER_ID', '918069651149')
        caller_to_clean = str(self.caller_to).replace('+', '').strip()
        caller_from_clean = str(self.caller_from).replace('+', '').strip()
        
        # If 'to' matches our DID, it's an inbound call
        is_inbound = caller_to_clean == our_did.replace('+', '') or caller_to_clean.endswith(our_did.replace('+', '')[-10:])
        
        if is_inbound:
            customer_number = self.caller_from  # Inbound: customer is calling us
            self.call_direction = 'inbound'
            logger.info(f"[SMARTFLO] INBOUND call detected from {customer_number}")
        else:
            customer_number = self.caller_to  # Outbound: we're calling customer
            self.call_direction = 'outbound'
            logger.info(f"[SMARTFLO] OUTBOUND call to {customer_number}")
             
        db_context = await self.get_lead_from_db(customer_number)
        
        if db_context:
            logger.info("[SMARTFLO] Using DB Lead context")
            lead_context.update(db_context)
            
        self.lead_context = lead_context
        
        # For INBOUND calls, create a CallRecord now (outbound creates it before initiating)
        if is_inbound and not lead_context.get('call_record_id'):
            call_record = await self.create_inbound_call_record(customer_number)
            if call_record:
                self.lead_context['call_record_id'] = str(call_record.id)
        
        self.lead_context['direction'] = self.call_direction
        
        logger.info(f"Call started: {self.caller_from} -> {self.caller_to} ({self.call_direction})")
        logger.info(f"Lead Context loaded: Name={self.lead_context.get('name')}")
        
        # Connect to ElevenLabs Conversational AI Agent
        await self.connect_elevenlabs_agent()
        
    async def handle_media(self, message):
        """Forward incoming audio from caller to ElevenLabs Agent"""
        media = message.get('media', {})
        payload = media.get('payload', '')
        
        if payload and self.elevenlabs_ws:
            try:
                # Decode mulaw audio from Smartflo (base64 -> bytes)
                mulaw_audio = base64.b64decode(payload)
                
                # Buffer and process via common logic (reuse handle_binary_audio logic)
                await self.handle_binary_audio(mulaw_audio)
                
            except Exception as e:
                logger.error(f"Error processing media: {e}")
                
    async def handle_dtmf(self, message):
        """Handle DTMF keypress from caller"""
        dtmf = message.get('dtmf', {})
        digit = dtmf.get('digit')
        logger.info(f"DTMF pressed: {digit}")
        
    async def handle_stop(self, message):
        """Handle call end - update CallRecord with final status"""
        stop_data = message.get('stop', {})
        reason = stop_data.get('reason', 'Unknown')
        logger.info(f"Call ended: {reason}")
        
        # Update CallRecord with completed status
        try:
            call_record_id = self.lead_context.get('call_record_id')
            if call_record_id:
                from crm_app.models import CallRecord
                from django.db import close_old_connections
                close_old_connections()
                
                call_record = CallRecord.objects.filter(id=call_record_id).first()
                if call_record:
                    call_record.status = 'completed'
                    # Store conversation_id if we got one from ElevenLabs
                    if hasattr(self, 'elevenlabs_conversation_id') and self.elevenlabs_conversation_id:
                        call_record.metadata = call_record.metadata or {}
                        call_record.metadata['conversation_id'] = self.elevenlabs_conversation_id
                        call_record.external_call_id = self.elevenlabs_conversation_id
                    call_record.save()
                    logger.info(f"Updated CallRecord {call_record_id} to completed status")
        except Exception as e:
            logger.error(f"Error updating CallRecord on call end: {e}")
        
        if self.elevenlabs_ws:
            await self.elevenlabs_ws.close()
            
    async def handle_mark(self, message):
        """Handle mark event (audio playback complete)"""
        mark = message.get('mark', {})
        name = mark.get('name')
        # logger.debug(f"Mark received: {name}")
        
    @database_sync_to_async
    def get_tenant_configurations(self, phone_number, direction):
        """
        Resolve Tenant, VoiceAgent, and TelephonyConfig based on the call.
        Returns a dict with resolved objects/config.
        """
        from crm_app.models import PhoneNumber, VoiceAgent, TelephonyConfig, Tenant
        
        result = {
            'api_key': None,
            'agent_id': None,
            'tenant': None
        }
        
        # 1. Identify Tenant
        tenant = None
        
        # Clean number to match DB (assuming 91 prefixed)
        clean_number = str(phone_number).replace('+', '').strip()
        if len(clean_number) == 10: clean_number = '91' + clean_number
        
        # If Inbound: Look up PhoneNumber (DID)
        if direction == 'inbound':
            # We are receiving a call on 'caller_to' (our DID) -> passed here as phone_number? 
            # In handle_start, we pass the relevant number.
            
            # Try to find the mapped DID
            ph = PhoneNumber.objects.filter(number__endswith=clean_number[-10:]).first()
            if ph:
                tenant = ph.tenant
                if ph.inbound_agent:
                    result['agent_id'] = ph.inbound_agent.provider_agent_id
            else:
                # Fallback to default 'cybric' tenant if no DID found (during dev/migration)
                tenant = Tenant.objects.filter(slug='cybric').first()
                if tenant:
                    # Try to find default inbound agent
                    agent = VoiceAgent.objects.filter(tenant=tenant, name='Inbound Agent').first()
                    if agent:
                        result['agent_id'] = agent.provider_agent_id
                        
        else: # Outbound
            # For outbound, we usually know the tenant from the user who initiated it.
            # But here we only have phone numbers.
            # We can try to assume 'cybric' or check if the 'from' number matches a verified caller ID.
            # For now, default to 'cybric'.
            tenant = Tenant.objects.filter(slug='cybric').first()
            if tenant:
                 # Try to find default outbound agent
                agent = VoiceAgent.objects.filter(tenant=tenant, name='Outbound Agent').first()
                if agent:
                    result['agent_id'] = agent.provider_agent_id

        result['tenant'] = tenant
        
        # 2. Fetch API Key for ElevenLabs
        if tenant:
            config = TelephonyConfig.objects.filter(tenant=tenant, provider='elevenlabs').first()
            if config:
                result['api_key'] = config.get_api_key()
        
        return result

    async def connect_elevenlabs_agent(self):
        """
        Connect to ElevenLabs Conversational AI Agent.
        """
        import websockets
        
        # Fetch configuration from DB based on context
        # Inbound: caller_to is our DID
        # Outbound: caller_from is our DID
        did_number = self.caller_to if self.call_direction == 'inbound' else self.caller_from
        
        config = await self.get_tenant_configurations(did_number, self.call_direction)
        
        api_key = config.get('api_key')
        agent_id = config.get('agent_id')
        
        # Fallback to legacy settings if DB missing
        if not api_key:
            if self.call_direction == 'inbound':
                api_key = getattr(settings, 'ELEVENLABS_INBOUND_API_KEY', '') or getattr(settings, 'ELEVENLABS_API_KEY', '')
            else:
                api_key = getattr(settings, 'ELEVENLABS_API_KEY', '')
                
        if not agent_id:
            if self.call_direction == 'inbound':
                agent_id = getattr(settings, 'ELEVENLABS_INBOUND_AGENT_ID', None)
            else:
                agent_id = getattr(settings, 'ELEVENLABS_AGENT_ID', None)
        
        logger.info(f"[ELEVENLABS] Connecting with Agent ID: {agent_id} (Direction: {self.call_direction})")
        
        if not api_key or not agent_id:
            logger.error("ElevenLabs API key or Agent ID not configured")
            return
            
        try:
            # ElevenLabs Conversational AI Agent WebSocket endpoint
            ws_url = f"wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_id}"
            
            # Headers for authentication
            headers = {"xi-api-key": api_key}
            
            # Try different websockets library versions for compatibility
            try:
                # Newer websockets versions (11+) use additional_headers
                self.elevenlabs_ws = await websockets.connect(
                    ws_url,
                    additional_headers=headers
                )
            except TypeError:
                # Older websockets versions use extra_headers
                self.elevenlabs_ws = await websockets.connect(
                    ws_url,
                    extra_headers=headers
                )
            
            # Build dynamic variables - must match ElevenLabs agent config exactly
            dynamic_vars = {
                "counsellorName": self.lead_context.get('counsellor_name', 'Jess'),
                "name": self.lead_context.get('name', 'Harpreet Singh'),
                "preferredCountry": self.lead_context.get('country', 'Australia'),
                "highestQualification": self.lead_context.get('highest_qualification', '12th'),
                "stream12th": self.lead_context.get('stream12th', 'not specified'),
                "marksHighestQualification": self.lead_context.get('qualification_marks', '82%'),
                "yearCompletion": self.lead_context.get('year_completion', 'not specified'),
                "ieltsPteScores": self.lead_context.get('english_test_scores', 'IELTS 7.0 Overall'),
            }
            
            # Send conversation initiation with dynamic variables
            init_message = {
                "type": "conversation_initiation_client_data",
                "dynamic_variables": dynamic_vars
            }
            
            await self.elevenlabs_ws.send(json.dumps(init_message))
            
            # Start listening for ElevenLabs Agent responses
            asyncio.create_task(self.listen_elevenlabs_agent())
            
            logger.info(f"[ELEVENLABS] Connected to Agent: {agent_id}")
            
        except Exception as e:
            logger.error(f"Failed to connect to ElevenLabs Agent: {e}")
            
    async def listen_elevenlabs_agent(self):
        """
        Listen for responses from ElevenLabs Agent and forward audio to Smartflo.
        """
        try:
            async for message in self.elevenlabs_ws:
                try:
                    data = json.loads(message)
                    msg_type = data.get('type', '')
                    
                    # Handle server handshake - must receive this before sending audio
                    if msg_type == 'conversation_initiation_metadata':
                        self.elevenlabs_ready = True
                        # Extract conversation_id for later CallRecord update
                        self.elevenlabs_conversation_id = data.get('conversation_id')
                        logger.info(f"[ELEVENLABS] Session started - conversation_id: {self.elevenlabs_conversation_id}")
                    
                    elif msg_type == 'audio':
                        # ElevenLabs sends audio chunks - format may vary
                        audio_base64 = None
                        
                        # Check various possible formats
                        if 'audio_event' in data and isinstance(data['audio_event'], dict):
                            audio_base64 = data['audio_event'].get('audio_base_64', '') or data['audio_event'].get('chunk', '')
                        elif 'audio_event' in data and isinstance(data['audio_event'], str):
                            audio_base64 = data['audio_event']
                        elif 'audio' in data and isinstance(data['audio'], dict):
                            audio_base64 = data['audio'].get('chunk', '') or data['audio'].get('data', '')
                        elif 'audio' in data and isinstance(data['audio'], str):
                            audio_base64 = data['audio']
                        elif 'audio_chunk' in data:
                            audio_base64 = data['audio_chunk']
                        elif 'data' in data:
                            audio_base64 = data['data']
                        
                        if audio_base64:
                            # ElevenLabs sends PCM 16kHz by default
                            # Smartflo expects mulaw 8kHz - we need to convert!
                            pcm_audio = base64.b64decode(audio_base64)
                            
                            # Convert PCM 16kHz to PCM 8kHz (downsample)
                            pcm_8k = downsample_16k_to_8k(pcm_audio)
                            
                            # Amplify the audio (boost volume by 2.5x)
                            pcm_8k_loud = amplify_pcm(pcm_8k, gain=2.5)
                            
                            # Convert PCM to mulaw
                            mulaw_audio = pcm_to_mulaw(pcm_8k_loud)
                            
                            # Stream in 160-byte chunks (standard 20ms) for smoother playback on telephony
                            CHUNK_SIZE = 160
                            for i in range(0, len(mulaw_audio), CHUNK_SIZE):
                                chunk = mulaw_audio[i:i + CHUNK_SIZE]
                                await self.send_audio_to_smartflo(
                                    base64.b64encode(chunk).decode('utf-8')
                                )
                    
                    elif msg_type == 'ping':
                        # Health check - respond with pong including event_id
                        event_id = data.get('event_id', data.get('ping_event', {}).get('event_id'))
                        if event_id is not None:
                            await self.elevenlabs_ws.send(json.dumps({"type": "pong", "event_id": event_id}))
                        else:
                            await self.elevenlabs_ws.send(json.dumps({"type": "pong"}))
                            
                    elif msg_type == 'agent_response':
                        # Log what the agent said
                        event_data = data.get('agent_response_event', {})
                        text = event_data.get('agent_response', '') or data.get('agent_response_text', '')
                        if text:
                            logger.info(f"[ELEVENLABS] Agent said: {text[:100]}...")
                            
                    elif msg_type == 'user_transcript':
                        # Log what the caller said
                        event_data = data.get('user_transcription_event', {})
                        text = event_data.get('user_transcript', '') or data.get('user_transcript', '')
                        if text:
                            logger.info(f"[ELEVENLABS] User said: {text[:100]}...")
                            
                except json.JSONDecodeError:
                    pass
                except Exception as e:
                    logger.error(f"[ELEVENLABS] Processing error: {e}")
                    
        except Exception as e:
            logger.error(f"[ELEVENLABS] Listener error: {e}")
        finally:
            logger.info("[ELEVENLABS] Listener stopped")

    async def send_audio_to_smartflo(self, audio_base64):
        """Send audio chunk to Smartflo"""
        try:
            await self.send(text_data=json.dumps({
                "event": "media",
                "media": {
                    "payload": audio_base64
                }
            }))
        except Exception as e:
            logger.error(f"Error sending to Smartflo: {e}")
