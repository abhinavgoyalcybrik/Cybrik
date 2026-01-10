import requests
from django.conf import settings
from django.core.files.base import ContentFile
from urllib.parse import urljoin


ELEVEN_API_BASE = getattr(settings, "ELEVENLABS_BASE", "https://api.elevenlabs.io").rstrip("/") + "/v1/"

def synthesize_text_to_media(text: str, filename: str = "tts.mp3", voice: str | None = None):
    """
    Generate TTS using ElevenLabs and return a Django ContentFile (binary) or save to disk.
    Caller should save to storage (e.g., Transcript.audio_file or media folder) and get a public URL.
    """
    api_key = getattr(settings, "ELEVENLABS_API_KEY", None)
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY not configured in settings")

    voice_id = voice or getattr(settings, "ELEVENLABS_VOICE_ID", None)
    if not voice_id:
        # default voice id if not provided — you can change in env
        voice_id = "21m00Tcm4TlvDq8ikWAM"

    url = urljoin(ELEVEN_API_BASE, f"text-to-speech/{voice_id}")
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
    }
    data = {"text": text}
    r = requests.post(url, json=data, headers=headers, timeout=60)
    r.raise_for_status()
    # The API returns audio bytes
    content = r.content
    return ContentFile(content, name=filename)
