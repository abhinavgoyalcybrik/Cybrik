"""
OpenAI Voice Service for IELTS Speaking Tests.
Uses OpenAI TTS for speaking questions and Whisper for transcription.
"""
import os
import base64
import logging
import tempfile
from openai import OpenAI

logger = logging.getLogger(__name__)


class VoiceService:
    """Handles text-to-speech and speech-to-text using OpenAI APIs."""
    
    def __init__(self):
        api_key = os.getenv('IELTS_OPENAI_API_KEY')
        if not api_key:
            raise ValueError("IELTS_OPENAI_API_KEY environment variable not set")
        self.client = OpenAI(api_key=api_key)
    
    def text_to_speech(self, text: str, voice: str = "alloy") -> bytes:
        """
        Convert text to speech using OpenAI TTS.
        
        Args:
            text: The text to convert to speech
            voice: Voice to use - alloy, echo, fable, onyx, nova, shimmer
            
        Returns:
            Audio bytes (mp3 format)
        """
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
        
        Args:
            audio_data: Raw audio bytes
            audio_format: Audio format (webm, mp3, wav, etc.)
            
        Returns:
            dict with transcription result
        """
        try:
            # Write audio to temp file (Whisper requires file)
            with tempfile.NamedTemporaryFile(suffix=f".{audio_format}", delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name
            
            try:
                with open(temp_file_path, "rb") as audio_file:
                    transcription = self.client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language="en"  # IELTS is in English
                    )
                
                return {
                    "success": True,
                    "text": transcription.text,
                    "word_count": len(transcription.text.split())
                }
                
            finally:
                # Clean up temp file
                os.unlink(temp_file_path)
                
        except Exception as e:
            logger.error(f"Error in speech-to-text: {e}")
            return {
                "success": False,
                "text": "",
                "word_count": 0,
                "error": str(e)
            }
