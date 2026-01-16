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
        

        # Input Jitter Buffer (User -> ElevenLabs)
        # Buffer incoming audio to send larger chunks (smooths out jitter)
        self.input_audio_buffer = bytearray()
        self.INPUT_CHUNK_SIZE = 160  # 20ms of 8kHz mulaw - faster response time

    async def connect(self):
        """Accept WebSocket connection from Smartflo"""
        try:
            # Log scope details for debugging
            scope = self.scope
            logger.info("[DEBUG] " + "=" * 50)
            logger.info(f"[DEBUG] Connection scope type: {scope.get('type')}")
            logger.info(f"[DEBUG] Connection path: {scope.get('path')}")
            logger.info(f"[DEBUG] Query string: {scope.get('query_string')}")
            logger.info(f"[DEBUG] Headers count: {len(scope.get('headers', []))}")
            
            # Log all headers for debugging
            for header in scope.get('headers', []):
                try:
                    name = header[0].decode('utf-8') if isinstance(header[0], bytes) else header[0]
                    value = header[1].decode('utf-8') if isinstance(header[1], bytes) else header[1]
                    logger.info(f"[DEBUG] Header: {name} = {value[:100]}..." if len(str(value)) > 100 else f"[DEBUG] Header: {name} = {value}")
                except Exception as he:
                    logger.error(f"[DEBUG] Error decoding header: {he}")
            
            # Accept the connection
            await self.accept()
            logger.info("[DEBUG] " + "=" * 50)
            logger.info("[SMARTFLO] WebSocket CONNECTED and ACCEPTED - Waiting for audio stream...")
            logger.info("[DEBUG] Connection accepted successfully, now waiting for events...")
            logger.info("[DEBUG] " + "=" * 50)
            
        except Exception as e:
            logger.exception(f"[DEBUG] CRITICAL: Error in connect(): {e}")
            raise
        
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        import traceback
        logger.info("[DEBUG] " + "=" * 50)
        logger.info(f"[DEBUG] DISCONNECT called with close_code: {close_code}")
        logger.info(f"[DEBUG] Stream SID was: {self.stream_sid}")
        logger.info(f"[DEBUG] Call SID was: {self.call_sid}")
        logger.info(f"[DEBUG] ElevenLabs connected: {self.elevenlabs_ws is not None}")
        logger.info(f"[DEBUG] ElevenLabs ready: {self.elevenlabs_ready}")
        logger.info(f"[DEBUG] Traceback: {traceback.format_stack()}")
        logger.info("[DEBUG] " + "=" * 50)
        
        if self.elevenlabs_ws:
            try:
                await self.elevenlabs_ws.close()
                logger.info("[DEBUG] ElevenLabs WS closed successfully")
            except Exception as e:
                logger.error(f"[DEBUG] Error closing ElevenLabs WS: {e}")
            
    async def receive(self, text_data=None, bytes_data=None):
        """Handle incoming messages from Smartflo"""
        logger.info(f"[DEBUG] receive() called - text_data: {text_data is not None}, bytes_data: {bytes_data is not None}")
        
        try:
            # Debug: Log all incoming data
            if bytes_data:
                logger.info(f"[DEBUG] Received BINARY data: {len(bytes_data)} bytes")
                # Handle raw binary audio (mulaw) directly from Smartflo
                await self.handle_binary_audio(bytes_data)
                return
            
            if text_data:
                print(f"[DEBUG] SMARTFLO TEXT: {text_data[:200]}...")
                logger.info(f"[SMARTFLO] Received TEXT: {text_data[:300]}...")
                try:
                    message = json.loads(text_data)
                    event = message.get('event')
                    print(f"[DEBUG] SMARTFLO EVENT: {event}")
                    logger.info(f"[SMARTFLO] Event type: {event}")
                    
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
                        logger.warning(f"[SMARTFLO] Full message keys: {list(message.keys())}")
                        
                except json.JSONDecodeError as e:
                    logger.error(f"[SMARTFLO] Invalid JSON: {e}")
                    logger.error(f"[SMARTFLO] Raw text: {text_data[:200]}")
                except Exception as e:
                    logger.exception(f"[SMARTFLO] Error handling event: {e}")
                    print(f"[DEBUG] CRITICAL ERROR IN CONSUMER: {e}")
        except Exception as e:
            logger.exception(f"[DEBUG] CRITICAL: Unhandled exception in receive(): {e}")


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
                
                # Convert: Mulaw 8k -> PCM 16k -> Amplify for clarity
                pcm_8k = mulaw_to_pcm(chunk_to_process)
                pcm_16k = upsample_8k_to_16k(pcm_8k)
                # Amplify input audio for better recognition (phone audio is often quiet)
                pcm_16k = amplify_pcm(pcm_16k, gain=3.0)
                
                await self.elevenlabs_ws.send(json.dumps({
                    "user_audio_chunk": base64.b64encode(pcm_16k).decode('utf-8')
                }))
                
                self.chunk_number += 1
                if self.chunk_number % 20 == 0:
                    logger.info(f"[SMARTFLO] Forwarded input chunk #{self.chunk_number} ({len(chunk_to_process)} bytes)")
                    
            except Exception as e:
                logger.error(f"[SMARTFLO] Error forwarding audio: {e}")
                # Don't lose the buffer if error was transient? No, safest to clear to avoid lag loop
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
            
        logger.info(f"[SMARTFLO] searching DB for lead with candidates: {candidates}")
        
        for candidate in candidates:
            lead = Lead.objects.filter(phone=candidate).first()
            if lead:
                logger.info(f"[SMARTFLO] Found Lead in DB: {lead.id} - {lead.name}")
                return build_lead_context(lead)
                
        logger.warning("[SMARTFLO] No Lead found in DB for number")
        return None

    async def handle_start(self, message):
        """Handle stream start with metadata"""
        start_data = message.get('start', {})
        self.stream_sid = message.get('streamSid')
        self.call_sid = start_data.get('callSid')
        self.caller_from = start_data.get('from')
        self.caller_to = start_data.get('to')
        
        # 1. Start with custom params from Smartflo (least reliable)
        raw_custom_params = start_data.get('customParameters', {})
        logger.info(f"[SMARTFLO] Raw custom params: {raw_custom_params}")
        
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
        # But this is outbound logic mainly. 
        customer_number = self.caller_to
        
        # If it looks like a short code or agent number, try 'from' (in case of inbound)
        if len(str(customer_number)) < 6:
             customer_number = self.caller_from
             
        db_context = await self.get_lead_from_db(customer_number)
        
        if db_context:
            logger.info("[SMARTFLO] Merging DB context over custom params")
            # Update lead_context with DB data, but allow some overrides if needed
            # Actually, DB data should generally win for core fields
            lead_context.update(db_context)
        else:
            logger.info("[SMARTFLO] Using fallback/defaults (No DB match)")
            
        self.lead_context = lead_context
        
        lead_name = lead_context.get('name', 'Unknown')
        logger.info(f"Call started: {self.caller_from} -> {self.caller_to}")
        logger.info(f"Final Lead Context: {self.lead_context}")
        
        # Connect to ElevenLabs Conversational AI Agent
        await self.connect_elevenlabs_agent()
        
    async def handle_media(self, message):
        """Forward incoming audio from caller to ElevenLabs Agent"""
        media = message.get('media', {})
        payload = media.get('payload', '')
        
        if payload and self.elevenlabs_ws:
            # Note: We do NOT check self.elevenlabs_ready here anymore.
            # We pass everything to handle_binary_audio which handles buffering
            # while waiting for the handshake.
                
            try:
                # Decode mulaw audio from Smartflo (base64 -> bytes)
                mulaw_audio = base64.b64decode(payload)
                
                # Buffer and process via common logic (reuse handle_binary_audio logic)
                # But handle_binary_audio is async and expects bytes... 
                # Let's direct call logic to avoid overhead or just call handle_binary_audio since it's cleaner
                await self.handle_binary_audio(mulaw_audio)
                
            except Exception as e:
                logger.error(f"Error sending to ElevenLabs: {e}")
                
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
        logger.debug(f"Mark received: {name}")
        
    async def connect_elevenlabs_agent(self):
        """
        Connect to ElevenLabs Conversational AI Agent.
        
        This agent already has your knowledge base and handles the full conversation.
        We pass lead context as dynamic variables.
        """
        import websockets
        
        api_key = getattr(settings, 'ELEVENLABS_API_KEY', None)
        agent_id = getattr(settings, 'ELEVENLABS_AGENT_ID', None)
        
        # ====== DEBUG: Log configuration ======
        print(f"[DEBUG] ====== ELEVENLABS CONNECTION START ======")
        print(f"[DEBUG] Agent ID: {agent_id}")
        print(f"[DEBUG] API Key present: {bool(api_key)}")
        print(f"[DEBUG] Lead context keys: {list(self.lead_context.keys())}")
        logger.info(f"[ELEVENLABS] Connecting with agent_id={agent_id}")
        
        if not api_key or not agent_id:
            print(f"[DEBUG] ERROR: Missing API key or Agent ID!")
            logger.error("ElevenLabs API key or Agent ID not configured")
            return
            
        try:
            # ElevenLabs Conversational AI Agent WebSocket endpoint
            ws_url = f"wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_id}"
            print(f"[DEBUG] Connecting to: {ws_url}")
            
            # Headers for authentication
            headers = {"xi-api-key": api_key}
            
            # Try different websockets library versions for compatibility
            try:
                # Newer websockets versions (11+) use additional_headers
                self.elevenlabs_ws = await websockets.connect(
                    ws_url,
                    additional_headers=headers
                )
                print(f"[DEBUG] WebSocket connected (using additional_headers)")
            except TypeError:
                # Older websockets versions use extra_headers
                self.elevenlabs_ws = await websockets.connect(
                    ws_url,
                    extra_headers=headers
                )
                print(f"[DEBUG] WebSocket connected (using extra_headers)")
            
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
            
            # ====== DEBUG: Log all dynamic variables ======
            print(f"[DEBUG] ====== DYNAMIC VARIABLES ======")
            for key, value in dynamic_vars.items():
                print(f"[DEBUG]   {key}: {value}")
            logger.info(f"[ELEVENLABS] Dynamic variables: {dynamic_vars}")
            
            # Send conversation initiation with dynamic variables and audio formats
            init_message = {
                "type": "conversation_initiation_client_data",
                "conversation_config_override": {
                    "agent": {
                        "language": "en"
                    },
                    "asr": {
                        "quality": "high",
                        "experimental": {
                            "input_audio_noise_suppression": True
                        }
                    }
                },
                "audio_input_format": "pcm_16000",
                "dynamic_variables": dynamic_vars
            }
            
            print(f"[DEBUG] Sending init message: {json.dumps(init_message, indent=2)}")
            await self.elevenlabs_ws.send(json.dumps(init_message))
            print(f"[DEBUG] Init message sent successfully!")
            
            # Start listening for ElevenLabs Agent responses
            asyncio.create_task(self.listen_elevenlabs_agent())
            
            print(f"[DEBUG] ====== ELEVENLABS CONNECTION SUCCESS ======")
            logger.info(f"Connected to ElevenLabs Agent: {agent_id}")
            
        except Exception as e:
            logger.error(f"Failed to connect to ElevenLabs Agent: {e}")
            
    def _build_dynamic_prompt(self) -> str:
        """Build dynamic context to inject into the agent's prompt"""
        parts = []
        
        name = self.lead_context.get('name', '')
        if name:
            parts.append(f"The caller's name is {name}.")
            
        city = self.lead_context.get('city', '')
        country = self.lead_context.get('country', '')
        if city or country:
            location = f"{city}{', ' if city and country else ''}{country}"
            parts.append(f"They are from {location}.")
            
        interest = self.lead_context.get('interested_service', '')
        if interest:
            parts.append(f"They are interested in: {interest}.")
            
        qualification = self.lead_context.get('highest_qualification', '')
        marks = self.lead_context.get('qualification_marks', '')
        if qualification:
            qual_str = qualification
            if marks:
                qual_str += f" with {marks}"
            parts.append(f"Their highest qualification: {qual_str}.")
            
        english = self.lead_context.get('english_test_scores', '')
        if english and english != 'Not provided':
            parts.append(f"English test scores: {english}.")
            
        message = self.lead_context.get('message', '')
        if message:
            parts.append(f"Their inquiry: {message}")
        
        if parts:
            return "CALLER CONTEXT: " + " ".join(parts)
        return ""
            
    async def listen_elevenlabs_agent(self):
        """
        Listen for responses from ElevenLabs Agent and forward audio to Smartflo.
        """
        try:
            async for message in self.elevenlabs_ws:
                try:
                    data = json.loads(message)
                    msg_type = data.get('type', '')
                    
                    # Debug: log all message types received
                    if msg_type != 'audio':
                        logger.info(f"[ELEVENLABS] Received type: {msg_type}")
                    
                    # Handle server handshake - must receive this before sending audio
                    if msg_type == 'conversation_initiation_metadata':
                        self.elevenlabs_ready = True
                        # Extract conversation_id for later CallRecord update
                        self.elevenlabs_conversation_id = data.get('conversation_id')
                        logger.info(f"[ELEVENLABS] Server handshake complete - conversation_id: {self.elevenlabs_conversation_id}")
                        # Log server's expected audio format
                        input_format = data.get('user_input_audio_format', 'unknown')
                        logger.info(f"[ELEVENLABS] Expected input format: {input_format}")
                    
                    elif msg_type == 'audio':
                        # ElevenLabs sends audio chunks - format may vary
                        # Try multiple possible locations for audio data
                        audio_base64 = None
                        
                        # Check various possible formats
                        if 'audio_event' in data and isinstance(data['audio_event'], dict):
                            # ElevenLabs Conversational AI format
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
                            
                            # Log for debugging
                            self.chunk_number += 1
                            if self.chunk_number <= 5:
                                print(f"[DEBUG] ELEVENLABS AUDIO: chunk {self.chunk_number}, PCM size={len(pcm_audio)} bytes")
                                logger.info(f"[ELEVENLABS] Audio chunk {self.chunk_number}: PCM size={len(pcm_audio)} bytes")
                            
                            # Convert PCM 16kHz to PCM 8kHz (downsample)
                            pcm_8k = downsample_16k_to_8k(pcm_audio)
                            
                            # Amplify the audio (boost volume by 2.5x)
                            pcm_8k_loud = amplify_pcm(pcm_8k, gain=2.5)
                            
                            # Convert PCM to mulaw
                            mulaw_audio = pcm_to_mulaw(pcm_8k_loud)
                            
                            # debug sizes
                            if self.chunk_number <= 5:
                                print(f"[DEBUG] After conversion: mulaw size={len(mulaw_audio)} bytes")
                            
                            # Stream in 160-byte chunks (standard 20ms) for smoother playback on telephony
                            CHUNK_SIZE = 160
                            for i in range(0, len(mulaw_audio), CHUNK_SIZE):
                                chunk = mulaw_audio[i:i + CHUNK_SIZE]
                                await self.send_audio_to_smartflo(
                                    base64.b64encode(chunk).decode('utf-8')
                                )
                                # No artificial sleep - send as fast as we process but in small chunks
                                # The network stack handles the pacing mostly, or Smartflo buffers.
                                # Adding sleep for 20ms audio (0.02s) might cause gaps if processing is slow.
                                # Let's try sending without sleep first, or very minimal.
                            
                            if self.chunk_number % 50 == 0:
                                logger.info(f"[ELEVENLABS] Processed output chunk")
                        else:
                            logger.warning(f"[ELEVENLABS] audio message but no data found: {list(data.keys())}")
                    
                    elif msg_type == 'ping':
                        # Health check - respond with pong including event_id
                        event_id = data.get('event_id', data.get('ping_event', {}).get('event_id'))
                        if event_id is not None:
                            await self.elevenlabs_ws.send(json.dumps({"type": "pong", "event_id": event_id}))
                        else:
                            await self.elevenlabs_ws.send(json.dumps({"type": "pong"}))
                            
                    elif msg_type == 'agent_response':
                        # Log what the agent said
                        # Per ElevenLabs docs: agent_response_event.agent_response
                        event_data = data.get('agent_response_event', {})
                        text = event_data.get('agent_response', '') or data.get('agent_response_text', '')
                        if text:
                            logger.info(f"[ELEVENLABS] Agent said: {text[:100]}...")
                            
                    elif msg_type == 'user_transcript':
                        # Log what the caller said
                        # Per ElevenLabs docs: user_transcription_event.user_transcript
                        event_data = data.get('user_transcription_event', {})
                        text = event_data.get('user_transcript', '') or data.get('user_transcript', '')
                        if text:
                            logger.info(f"[ELEVENLABS] Caller said: {text}")
                    
                    elif msg_type == 'conversation_initiation_metadata':
                        # Get audio format info
                        meta = data.get('conversation_initiation_metadata_event', {})
                        logger.info(f"[ELEVENLABS] Audio format: output={meta.get('agent_output_audio_format')}, input={meta.get('user_input_audio_format')}")
                            
                    elif msg_type == 'conversation_end':
                        logger.info("[ELEVENLABS] Agent ended conversation")
                        break
                        
                except json.JSONDecodeError:
                    # Might be binary audio data (already mulaw from ElevenLabs)
                    if isinstance(message, bytes):
                        logger.info(f"[ELEVENLABS] Received binary audio: {len(message)} bytes")
                        # Already mulaw, just base64 encode and send
                        await self.send_audio_to_smartflo(
                            base64.b64encode(message).decode('utf-8')
                        )
                except Exception as e:
                    logger.exception(f"[ELEVENLABS] Error handling ElevenLabs message: {e}")
                    print(f"[DEBUG] CRITICAL ERROR IN ELEVENLABS LISTENER: {e}")
                        
        except Exception as e:
            logger.error(f"[ELEVENLABS] Agent listening error: {e}")
            
    async def send_audio_to_smartflo(self, audio_b64: str):
        """Send audio back to Smartflo (to caller's phone)"""
        self.chunk_number += 1
        
        message = {
            "event": "media",
            "streamSid": self.stream_sid,
            "media": {
                "payload": audio_b64,
                "chunk": self.chunk_number
            }
        }
        
        await self.send(text_data=json.dumps(message))
        
    async def send_mark(self, name: str):
        """Send mark event to Smartflo"""
        message = {
            "event": "mark",
            "streamSid": self.stream_sid,
            "mark": {"name": name}
        }
        await self.send(text_data=json.dumps(message))
        
    async def send_clear(self):
        """Send clear event to interrupt audio"""
        message = {
            "event": "clear",
            "streamSid": self.stream_sid
        }
        await self.send(text_data=json.dumps(message))
