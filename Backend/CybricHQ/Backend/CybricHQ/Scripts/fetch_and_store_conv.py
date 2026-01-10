# scripts/fetch_and_store_conv.py
# Fetch an ElevenLabs conversation and persist it into CallRecord + Transcript
# Usage: run inside Django context (see README/powershell snippet)

import os, json, requests
from django.utils import timezone

CONV_ID = os.environ.get("ELEVEN_CONV_ID") or "conv_1701kb22y5q6fdpsn70vhsaet120"
XI_API_KEY = os.environ.get("ELEVEN_XI_API_KEY")
if not XI_API_KEY:
    raise SystemExit("ERROR: ELEVEN_XI_API_KEY env var not set (export it before running)")

print("Fetching conversation", CONV_ID, "from ElevenLabs...")
url = f"https://api.elevenlabs.io/v1/convai/conversations/{CONV_ID}"
resp = requests.get(url, headers={"xi-api-key": XI_API_KEY}, timeout=30)
print("HTTP status:", resp.status_code)
try:
    data = resp.json()
except Exception:
    print("Failed to decode JSON; raw text (truncated):")
    print(resp.text[:2000])
    raise SystemExit("No JSON data")

# Pretty-preview transcript
print("\n--- Conversation preview (first 50 turns) ---")
transcript = data.get("transcript") or data.get("messages") or []
if transcript:
    for i, turn in enumerate(transcript[:50], start=1):
        role = turn.get("role") or turn.get("speaker") or "unknown"
        text = turn.get("message") or turn.get("text") or ""
        print(f"{i}. {role}: {text[:300]}")
else:
    print("No 'transcript' array in conversation JSON. Available keys:", list(data.keys()))

# Persist to DB
try:
    # import models
    from ..crm_app.models import CallRecord, Transcript
except Exception as e:
    print("FATAL: cannot import crm_app.models:", e)
    raise

# Try to import a helper from crm_app.views_elevenlabs if available (absolute import)
store_helper = None
try:
    import importlib
    mod = importlib.import_module("crm_app.views_elevenlabs")
    store_helper = getattr(mod, "store_conversation_data", None)
    if store_helper:
        print("Loaded store_conversation_data from crm_app.views_elevenlabs")
except Exception as e:
    # continue to fallback
    print("Could not import crm_app.views_elevenlabs.store_conversation_data:", e)

# Fallback local implementation if helper not available
def _local_store_conversation_data(cr: "CallRecord", conv_json: dict):
    """
    Minimal but robust persistence:
    - Save raw snapshot to cr.metadata
    - Save structured_output/llm_extraction into cr.qualified_data
    - Persist per-turn Transcript rows (speaker + text)
    - Update recording_url if present
    """
    print("Using local store_conversation_data fallback")

    cr.metadata = cr.metadata or {}
    # archive raw snapshot (small memory; you may want to chunk/rotate in prod)
    cr.metadata.setdefault("conversation_snapshots", []).append({
        "fetched_at": timezone.now().isoformat(),
        "conversation_id": CONV_ID,
        "snapshot": conv_json
    })

    # recording URL may be present in top-level or in metadata block
    recording_url = conv_json.get("recording_url") or conv_json.get("metadata", {}).get("recording_url") or None
    if recording_url:
        cr.recording_url = recording_url

    # extract structured_output (preferred) or llm_extraction.result
    qualified = conv_json.get("structured_output")
    if not qualified:
        llm = conv_json.get("llm_extraction") or conv_json.get("metadata", {}).get("llm_extraction")
        if isinstance(llm, dict):
            qualified = llm.get("result") or llm.get("result", {})
    if qualified:
        cr.qualified_data = qualified

    # Save callSid / conversation_id into metadata top-level for dedupe
    if conv_json.get("conversation_id"):
        cr.metadata["conversation_id"] = conv_json.get("conversation_id")
    if conv_json.get("callSid"):
        cr.external_call_id = conv_json.get("callSid")
        cr.metadata["callSid"] = conv_json.get("callSid")

    cr.save()

    # Save per-turn transcripts (dedupe by exact text + call_id)
    saved = 0
    turns = conv_json.get("transcript") or conv_json.get("messages") or []
    for turn in turns:
        text = (turn.get("message") or turn.get("text") or "").strip()
        if not text:
            continue
        speaker = (turn.get("role") or turn.get("speaker") or "unknown")
        # cheap dedupe: skip identical existing row
        exists = Transcript.objects.filter(call_id=cr.id, transcript_text=text).exists()
        if exists:
            continue
        t = Transcript.objects.create(
            call_id = cr.id,
            asr_provider = "elevenlabs",
            transcript_text = text,
            metadata = {"speaker": speaker, "original_turn": turn}
        )
        saved += 1
    print(f"Saved {saved} new Transcript rows for CallRecord id {cr.id}")

# find existing CallRecord by conversation_id or callSid inside metadata
cr = None
try:
    cr = CallRecord.objects.filter(metadata__icontains=CONV_ID).first()
except Exception:
    cr = None

if not cr:
    # fallback: scan recent records (safer for sqlite)
    for c in CallRecord.objects.all().order_by("-created_at")[:1000]:
        md = c.metadata or {}
        try:
            if isinstance(md, dict) and CONV_ID in json.dumps(md):
                cr = c
                break
        except Exception:
            continue

if not cr:
    # create new CallRecord
    cr = CallRecord.objects.create(
        provider = "elevenlabs",
        external_call_id = (data.get("callSid") or None),
        metadata = {"conversation_id": CONV_ID, "fetched_at": timezone.now().isoformat(), "raw_conversation_snapshot_exists": True}
    )
    print("Created new CallRecord id", cr.id)
else:
    print("Found existing CallRecord id", cr.id)
    cr.metadata = cr.metadata or {}
    cr.metadata.setdefault("conversation_snapshots", []).append({"fetched_at": timezone.now().isoformat(), "conversation_id": CONV_ID})
    cr.save(update_fields=["metadata", "updated_at"])

# Use imported helper if available; otherwise local fallback
if store_helper:
    try:
        store_helper(cr, data)
        print("store_conversation_data executed from crm_app.views_elevenlabs")
    except Exception as e:
        print("Error running store_conversation_data from crm_app.views_elevenlabs:", e)
        print("Falling back to local persister")
        _local_store_conversation_data(cr, data)
else:
    _local_store_conversation_data(cr, data)

# Print summary
from ..crm_app.models import Transcript
saved_count = Transcript.objects.filter(call_id=cr.id).count()
print("Total saved Transcript rows for CR", cr.id, "=", saved_count)
print("Latest 10 transcripts (speaker : text):")
for t in Transcript.objects.filter(call_id=cr.id).order_by("id")[-10:]:
    sp = (t.metadata or {}).get("speaker", "unknown")
    print(" -", sp, ":", (t.transcript_text or "")[:400])

print("\nCallRecord qualified_data preview:", json.dumps(cr.qualified_data or {}, indent=2)[:2000])
print("CallRecord.recording_url:", cr.recording_url)
print("CallRecord.metadata keys:", list((cr.metadata or {}).keys()))
