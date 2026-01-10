"""
IELTS Speaking Test WebSocket Consumer

Handles real-time audio streaming for IELTS Speaking tests.
Follows strict IELTS examiner behavior:
- Silent listening during speaking
- No interruption
- Evaluation only after speaking ends

Protocol:
    Client -> Server:
        {"type": "start", "session_id": "...", "part": 1, "question_index": 0, "question_text": "..."}
        {"type": "audio", "data": "<base64 PCM audio>"}
        {"type": "stop"}
    
    Server -> Client:
        {"type": "started", "response_id": "..."}
        {"type": "status", "speech_detected": true, "speaking_time_ms": 1234, "pause_count": 2}
        {"type": "boundary_detected", "reason": "silence_threshold"}
        {"type": "transcription_complete", "transcript": "...", "word_count": 45}
        {"type": "analysis_complete", "evaluation": {...}}
        {"type": "error", "message": "..."}
"""

import json
import base64
import asyncio
import logging
import struct
import io
import os
import tempfile
from datetime import datetime
from typing import Optional, List
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)


# IELTS Part-specific configuration
IELTS_CONFIG = {
    1: {
        'name': 'Introduction and Interview',
        'time_limit_ms': 5 * 60 * 1000,  # 5 minutes
        'silence_threshold_ms': 3000,     # 3 seconds
        'questions_per_topic': 4,
    },
    2: {
        'name': 'Long Turn',
        'time_limit_ms': 2 * 60 * 1000,   # 2 minutes speaking
        'prep_time_ms': 60 * 1000,        # 1 minute preparation
        'silence_threshold_ms': 5000,     # 5 seconds
    },
    3: {
        'name': 'Two-way Discussion',
        'time_limit_ms': 5 * 60 * 1000,   # 5 minutes
        'silence_threshold_ms': 4000,     # 4 seconds
    }
}

# Audio configuration
SAMPLE_RATE = 16000  # 16kHz for Whisper
CHANNELS = 1
BYTES_PER_SAMPLE = 2  # 16-bit PCM
CHUNK_DURATION_MS = 100  # Process audio in 100ms chunks

# VAD thresholds
SPEECH_RMS_THRESHOLD = 500  # RMS amplitude threshold for speech detection
SILENCE_RMS_THRESHOLD = 200  # Below this is definitely silence


class IELTSSpeakingConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for IELTS Speaking tests.
    Handles real-time audio streaming, VAD, and post-speech analysis.
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Session state
        self.session_id: Optional[str] = None
        self.response_id: Optional[str] = None
        self.user = None
        self.current_part: int = 1
        self.question_index: int = 0
        self.question_text: str = ""
        
        # Audio buffer
        self.audio_buffer: List[bytes] = []
        self.total_audio_bytes: int = 0
        
        # Timing
        self.start_time: Optional[datetime] = None
        self.last_speech_time: Optional[datetime] = None
        
        # Real-time metrics
        self.total_speaking_time_ms: int = 0
        self.total_silence_time_ms: int = 0
        self.pause_count: int = 0
        self.current_pause_start: Optional[datetime] = None
        self.pause_durations: List[int] = []
        self.max_pause_ms: int = 0
        self.long_pause_count: int = 0  # Pauses > 2 seconds
        
        # VAD state
        self.is_speaking: bool = False
        self.speech_started: bool = False
        self.consecutive_silence_chunks: int = 0
        self.amplitude_samples: List[float] = []
        
        # Status
        self.is_active: bool = False
        self.is_analyzing: bool = False
    
    async def connect(self):
        """Accept WebSocket connection."""
        await self.accept()
        logger.info("IELTS Speaking WebSocket connected")
        
        # Get user from scope (if authenticated)
        self.user = self.scope.get('user')
        if self.user and not self.user.is_authenticated:
            self.user = None
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        logger.info(f"IELTS Speaking WebSocket disconnected: {close_code}")
        
        # If we have an active response, save partial data
        if self.is_active and self.response_id:
            await self._save_partial_response()
    
    async def receive(self, text_data=None, bytes_data=None):
        """Handle incoming messages."""
        try:
            if bytes_data:
                # Binary audio data
                await self._handle_audio_chunk(bytes_data)
            elif text_data:
                message = json.loads(text_data)
                msg_type = message.get('type')
                
                if msg_type == 'start':
                    await self._handle_start(message)
                elif msg_type == 'audio':
                    # Base64-encoded audio
                    audio_data = base64.b64decode(message.get('data', ''))
                    await self._handle_audio_chunk(audio_data)
                elif msg_type == 'stop':
                    await self._handle_stop(message)
                else:
                    await self._send_error(f"Unknown message type: {msg_type}")
        except json.JSONDecodeError:
            await self._send_error("Invalid JSON message")
        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)
            await self._send_error(str(e))
    
    async def _handle_start(self, message: dict):
        """Initialize a new speaking response."""
        self.session_id = message.get('session_id')
        self.current_part = message.get('part', 1)
        self.question_index = message.get('question_index', 0)
        self.question_text = message.get('question_text', '')
        
        if not self.session_id:
            await self._send_error("session_id is required")
            return
        
        # Reset state
        self._reset_state()
        self.is_active = True
        self.start_time = timezone.now()
        
        # Create database response record
        response = await self._create_response()
        if response:
            self.response_id = str(response.id)
            await self.send(text_data=json.dumps({
                'type': 'started',
                'response_id': self.response_id,
                'part': self.current_part,
                'question_index': self.question_index,
                'config': IELTS_CONFIG.get(self.current_part, {}),
            }))
            
            logger.info(f"Started speaking response: {self.response_id}")
        else:
            await self._send_error("Failed to create response record")
    
    async def _handle_audio_chunk(self, audio_bytes: bytes):
        """Process incoming audio chunk with VAD."""
        if not self.is_active:
            return
        
        # Add to buffer
        self.audio_buffer.append(audio_bytes)
        self.total_audio_bytes += len(audio_bytes)
        
        # Calculate chunk duration
        chunk_samples = len(audio_bytes) // BYTES_PER_SAMPLE
        chunk_duration_ms = (chunk_samples * 1000) // SAMPLE_RATE
        
        # Voice Activity Detection
        rms = self._calculate_rms(audio_bytes)
        self.amplitude_samples.append(rms)
        
        speech_detected = rms > SPEECH_RMS_THRESHOLD
        now = timezone.now()
        
        if speech_detected:
            # Speech detected
            if not self.speech_started:
                self.speech_started = True
                logger.info("First speech detected")
            
            if not self.is_speaking:
                # Transition from silence to speech
                self.is_speaking = True
                
                if self.current_pause_start:
                    # End of pause - record duration
                    pause_duration = int((now - self.current_pause_start).total_seconds() * 1000)
                    self.pause_durations.append(pause_duration)
                    self.total_silence_time_ms += pause_duration
                    
                    if pause_duration > self.max_pause_ms:
                        self.max_pause_ms = pause_duration
                    
                    if pause_duration > 2000:
                        self.long_pause_count += 1
                    
                    self.current_pause_start = None
            
            self.total_speaking_time_ms += chunk_duration_ms
            self.last_speech_time = now
            self.consecutive_silence_chunks = 0
        else:
            # Silence detected
            if self.is_speaking and self.speech_started:
                # Transition from speech to silence
                self.is_speaking = False
                self.pause_count += 1
                self.current_pause_start = now
            elif self.current_pause_start:
                # Continuing silence
                self.consecutive_silence_chunks += 1
        
        # Check for answer boundary (silence threshold)
        if self.speech_started and self._check_boundary():
            await self._finalize_response('silence_threshold')
            return
        
        # Check time limit
        if self._check_time_limit():
            await self._finalize_response('time_limit')
            return
        
        # Send periodic status updates (every ~500ms of audio)
        if len(self.audio_buffer) % 5 == 0:
            await self._send_status()
    
    def _calculate_rms(self, audio_bytes: bytes) -> float:
        """Calculate RMS (Root Mean Square) amplitude for VAD."""
        if len(audio_bytes) < 2:
            return 0.0
        
        try:
            # Unpack 16-bit signed PCM samples
            sample_count = len(audio_bytes) // 2
            samples = struct.unpack(f'<{sample_count}h', audio_bytes[:sample_count * 2])
            
            if not samples:
                return 0.0
            
            # Calculate RMS
            sum_squares = sum(s * s for s in samples)
            rms = (sum_squares / len(samples)) ** 0.5
            return rms
        except Exception as e:
            logger.warning(f"Error calculating RMS: {e}")
            return 0.0
    
    def _check_boundary(self) -> bool:
        """Check if silence threshold is exceeded (answer boundary)."""
        if not self.speech_started or not self.current_pause_start:
            return False
        
        config = IELTS_CONFIG.get(self.current_part, {})
        silence_threshold = config.get('silence_threshold_ms', 3000)
        
        current_silence_ms = int((timezone.now() - self.current_pause_start).total_seconds() * 1000)
        return current_silence_ms >= silence_threshold
    
    def _check_time_limit(self) -> bool:
        """Check if IELTS time limit is exceeded."""
        if not self.start_time:
            return False
        
        config = IELTS_CONFIG.get(self.current_part, {})
        time_limit = config.get('time_limit_ms', 5 * 60 * 1000)
        
        elapsed_ms = int((timezone.now() - self.start_time).total_seconds() * 1000)
        return elapsed_ms >= time_limit
    
    async def _handle_stop(self, message: dict):
        """Handle manual stop from user."""
        if self.is_active:
            await self._finalize_response('manual_stop')
    
    async def _finalize_response(self, end_reason: str):
        """Finalize the speaking response and trigger analysis."""
        if not self.is_active or self.is_analyzing:
            return
        
        self.is_active = False
        self.is_analyzing = True
        
        logger.info(f"Finalizing response: {self.response_id}, reason: {end_reason}")
        
        # Notify client of boundary detection
        await self.send(text_data=json.dumps({
            'type': 'boundary_detected',
            'reason': end_reason,
            'speaking_time_ms': self.total_speaking_time_ms,
            'pause_count': self.pause_count,
        }))
        
        # Assemble audio
        audio_data = b''.join(self.audio_buffer)
        
        # Calculate final metrics
        total_duration_ms = int((timezone.now() - self.start_time).total_seconds() * 1000)
        
        # Save audio file
        audio_saved = await self._save_audio_file(audio_data)
        
        # Update response record with end reason
        await self._update_response(end_reason, total_duration_ms)
        
        # Create metrics record
        await self._create_metrics(total_duration_ms)
        
        # Run transcription (async)
        transcript = await self._run_transcription(audio_data)
        
        if transcript:
            await self.send(text_data=json.dumps({
                'type': 'transcription_complete',
                'transcript': transcript,
                'word_count': len(transcript.split()),
            }))
            
            # Run IELTS evaluation
            await self._run_evaluation(transcript)
        
        self.is_analyzing = False
        
        # Signal completion
        await self.send(text_data=json.dumps({
            'type': 'response_complete',
            'response_id': self.response_id,
        }))
    
    async def _send_status(self):
        """Send real-time status update to client."""
        await self.send(text_data=json.dumps({
            'type': 'status',
            'speech_detected': self.is_speaking,
            'speaking_time_ms': self.total_speaking_time_ms,
            'silence_time_ms': self.total_silence_time_ms,
            'pause_count': self.pause_count,
            'is_active': self.is_active,
        }))
    
    async def _send_error(self, message: str):
        """Send error message to client."""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': message,
        }))
    
    def _reset_state(self):
        """Reset all state for a new response."""
        self.audio_buffer = []
        self.total_audio_bytes = 0
        self.start_time = None
        self.last_speech_time = None
        self.total_speaking_time_ms = 0
        self.total_silence_time_ms = 0
        self.pause_count = 0
        self.current_pause_start = None
        self.pause_durations = []
        self.max_pause_ms = 0
        self.long_pause_count = 0
        self.is_speaking = False
        self.speech_started = False
        self.consecutive_silence_chunks = 0
        self.amplitude_samples = []
        self.is_analyzing = False
    
    # Database operations
    
    @database_sync_to_async
    def _create_response(self):
        """Create a new SpeakingResponse record."""
        from .speaking_models import SpeakingSession, SpeakingResponse
        
        try:
            session = SpeakingSession.objects.get(id=self.session_id)
            
            response = SpeakingResponse.objects.create(
                session=session,
                part=self.current_part,
                question_index=self.question_index,
                question_text=self.question_text,
                status='listening',
                started_at=timezone.now(),
            )
            
            # Update session status
            session.status = 'active'
            session.current_part = self.current_part
            session.current_question_index = self.question_index
            session.save()
            
            return response
        except SpeakingSession.DoesNotExist:
            logger.error(f"Session not found: {self.session_id}")
            return None
        except Exception as e:
            logger.error(f"Error creating response: {e}")
            return None
    
    @database_sync_to_async
    def _update_response(self, end_reason: str, total_duration_ms: int):
        """Update response with end time and reason."""
        from .speaking_models import SpeakingResponse
        
        try:
            response = SpeakingResponse.objects.get(id=self.response_id)
            response.status = 'processing'
            response.ended_at = timezone.now()
            response.end_reason = end_reason
            response.audio_duration_ms = total_duration_ms
            response.save()
        except Exception as e:
            logger.error(f"Error updating response: {e}")
    
    @database_sync_to_async
    def _save_audio_file(self, audio_data: bytes) -> bool:
        """Save audio data to file."""
        from .speaking_models import SpeakingResponse
        
        try:
            response = SpeakingResponse.objects.get(id=self.response_id)
            
            # Create WAV file with proper header
            wav_data = self._create_wav_file(audio_data)
            
            # Save to FileField
            filename = f"speaking_{self.response_id}.wav"
            response.audio_file.save(filename, ContentFile(wav_data))
            response.save()
            
            logger.info(f"Saved audio file: {filename}")
            return True
        except Exception as e:
            logger.error(f"Error saving audio file: {e}")
            return False
    
    def _create_wav_file(self, pcm_data: bytes) -> bytes:
        """Create WAV file from raw PCM data."""
        buffer = io.BytesIO()
        
        # Calculate sizes
        data_size = len(pcm_data)
        file_size = data_size + 36  # 44 - 8
        
        # WAV header
        buffer.write(b'RIFF')
        buffer.write(struct.pack('<I', file_size))
        buffer.write(b'WAVE')
        buffer.write(b'fmt ')
        buffer.write(struct.pack('<I', 16))  # fmt chunk size
        buffer.write(struct.pack('<H', 1))   # PCM format
        buffer.write(struct.pack('<H', CHANNELS))
        buffer.write(struct.pack('<I', SAMPLE_RATE))
        buffer.write(struct.pack('<I', SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE))  # byte rate
        buffer.write(struct.pack('<H', CHANNELS * BYTES_PER_SAMPLE))  # block align
        buffer.write(struct.pack('<H', BYTES_PER_SAMPLE * 8))  # bits per sample
        buffer.write(b'data')
        buffer.write(struct.pack('<I', data_size))
        buffer.write(pcm_data)
        
        return buffer.getvalue()
    
    @database_sync_to_async
    def _create_metrics(self, total_duration_ms: int):
        """Create SpeakingMetrics record."""
        from .speaking_models import SpeakingResponse, SpeakingMetrics
        
        try:
            response = SpeakingResponse.objects.get(id=self.response_id)
            
            # Calculate derived metrics
            avg_pause_ms = 0
            if self.pause_durations:
                avg_pause_ms = sum(self.pause_durations) // len(self.pause_durations)
            
            speech_ratio = 0.0
            if total_duration_ms > 0:
                speech_ratio = self.total_speaking_time_ms / total_duration_ms
            
            continuity_score = 0.0
            if self.total_speaking_time_ms > 0:
                pause_rate = self.pause_count / (self.total_speaking_time_ms / 60000)
                continuity_score = max(0, 1 - (pause_rate / 20))
            
            fluency_score = (speech_ratio * 0.4) + (continuity_score * 0.6)
            
            # Calculate average amplitude
            avg_amplitude = 0.0
            if self.amplitude_samples:
                avg_amplitude = sum(self.amplitude_samples) / len(self.amplitude_samples)
            
            metrics = SpeakingMetrics.objects.create(
                response=response,
                total_speaking_time_ms=self.total_speaking_time_ms,
                total_silence_time_ms=self.total_silence_time_ms,
                total_duration_ms=total_duration_ms,
                pause_count=self.pause_count,
                avg_pause_duration_ms=avg_pause_ms,
                max_pause_duration_ms=self.max_pause_ms,
                long_pause_count=self.long_pause_count,
                speech_ratio=speech_ratio,
                fluency_score=fluency_score,
                continuity_score=continuity_score,
                avg_amplitude=avg_amplitude,
            )
            
            logger.info(f"Created metrics for response: {self.response_id}")
            return metrics
        except Exception as e:
            logger.error(f"Error creating metrics: {e}")
            return None
    
    @database_sync_to_async
    def _save_partial_response(self):
        """Save partial response if disconnected unexpectedly."""
        from .speaking_models import SpeakingResponse
        
        try:
            if self.response_id:
                response = SpeakingResponse.objects.get(id=self.response_id)
                response.status = 'failed'
                response.end_reason = 'connection_lost'
                response.ended_at = timezone.now()
                response.save()
                logger.info(f"Saved partial response: {self.response_id}")
        except Exception as e:
            logger.error(f"Error saving partial response: {e}")
    
    async def _run_transcription(self, audio_data: bytes) -> Optional[str]:
        """Transcribe audio using OpenAI Whisper."""
        try:
            from .voice_service import VoiceService
            
            # Create WAV for transcription
            wav_data = self._create_wav_file(audio_data)
            
            # Run transcription in thread pool
            loop = asyncio.get_event_loop()
            
            def transcribe():
                try:
                    service = VoiceService()
                    result = service.speech_to_text(wav_data, audio_format="wav")
                    return result.get('text', '') if result.get('success') else ''
                except Exception as e:
                    logger.error(f"Transcription error: {e}")
                    return ''
            
            transcript = await loop.run_in_executor(None, transcribe)
            
            # Update response with transcript
            if transcript:
                await self._update_transcript(transcript)
            
            return transcript
        except Exception as e:
            logger.error(f"Error running transcription: {e}")
            return None
    
    @database_sync_to_async
    def _update_transcript(self, transcript: str):
        """Update response with transcript."""
        from .speaking_models import SpeakingResponse
        
        try:
            response = SpeakingResponse.objects.get(id=self.response_id)
            response.transcript = transcript
            response.word_count = len(transcript.split())
            response.status = 'analyzing'
            response.save()
            
            # Update metrics with WPM
            if hasattr(response, 'metrics') and response.metrics:
                metrics = response.metrics
                if metrics.total_speaking_time_ms > 0:
                    wpm = int((response.word_count / (metrics.total_speaking_time_ms / 60000)))
                    metrics.estimated_words_per_minute = wpm
                    metrics.save()
        except Exception as e:
            logger.error(f"Error updating transcript: {e}")
    
    async def _run_evaluation(self, transcript: str):
        """Run IELTS evaluation on the transcript."""
        try:
            from .speaking_evaluator import IELTSSpeakingEvaluator
            
            # Get metrics for evaluation context
            metrics = await self._get_metrics()
            
            loop = asyncio.get_event_loop()
            
            def evaluate():
                try:
                    evaluator = IELTSSpeakingEvaluator()
                    return evaluator.evaluate(
                        transcript=transcript,
                        question_text=self.question_text,
                        part=self.current_part,
                        metrics_dict=metrics,
                    )
                except Exception as e:
                    logger.error(f"Evaluation error: {e}")
                    return None
            
            evaluation = await loop.run_in_executor(None, evaluate)
            
            if evaluation:
                await self._save_evaluation(evaluation)
                
                await self.send(text_data=json.dumps({
                    'type': 'analysis_complete',
                    'evaluation': {
                        'fluency_coherence': float(evaluation.get('fluency_coherence', 0)),
                        'lexical_resource': float(evaluation.get('lexical_resource', 0)),
                        'grammatical_range': float(evaluation.get('grammatical_range', 0)),
                        'pronunciation': float(evaluation.get('pronunciation', 0)),
                        'overall_band': float(evaluation.get('overall_band', 0)),
                        'feedback': evaluation.get('feedback', {}),
                    }
                }))
        except ImportError:
            logger.warning("Speaking evaluator not available yet")
        except Exception as e:
            logger.error(f"Error running evaluation: {e}")
    
    @database_sync_to_async
    def _get_metrics(self) -> dict:
        """Get metrics for evaluation context."""
        from .speaking_models import SpeakingResponse
        
        try:
            response = SpeakingResponse.objects.get(id=self.response_id)
            metrics = response.metrics
            if metrics:
                return {
                    'total_speaking_time_ms': metrics.total_speaking_time_ms,
                    'pause_count': metrics.pause_count,
                    'avg_pause_duration_ms': metrics.avg_pause_duration_ms,
                    'estimated_words_per_minute': metrics.estimated_words_per_minute,
                    'fluency_score': metrics.fluency_score,
                }
            return {}
        except Exception:
            return {}
    
    @database_sync_to_async
    def _save_evaluation(self, evaluation: dict):
        """Save evaluation to database."""
        from .speaking_models import SpeakingResponse, SpeakingEvaluation
        
        try:
            response = SpeakingResponse.objects.get(id=self.response_id)
            
            eval_obj = SpeakingEvaluation.objects.create(
                response=response,
                fluency_coherence=evaluation.get('fluency_coherence'),
                fluency_coherence_feedback=evaluation.get('feedback', {}).get('fluency_coherence', ''),
                lexical_resource=evaluation.get('lexical_resource'),
                lexical_resource_feedback=evaluation.get('feedback', {}).get('lexical_resource', ''),
                grammatical_range=evaluation.get('grammatical_range'),
                grammatical_range_feedback=evaluation.get('feedback', {}).get('grammatical_range', ''),
                pronunciation=evaluation.get('pronunciation'),
                pronunciation_feedback=evaluation.get('feedback', {}).get('pronunciation', ''),
                overall_band=evaluation.get('overall_band'),
                improvement_suggestions=evaluation.get('improvement_suggestions', ''),
                strengths=evaluation.get('strengths', ''),
                weaknesses=evaluation.get('weaknesses', ''),
                raw_evaluation_response=evaluation,
            )
            
            # Mark response as completed
            response.status = 'completed'
            response.save()
            
            logger.info(f"Saved evaluation for response: {self.response_id}")
        except Exception as e:
            logger.error(f"Error saving evaluation: {e}")
