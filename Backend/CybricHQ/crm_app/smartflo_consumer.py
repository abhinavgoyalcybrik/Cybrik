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


def pcm16000_to_mulaw8000(pcm_bytes: bytes) -> bytes:
    """Convert 16-bit PCM at 16000Hz to μ-law at 8000Hz.
    
    Steps:
    1. Downsample from 16000Hz to 8000Hz (take every other sample)
    2. Convert from 16-bit PCM to 8-bit μ-law
    
    Args:
        pcm_bytes: Raw PCM audio, 16-bit signed, 16000Hz mono
        
    Returns:
        μ-law encoded audio at 8000Hz
    """
    if len(pcm_bytes) < 4:
        return b''
    
    # Each sample is 2 bytes (16-bit), ensure even length
    if len(pcm_bytes) % 2 != 0:
        pcm_bytes = pcm_bytes[:-1]
    
    # Unpack all 16-bit samples
    num_samples = len(pcm_bytes) // 2
    samples = struct.unpack(f'<{num_samples}h', pcm_bytes)
    
    # Downsample: take every other sample (16000 -> 8000 Hz)
    downsampled = samples[::2]
    
    # Convert each sample to μ-law
    mulaw_bytes = []
    for sample in downsampled:
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
        self.input_chunk_number = 0
        self.output_chunk_number = 0
        self.elevenlabs_ws = None
        
        # Lead context for ElevenLabs dynamic variables
        self.lead_context = {}
        
        # Audio buffer for Smartflo (must send 160-byte multiples)
        self.audio_buffer = bytearray()
        
        # Flag to track when ElevenLabs is ready to receive audio
        self.elevenlabs_ready = False
        
        # Output Audio Buffer (ElevenLabs -> Smartflo)
        # Smartflo requires audio payloads to be 160 bytes or multiples (160, 320, 480, 800, etc.)
        # Using 800 bytes (100ms) for smooth playback
        self.output_audio_buffer = bytearray()
        self.OUTPUT_CHUNK_SIZE = 800  # 100ms of 8kHz mulaw = 800 bytes
        self.media_chunk_number = 0  # Required 'chunk' field for Smartflo media messages

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
        
        ElevenLabs dashboard is set to μ-law 8000 Hz, so we pass audio directly.
        No conversion needed!
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
            # Buffer limit check to avoid memory blowup
            if len(self.input_audio_buffer) > 32000: 
                 self.input_audio_buffer = self.input_audio_buffer[-32000:]
            return
        
        # Send audio in 160-byte chunks (20ms of 8kHz mulaw) for real-time feel
        CHUNK_SIZE = 160
        
        while len(self.input_audio_buffer) >= CHUNK_SIZE:
            try:
                chunk = bytes(self.input_audio_buffer[:CHUNK_SIZE])
                self.input_audio_buffer = self.input_audio_buffer[CHUNK_SIZE:]
                
                # Send raw mulaw directly - ElevenLabs expects μ-law 8000
                await self.elevenlabs_ws.send(json.dumps({
                    "user_audio_chunk": base64.b64encode(chunk).decode('utf-8')
                }))
                
                self.input_chunk_number += 1
                if self.input_chunk_number <= 5:
                    logger.info(f"[SMARTFLO->11LABS] Sent input chunk #{self.input_chunk_number}: {len(chunk)} bytes")
                elif self.input_chunk_number % 50 == 0:
                    logger.info(f"[SMARTFLO] Sent μ-law chunk #{self.input_chunk_number}")
                    
            except Exception as e:
                logger.error(f"[SMARTFLO] Error forwarding audio: {e}")
                break

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

    def _update_call_completion_sync(self, call_record_id, conversation_id=None):
        """Update CallRecord to completed status (Synchronous - call via database_sync_to_async)"""
        from crm_app.models import CallRecord
        from django.db import close_old_connections
        close_old_connections()
        
        try:
            call_record = CallRecord.objects.filter(id=call_record_id).first()
            if call_record:
                call_record.status = 'completed'
                if conversation_id:
                    call_record.metadata = call_record.metadata or {}
                    call_record.metadata['conversation_id'] = conversation_id
                    call_record.external_call_id = conversation_id
                call_record.save()
                logger.info(f"Updated CallRecord {call_record_id} to completed status")
        except Exception as e:
            logger.error(f"Error updating CallRecord DB op: {e}")

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
        
        if payload:
            try:
                # Decode mulaw audio from Smartflo (base64 -> bytes)
                mulaw_audio = base64.b64decode(payload)
                
                # Forward to handle_binary_audio which manages the ElevenLabs connection
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
        
        # First flush any remaining audio in the output buffer
        try:
            await self.flush_audio_buffer()
        except Exception as e:
            logger.error(f"Error flushing audio buffer: {e}")
        
        # Update CallRecord with completed status
        try:
            call_record_id = self.lead_context.get('call_record_id')
            conversation_id = getattr(self, 'elevenlabs_conversation_id', None)
            
            if call_record_id:
                await database_sync_to_async(self._update_call_completion_sync)(call_record_id, conversation_id)
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
            
            # Send conversation initiation with dynamic variables and audio format configs
            # CRITICAL: We must specify BOTH input AND output formats!
            # - user_input_audio_format: what WE send to ElevenLabs (from Smartflo)
            # - conversation_config.agent.tts.output_format: what ElevenLabs sends to US
            init_message = {
                "type": "conversation_initiation_client_data",
                "dynamic_variables": dynamic_vars,
                "user_input_audio_format": "ulaw_8000",
                "conversation_config_override": {
                    "agent": {
                        "tts": {
                            "output_format": "ulaw_8000"  # CRITICAL: Must match Smartflo expected format!
                        }
                    }
                }
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
                    
                    
                    # LOG ALL FLAGS to debug missing audio
                    # if msg_type != 'audio':
                    logger.info(f"[ELEVENLABS] Received type: {msg_type}")
                    if msg_type == 'audio':
                         logger.debug(f"[ELEVENLABS] Audio keys: {list(data.keys())}")
                         if 'audio_event' in data:
                             logger.debug(f"[ELEVENLABS] Audio event keys: {list(data['audio_event'].keys())}")
                    
                    # Handle server handshake - must receive this before sending audio
                    if msg_type == 'conversation_initiation_metadata':
                        self.elevenlabs_ready = True
                        # Extract conversation_id for later CallRecord update
                        self.elevenlabs_conversation_id = data.get('conversation_id')
                        logger.info(f"[ELEVENLABS] Server handshake complete - conversation_id: {self.elevenlabs_conversation_id}")
                        # Log server's expected audio format
                        input_format = data.get('user_input_audio_format', 'unknown')
                        # Also log the output format from the metadata event
                        metadata_event = data.get('conversation_initiation_metadata_event', {})
                        output_format = metadata_event.get('agent_output_audio_format', 'unknown')
                        logger.info(f"[ELEVENLABS] Audio formats - INPUT: {input_format}, OUTPUT: {output_format}")
                        print(f"[DEBUG] ElevenLabs Audio: input={input_format}, output={output_format}")
                    
                    elif msg_type == 'audio':
                        # ElevenLabs dashboard is set to μ-law 8000 Hz
                        # Smartflo expects μ-law 8000 - direct pass-through!
                        audio_base64 = None
                        
                        if 'audio_event' in data and isinstance(data['audio_event'], dict):
                            audio_base64 = data['audio_event'].get('audio_base_64', '') or data['audio_event'].get('chunk', '')
                        elif 'audio' in data and isinstance(data['audio'], dict):
                            audio_base64 = data['audio'].get('chunk', '') or data['audio'].get('data', '')
                        elif 'audio' in data and isinstance(data['audio'], str):
                            audio_base64 = data['audio']
                        elif 'data' in data:
                            audio_base64 = data['data']
                        
                        if audio_base64:
                            # ElevenLabs outputs PCM 16000Hz, Smartflo expects μ-law 8000Hz
                            # We MUST convert the audio format!
                            raw_pcm = base64.b64decode(audio_base64)
                            
                            self.output_chunk_number += 1
                            if self.output_chunk_number <= 5:
                                logger.info(f"[ELEVENLABS] PCM chunk {self.output_chunk_number}: {len(raw_pcm)} bytes (16kHz)")
                            
                            # Convert PCM 16000Hz -> μ-law 8000Hz
                            mulaw_audio = pcm16000_to_mulaw8000(raw_pcm)
                            
                            if self.output_chunk_number <= 5:
                                logger.info(f"[ELEVENLABS] Converted to μ-law: {len(mulaw_audio)} bytes (8kHz)")
                            
                            # Send converted audio to Smartflo
                            if mulaw_audio:
                                await self.send_audio_to_smartflo(mulaw_audio)
                            
                            if self.output_chunk_number % 100 == 0:
                                logger.info(f"[ELEVENLABS] Converted and sent {self.output_chunk_number} chunks")
                        else:
                            logger.warning(f"[ELEVENLABS] audio message but no data: {list(data.keys())}")
                    
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
                        # Already mulaw bytes, send directly
                        await self.send_audio_to_smartflo(message)
                except Exception as e:
                    logger.exception(f"[ELEVENLABS] Error handling ElevenLabs message: {e}")
                    print(f"[DEBUG] CRITICAL ERROR IN ELEVENLABS LISTENER: {e}")
                        
        except Exception as e:
            logger.error(f"[ELEVENLABS] Agent listening error: {e}")
            
    async def send_audio_to_smartflo(self, audio_data: bytes):
        """Buffer and send audio to Smartflo in proper 160-byte aligned chunks.
        
        Per Smartflo docs: 'the payload of media received from the vendor should 
        at least be of 160 bytes or a multiple of 160 bytes. In case the payload 
        is not a multiple of 160 bytes, audio gaps might occur.'
        
        We buffer to 800 bytes (100ms) for smooth playback.
        """
        if not audio_data:
            return
        
        # Add to output buffer
        self.output_audio_buffer.extend(audio_data)
        
        # Send when we have enough data (800 bytes = 100ms)
        while len(self.output_audio_buffer) >= self.OUTPUT_CHUNK_SIZE:
            chunk = bytes(self.output_audio_buffer[:self.OUTPUT_CHUNK_SIZE])
            self.output_audio_buffer = self.output_audio_buffer[self.OUTPUT_CHUNK_SIZE:]
            
            self.media_chunk_number += 1
            
            # Smartflo requires 'chunk' field in media messages
            message = {
                "event": "media",
                "streamSid": self.stream_sid,
                "media": {
                    "payload": base64.b64encode(chunk).decode('utf-8'),
                    "chunk": self.media_chunk_number  # Required by Smartflo!
                }
            }
            await self.send(text_data=json.dumps(message))
            
            if self.media_chunk_number <= 5:
                logger.info(f"[SMARTFLO] Sent media chunk #{self.media_chunk_number}: {len(chunk)} bytes")
            elif self.media_chunk_number % 50 == 0:
                logger.info(f"[SMARTFLO] Sent {self.media_chunk_number} media chunks")
    
    async def flush_audio_buffer(self):
        """Flush any remaining audio in output buffer (call on disconnect).
        
        Pads to 160-byte alignment if needed to avoid audio gaps.
        """
        if not self.output_audio_buffer:
            return
            
        remaining = bytes(self.output_audio_buffer)
        self.output_audio_buffer.clear()
        
        # Pad to 160-byte alignment if needed
        if len(remaining) % 160 != 0:
            padding_needed = 160 - (len(remaining) % 160)
            # Pad with silence (0x7F in mulaw = near-zero amplitude)
            remaining = remaining + bytes([0x7F] * padding_needed)
        
        if remaining:
            self.media_chunk_number += 1
            message = {
                "event": "media",
                "streamSid": self.stream_sid,
                "media": {
                    "payload": base64.b64encode(remaining).decode('utf-8'),
                    "chunk": self.media_chunk_number
                }
            }
            await self.send(text_data=json.dumps(message))
            logger.info(f"[SMARTFLO] Flushed final audio chunk #{self.media_chunk_number}: {len(remaining)} bytes")
        
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
