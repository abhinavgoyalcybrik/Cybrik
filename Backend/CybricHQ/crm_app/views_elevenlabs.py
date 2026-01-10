import json
import hmac
import hashlib
import logging
import os
from typing import Any, Dict, List, Optional

import requests
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseForbidden
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from .models import CallRecord, Transcript

logger = logging.getLogger(__name__)

# signature/header config (keeps your existing defaults)
SIGNATURE_HEADER = getattr(settings, "ELEVENLABS_SIGNATURE_HEADER", "X-Elevenlabs-Signature")
ELEVENLABS_POSTCALL_SECRET = getattr(settings, "ELEVENLABS_WEBHOOK_SECRET", None)


def verify_signature(raw_body: bytes, header_signature: Optional[str]) -> bool:
    """
    Validate HMAC-SHA256 signature if ELEVENLABS_POSTCALL_SECRET is set.
    If secret not configured, skip verification (returns True).
    """
    if not ELEVENLABS_POSTCALL_SECRET:
        return True
    if not header_signature:
        return False
    try:
        computed = hmac.new(ELEVENLABS_POSTCALL_SECRET.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(computed, header_signature)
    except Exception:
        logger.exception("signature verification failed")
        return False


def parse_provider_postcall(metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize provider metadata into canonical fields.
    Returns dict:
      conversation_id, callSid, recording_url, full_transcript, messages (list), transcript_preview, extraction
    """
    out: Dict[str, Any] = {
        "conversation_id": metadata.get("conversation_id") or metadata.get("conversationId") or metadata.get("conv_id"),
        "callSid": metadata.get("callSid") or metadata.get("call_sid") or None,
        "recording_url": metadata.get("recording_url") or metadata.get("recordingUrl") or metadata.get("recording"),
        "full_transcript": metadata.get("transcript") or None,
        "messages": metadata.get("messages") or metadata.get("transcript") or metadata.get("turns") or [],
        "transcript_preview": None,
        "extraction": None,
        "llm_result": None,
    }

    # postcall snippet
    postcall = metadata.get("postcall") or {}
    if isinstance(postcall, dict):
        out["transcript_preview"] = postcall.get("transcript_preview") or postcall.get("summary") or out["transcript_preview"]
        if postcall.get("extraction"):
            out["extraction"] = postcall.get("extraction")

    # structured_output or llm_extraction
    if metadata.get("structured_output"):
        out["extraction"] = metadata.get("structured_output")
    if metadata.get("llm_extraction"):
        out["llm_result"] = metadata.get("llm_extraction")
        if isinstance(out["llm_result"], dict) and out["llm_result"].get("result"):
            out["extraction"] = out["llm_result"].get("result")

    # inner metadata that may carry phone/email/lead_id
    inner_meta = metadata.get("metadata") or {}
    if isinstance(inner_meta, dict):
        # merge inner extraction if not present
        if not out["extraction"] and inner_meta.get("extraction"):
            out["extraction"] = inner_meta.get("extraction")
        if not out["recording_url"]:
            out["recording_url"] = inner_meta.get("recording_url") or inner_meta.get("recordingUrl")

    return out


def store_conversation_data(call_record: CallRecord, conv_data: Dict[str, Any]) -> None:
    """
    Persist conversation data returned by ElevenLabs conversation GET (or webhook payload when full).
    - writes transcripts (per-turn) into Transcript rows (idempotent by text)
    - stores structured extraction into call_record.qualified_data
    - updates recording_url and archive snapshot in metadata
    """
    try:
        conv_id = conv_data.get("conversation_id") or conv_data.get("id")
        transcripts = conv_data.get("transcript") or conv_data.get("messages") or []
        metadata = conv_data.get("metadata") or {}

        # update recording_url if present
        rec_url = conv_data.get("recording_url") or metadata.get("recording_url") or conv_data.get("recordingUrl")
        if rec_url and not call_record.recording_url:
            call_record.recording_url = rec_url

        # update status and duration if present
        status = conv_data.get("status") or metadata.get("status")
        if status:
             call_record.status = status
        
        duration = conv_data.get("duration_secs") or conv_data.get("duration_seconds") or metadata.get("duration_secs")
        if duration is not None:
             call_record.duration_seconds = int(duration)
        
        if transcripts and (not call_record.status or call_record.status.lower() == "initiated"):
            call_record.status = "completed"

        # Extract cost if available (User wants LLM cost in USD)
        # Check metadata.charging.llm_price
        charging = metadata.get("charging") or {}
        llm_price = charging.get("llm_price")
        
        if llm_price is not None:
             call_record.cost = float(llm_price)
             call_record.currency = "USD"

        # figure out extraction structures
        extracted = None
        if conv_data.get("structured_output"):
            extracted = conv_data.get("structured_output")
        elif conv_data.get("llm_extraction"):
            llm = conv_data.get("llm_extraction")
            extracted = llm.get("result") if isinstance(llm, dict) and llm.get("result") else llm
        elif conv_data.get("postcall") and isinstance(conv_data.get("postcall"), dict) and conv_data["postcall"].get("extraction"):
            extracted = conv_data["postcall"].get("extraction")

        # merge into qualified_data
        qd = call_record.qualified_data or {}
        if extracted and isinstance(extracted, dict):
            qd.update(extracted)
        qd.setdefault("conv_retrieved_at", timezone.now().isoformat())
        call_record.qualified_data = qd

        # snapshot for forensic
        call_record.metadata = call_record.metadata or {}
        snapshot = {
            "fetched_at": timezone.now().isoformat(),
            "conversation_id": conv_id,
            "has_transcript": bool(transcripts)
        }
        call_record.metadata.setdefault("conversation_snapshots", []).append(snapshot)
        call_record.save(update_fields=["metadata", "qualified_data", "recording_url", "status", "duration_seconds"])

        # create Transcript rows (clean slate approach to ensure precision)
        # Delete existing transcripts to avoid duplicates and ensure correct order/content
        Transcript.objects.filter(call_id=call_record.id).delete()
        
        # Sort transcripts by time_in_call_secs if available
        def get_time(t):
            val = t.get("time_in_call_secs")
            return float(val) if val is not None else -1.0
            
        try:
            transcripts.sort(key=get_time)
        except Exception:
            pass # fallback to original order if sort fails

        created = 0
        for turn in transcripts:
            # support different shapes: {'role','message'} or {'speaker','text'}
            text = turn.get("message") or turn.get("text") or turn.get("utterance") or ""
            if not text:
                continue
                
            speaker = turn.get("role") or turn.get("speaker") or ("agent" if turn.get("agent_metadata") else "user")
            meta_turn = {}
            if turn.get("time_in_call_secs") is not None:
                meta_turn["time_in_call_secs"] = turn.get("time_in_call_secs")
                
            Transcript.objects.create(
                call_id=call_record.id,
                transcript_text=text,
                asr_provider="elevenlabs",
                metadata={"speaker": speaker, **meta_turn}
            )
            created += 1
        
        if created:
            logger.info("Stored %s transcript turns for CallRecord %s", created, call_record.id)
    except Exception:
        logger.exception("store_conversation_data failed for CallRecord %s", getattr(call_record, "id", "<none>"))


# Try to import Celery tasks if present (optional)
fetch_and_store_conversation_task = None
create_applicant_from_call = None
process_call_result = None
try:
    from .tasks import fetch_and_store_conversation_task, create_applicant_from_call, process_call_result
except Exception:
    # tasks file may not exist in some setups; that's ok
    fetch_and_store_conversation_task = None
    create_applicant_from_call = None
    process_call_result = None


@csrf_exempt
def elevenlabs_postcall(request):
    """
    Main webhook entrypoint for ElevenLabs post-call events.
    """
    if request.method != "POST":
        return HttpResponseBadRequest("only POST allowed")

    raw = request.body or b""

    # DEBUG: Log immediately
    try:
        import os
        from django.conf import settings
        log_path = os.path.join(settings.BASE_DIR, "webhook_debug.log")
        with open(log_path, "a") as f:
            f.write(f"\n\n--- RECEIVED AT: {timezone.now()} ---\n")
            f.write(str(raw))
            f.write("\n------------------------------------------\n")
    except Exception as e:
        logger.error(f"Failed to write webhook log: {e}")

    # fetch signature from headers (support both direct header and HTTP_ prefix)
    header_key = "HTTP_" + SIGNATURE_HEADER.upper().replace("-", "_")
    header_sig = request.META.get(header_key) or request.META.get(SIGNATURE_HEADER) or ""

    # verify signature if configured
    try:
        if not verify_signature(raw, header_sig):
            logger.warning("elevenlabs_postcall: invalid signature")
            return HttpResponseForbidden("invalid signature")
    except Exception:
        logger.exception("elevenlabs_postcall: signature verification error")
        return HttpResponseForbidden("signature error")

    # Attempt decode JSON (but still archive raw)
    parsed_body: Optional[Dict[str, Any]] = None
    try:
        parsed_body = json.loads(raw.decode("utf-8"))
    except Exception:
        # not JSON or malformed — we'll archive raw_text and continue safely
        try:
            parsed_body = {}
        except Exception:
            phone_number = (
                parsed_body.get("phone") or 
                parsed_body.get("phone_number") or
                (parsed_body.get("metadata", {}) or {}).get("phone") if isinstance(parsed_body.get("metadata"), dict) else None
            )
        
        if recent:
            recent.metadata = recent.metadata or {}
            recent.metadata.setdefault("incoming_webhook_archive", []).append(archive_entry)
            # Update phone if we found one and it's not already set
            if phone_number and "phone_number" not in recent.metadata:
                recent.metadata["phone_number"] = phone_number
            recent.save(update_fields=["metadata", "updated_at"])
            call_record = recent
        else:
            init_metadata = {"incoming_webhook_archive": [archive_entry]}
            if phone_number:
                init_metadata["phone_number"] = phone_number
            call_record = CallRecord.objects.create(provider="elevenlabs", metadata=init_metadata)
    except Exception:
        logger.exception("Failed to archive raw incoming webhook into CallRecord; falling back to filesystem")
        try:
            import os
            from django.conf import settings
            log_path = os.path.join(settings.BASE_DIR, "webhook_debug.log")
            with open(log_path, "a") as f:
                import json
                f.write(f"\n--- Webhook Received at {timezone.now()} ---\n")
                f.write(json.dumps(parsed_body or {"raw": str(raw)}, indent=2, default=str))
                f.write("\n------------------------------------------\n")
        except Exception as e:
            logger.error(f"Failed to write webhook log: {e}")
        try:
            call_record = CallRecord.objects.create(provider="elevenlabs", metadata={"raw_fallback": True, "raw_preview": str(raw)[:2000]})
        except Exception:
            call_record = None
    payload = parsed_body if isinstance(parsed_body, dict) else {}
    try:
        if call_record:
            call_record.metadata = call_record.metadata or {}
            # shallow-merge top-level keys (careful not to overwrite diagnostics history)
            for k, v in (payload.items() if isinstance(payload, dict) else []):
                try:
                    if k in call_record.metadata and isinstance(call_record.metadata[k], dict) and isinstance(v, dict):
                        call_record.metadata[k].update(v)
                    else:
                        call_record.metadata[k] = v
                except Exception:
                    call_record.metadata[k] = v
            call_record.save(update_fields=["metadata", "updated_at"])
    except Exception:
        logger.exception("Failed to merge webhook payload into CallRecord metadata")

    # === Normalize provider fields & dedupe existing call records ===
    provider_meta = call_record.metadata if call_record else payload or {}
    parsed = parse_provider_postcall(provider_meta if isinstance(provider_meta, dict) else {})
    conversation_id = parsed.get("conversation_id")
    callSid = parsed.get("callSid")

    # dedupe/search for an existing CallRecord by conversation_id or callSid or lead id
    try:
        existing_cr = None
        if conversation_id:
            # JSONField contains lookup may not be supported on all DBs; try safe scan fallback
            try:
                existing_cr = CallRecord.objects.filter(metadata__icontains=conversation_id).exclude(id=getattr(call_record, "id", None)).first()
            except Exception:
                # fallback: iterate recent records
                for cr in CallRecord.objects.all().order_by("-created_at")[:1000]:
                    md = cr.metadata or {}
                    if isinstance(md, dict) and conversation_id in json.dumps(md):
                        existing_cr = cr
                        break
        if not existing_cr and callSid:
            existing_cr = CallRecord.objects.filter(external_call_id=callSid).exclude(id=getattr(call_record, "id", None)).first()
        if existing_cr:
            call_record = existing_cr
    except Exception:
        logger.exception("dedupe search failed")

    # If we still lack a CallRecord, create minimal one
    if not call_record:
        try:
            # Extract phone number and applicant from metadata
            phone_number = None
            applicant_obj = None
            lead_obj = None
            
            if isinstance(payload, dict):
                # Try different possible phone number fields
                phone_number = (
                    payload.get("phone") or 
                    payload.get("phone_number") or 
                    payload.get("customer_phone") or
                    payload.get("to") or
                    payload.get("from")
                )
                
                # Also check nested metadata
                inner_meta = payload.get("metadata", {})
                if isinstance(inner_meta, dict) and not phone_number:
                    phone_number = (
                        inner_meta.get("phone") or 
                        inner_meta.get("phone_number") or
                        inner_meta.get("to") or
                        inner_meta.get("from")
                    )
                
                # Try to find applicant or lead by phone if we have one
                if phone_number:
                    try:
                        from .models import Applicant, Lead
                        applicant_obj = Applicant.objects.filter(phone=phone_number).first()
                        if not applicant_obj:
                            lead_obj = Lead.objects.filter(phone=phone_number).first()
                    except Exception:
                        logger.exception("Failed to lookup applicant/lead by phone")
            
            # Ensure phone is in metadata for easy access
            call_metadata = payload or {}
            if phone_number and "phone_number" not in call_metadata:
                call_metadata["phone_number"] = phone_number
            
            call_record = CallRecord.objects.create(
                provider="elevenlabs", 
                external_call_id=callSid or None, 
                applicant=applicant_obj,
                lead=lead_obj,
                metadata=call_metadata
            )
        except Exception:
            logger.exception("failed to create fallback CallRecord")
            return JsonResponse({"ok": False, "reason": "call_record_create_failed"}, status=500)

    # === If webhook contains full messages/transcript, persist immediately ===
    has_messages = bool((provider_meta or {}).get("messages") or (provider_meta or {}).get("transcript"))
    if has_messages:
        try:
            store_conversation_data(call_record, provider_meta if isinstance(provider_meta, dict) else payload)
        except Exception:
            logger.exception("Failed to store conversation data from webhook for CR %s", call_record.id)

        # enqueue background processing if available
        try:
            from .tasks import process_call_result  # optional
            try:
                process_call_result.delay(call_record.id)
            except Exception:
                # maybe not using Celery; call inline if settings allow eager
                if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
                    process_call_result(call_record.id)
        except Exception:
            # no process_call_result task available; ignore
            pass

        # attempt applicant upsert asynchronously
        try:
            if create_applicant_from_call:
                create_applicant_from_call.delay(call_record.id)
        except Exception:
            logger.exception("Failed to enqueue create_applicant_from_call")

        return JsonResponse({"ok": True, "stored_from_webhook": True, "call_record_id": call_record.id}, status=200)

    # === If only preview present but conversation_id exists, fetch conversation ===
    if conversation_id:
        # Prefer Celery task
        if fetch_and_store_conversation_task:
            try:
                fetch_and_store_conversation_task.delay(call_record.id, conversation_id)
                return JsonResponse({"ok": True, "queued_fetch": True, "call_record_id": call_record.id}, status=200)
            except Exception:
                logger.exception("Failed to enqueue fetch_and_store_conversation_task; falling back to sync fetch")

        # Synchronous fallback fetch (short timeout)
        try:
            xi_key = os.environ.get("ELEVENLABS_API_KEY") or getattr(settings, "ELEVENLABS_API_KEY", None)
            if not xi_key:
                logger.warning("ELEVENLABS_API_KEY not configured; cannot fetch conversation %s", conversation_id)
            else:
                url = f"https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}"
                resp = requests.get(url, headers={"xi-api-key": xi_key}, timeout=15)
                if resp.status_code == 200:
                    conv_data = resp.json()
                    store_conversation_data(call_record, conv_data)
                    # enqueue processing and applicant creation
                    try:
                        from .tasks import process_call_result
                        try:
                            process_call_result.delay(call_record.id)
                        except Exception:
                            if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
                                process_call_result(call_record.id)
                    except Exception:
                        pass
                    try:
                        if create_applicant_from_call:
                            create_applicant_from_call.delay(call_record.id)
                    except Exception:
                        logger.exception("Failed to enqueue create_applicant_from_call after fetch")
                    return JsonResponse({"ok": True, "fetched": True, "call_record_id": call_record.id}, status=200)
                else:
                    logger.warning("Conversation fetch failed %s: %s", resp.status_code, resp.text[:1000])
        except Exception:
            logger.exception("Synchronous conversation fetch failed for %s", conversation_id)

        # mark pending if fetch not possible now
        try:
            call_record.metadata = call_record.metadata or {}
            call_record.metadata["conversation_fetch_pending"] = {"conversation_id": conversation_id, "queued_at": timezone.now().isoformat()}
            call_record.save(update_fields=["metadata"])
        except Exception:
            logger.exception("Failed to mark conversation_fetch_pending for CR %s", call_record.id)

        return JsonResponse({"ok": True, "queued_fetch": False, "call_record_id": call_record.id}, status=200)
    # === If nothing to store/fetch, flag and return OK (avoid retries) ===
    try:
        call_record.metadata = call_record.metadata or {}
        call_record.metadata["no_transcript_or_conversation_id"] = {"at": timezone.now().isoformat()}
        call_record.save(update_fields=["metadata"])
    except Exception:
        logger.exception("Failed to mark CR %s as no_transcript", call_record.id)

    return JsonResponse({"ok": True, "msg": "no_transcript_available", "call_record_id": call_record.id}, status=200)


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.http import HttpResponse

class ElevenLabsAudioProxy(APIView):
    permission_classes = [AllowAny]

    def get(self, request, conversation_id):
        xi_key = os.environ.get("ELEVENLABS_API_KEY")
        if not xi_key:
            return Response({"error": "server_config_error"}, status=500)
            
        url = f"https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}/audio"
        try:
            resp = requests.get(url, headers={"xi-api-key": xi_key}, stream=True, timeout=30)
            if resp.status_code != 200:
                return Response({"error": "upstream_error", "detail": resp.text}, status=resp.status_code)
                
            response = HttpResponse(resp.iter_content(chunk_size=8192), content_type=resp.headers.get("Content-Type", "audio/mpeg"))
            return response
        except Exception as e:
            logger.exception("Audio proxy failed")
            return Response({"error": str(e)}, status=500)
