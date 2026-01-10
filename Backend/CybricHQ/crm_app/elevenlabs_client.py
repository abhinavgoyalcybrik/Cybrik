# crm_app/elevenlabs_client.py
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

ELEVEN_BASE = getattr(settings, "ELEVENLABS_BASE", os.environ.get("ELEVENLABS_BASE", "https://api.elevenlabs.io")).rstrip("/")
ELEVEN_OUTBOUND_PATH = getattr(
    settings,
    "ELEVENLABS_OUTBOUND_PATH",
    os.environ.get("ELEVENLABS_OUTBOUND_PATH", "/v1/convai/twilio/outbound-call"),
)
ELEVEN_API_KEY = getattr(settings, "ELEVENLABS_API_KEY", os.environ.get("ELEVENLABS_API_KEY", ""))
ELEVEN_POSTCALL_WEBHOOK = getattr(settings, "ELEVENLABS_POSTCALL_WEBHOOK", os.environ.get("ELEVENLABS_POSTCALL_WEBHOOK", ""))
ELEVEN_DEFAULT_AGENT_ID = getattr(settings, "ELEVENLABS_AGENT_ID", os.environ.get("ELEVENLABS_AGENT_ID", None))
ELEVEN_DEFAULT_PHONE_ID = getattr(settings, "ELEVENLABS_PHONE_ID", os.environ.get("ELEVENLABS_PHONE_ID", None))


def _headers() -> Dict[str, str]:
    h: Dict[str, str] = {"Content-Type": "application/json"}
    if ELEVEN_API_KEY:
        h["xi-api-key"] = ELEVEN_API_KEY
    return h


def _safe_json(resp: requests.Response) -> Optional[Any]:
    try:
        return resp.json()
    except Exception:
        try:
            return resp.text if isinstance(resp.text, str) else str(resp.text)
        except Exception:
            return None


def _preview(obj: Any, max_chars: int = 1000) -> str:
    try:
        if isinstance(obj, (dict, list)):
            s = json.dumps(obj, default=str)
        else:
            s = str(obj)
    except Exception:
        s = repr(obj)
    return s[:max_chars]


def create_outbound_call(
    to_number: str,
    metadata: Optional[Dict[str, Any]] = None,
    agent_id: Optional[str] = None,
    agent_phone_number_id: Optional[str] = None,
    caller_id: Optional[str] = None,
    extra_payload: Optional[Dict[str, Any]] = None,
    timeout: int = 20,
    post_call_webhook: Optional[str] = None,
    post_call_extraction: bool = False,
    extraction_spec: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Instruct ElevenLabs to place an outbound Twilio call.

    IMPORTANT: ElevenLabs requires 'agent_id' and 'agent_phone_number_id' for the outbound endpoint.
    This function will use provided arguments, or fall back to ELEVENLABS_AGENT_ID and ELEVENLABS_PHONE_ID from settings/env.

    Returns a serializable dict with 'ok' and diagnostics.
    """
    if not to_number:
        return {"ok": False, "error": "to_number_required"}

    if not ELEVEN_OUTBOUND_PATH:
        return {"ok": False, "error": "eleven_outbound_path_not_configured"}

    # Resolve agent + phone id: prefer explicit args, then settings
    agent_id = agent_id or ELEVEN_DEFAULT_AGENT_ID
    agent_phone_number_id = agent_phone_number_id or ELEVEN_DEFAULT_PHONE_ID

    if not agent_id or not agent_phone_number_id:
        return {
            "ok": False,
            "error": "missing_agent_or_phone_id",
            "message": "ElevenLabs requires both agent_id and agent_phone_number_id. "
            "Set ELEVENLABS_AGENT_ID and ELEVENLABS_PHONE_ID in env/settings, or pass them to create_outbound_call().",
            "agent_id_present": bool(agent_id),
            "agent_phone_number_id_present": bool(agent_phone_number_id),
        }

    url = f"{ELEVEN_BASE}{ELEVEN_OUTBOUND_PATH}"

    payload: Dict[str, Any] = {
        "to_number": to_number,
        "agent_id": agent_id,
        "agent_phone_number_id": agent_phone_number_id,
    }
    
    if metadata:
        payload["dynamic_variables"] = metadata
        payload["metadata"] = metadata
    if caller_id:
        payload["caller_id"] = caller_id
    
    # Use argument if provided, else fallback to settings
    webhook_url = post_call_webhook or ELEVEN_POSTCALL_WEBHOOK
    if webhook_url:
        payload.setdefault("post_call_webhook", webhook_url)
        
    if post_call_extraction:
        payload["post_call_extraction"] = post_call_extraction
    if extraction_spec:
        payload["extraction_spec"] = extraction_spec

    if extra_payload:
        payload.update(extra_payload)

    try:
        resp = requests.post(url, json=payload, headers=_headers(), timeout=timeout)
    except Exception as exc:
        logger.exception("Network error calling ElevenLabs create_outbound_call")
        return {"ok": False, "error": "network_error", "exc": str(exc)}

    body_json = _safe_json(resp)
    try:
        body_text = resp.text if hasattr(resp, "text") else ""
    except Exception:
        body_text = ""

    preview = _preview(body_json if body_json is not None else body_text, 2000)

    result: Dict[str, Any] = {
        "ok": bool(resp.ok),
        "http_status": getattr(resp, "status_code", None),
        "reason": getattr(resp, "reason", None),
        "url": url,
        "request_payload_preview": _preview(payload, 1000),
        "body_text": body_text,
        "body_json": body_json,
    }

    if not resp.ok:
        logger.error("ElevenLabs outbound returned %s: %s", resp.status_code, preview)
        return result

    logger.info("ElevenLabs accepted outbound call to %s (status=%s)", to_number, resp.status_code)
    # unify successful response
    return {"ok": True, "response": body_json or body_text, **result}
