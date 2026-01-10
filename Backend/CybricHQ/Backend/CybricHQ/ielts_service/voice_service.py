"""
OpenAI Voice Service for IELTS Speaking Tests.
Uses OpenAI TTS for speaking questions and Whisper for transcription.
"""
import os
import logging
import tempfile
from openai import OpenAI

logger = logging.getLogger(__name__)


class VoiceService:
    """Handles text-to-speech and speech-to-text using OpenAI APIs."""
    
    def __init__(self):
        api_key = os.getenv('IELTS_OPENAI_API_KEY')
        if not api_key:
            # Fallback to OPENAI_API_KEY if specific one not set
            api_key = os.getenv('OPENAI_API_KEY')
            
        if not api_key:
            # Don't crash on init if key missing, just warn (allows server to start)
            logger.warning("OPENAI_API_KEY not set for VoiceService")
            self.client = None
        else:
            self.client = OpenAI(api_key=api_key)
    
    def text_to_speech(self, text: str, voice: str = "alloy") -> bytes:
        """
        Convert text to speech using OpenAI TTS.
        """
        if not self.client:
            raise ValueError("OpenAI API key not configured")
            
        try:
            response = self.client.audio.speech.create(
                model="tts-1",
                voice=voice,
                input=text,
                response_format="mp3"
            )
            
            # Get audio bytes
            audio_bytes = b""
            for chunk in response.iter_bytes():
                audio_bytes += chunk
                
            return audio_bytes
            
        except Exception as e:
            logger.error(f"Error in text-to-speech: {e}")
            raise
    
    def speech_to_text(self, audio_data: bytes, audio_format: str = "webm") -> dict:
        """
        Transcribe speech to text using OpenAI Whisper.
        """
        if not self.client:
            return {
                "success": False,
                "text": "",
                "word_count": 0,
                "error": "OpenAI API key not configured"
            }

        temp_file_path = None
        try:
            # Write audio to temp file (Whisper requires file)
            with tempfile.NamedTemporaryFile(suffix=f".{audio_format}", delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name
            
            with open(temp_file_path, "rb") as audio_file:
                transcription = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"
                )
            
            return {
                "success": True,
                "text": transcription.text,
                "word_count": len(transcription.text.split())
            }
                
        except Exception as e:
            logger.error(f"Error in speech-to-text: {e}")
            return {
                "success": False,
                "text": "",
                "word_count": 0,
                "error": str(e)
            }
        finally:
            # Clean up temp file
            if temp_file_path and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

    def transcribe(self, audio_data: bytes, audio_format: str = "webm") -> str:
        """Alias for speech_to_text to return just the text string, matching legacy usage."""
        # Ensure we have bytes
        if hasattr(audio_data, 'read'):
            audio_data = audio_data.read()
            
        result = self.speech_to_text(audio_data, audio_format)
        if result.get("success"):
            return result.get("text", "")
        raise Exception(f"Transcription failed: {result.get('error')}")
