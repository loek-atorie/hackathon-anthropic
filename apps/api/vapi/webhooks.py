import logging
import os
import time
from typing import Any

import httpx
from fastapi import APIRouter, Request

from streaming import bus
from vapi.outbound import clear_current_call

log = logging.getLogger(__name__)

router = APIRouter(prefix="/vapi", tags=["vapi"])

_P2_INGEST_URL = os.getenv("P2_INGEST_URL", "")

_ROLE_MAP = {"user": "scammer", "assistant": "mevrouw"}

# Per-call wall-clock anchor (epoch ms) so t_offset_ms is "ms since first event".
# Cleared on end-of-call-report. Bounded by call lifetime.
_call_start_ms: dict[str, int] = {}


async def _forward_to_p2(path: str, payload: dict) -> None:
    """Fire-and-forget POST to P2. Logs on failure so silent breakage is visible."""
    if not _P2_INGEST_URL:
        return
    try:
        async with httpx.AsyncClient() as client:
            await client.post(f"{_P2_INGEST_URL.rstrip('/')}{path}", json=payload, timeout=2.0)
    except Exception as e:
        log.warning("forward_to_p2 failed: path=%s err=%s", path, e)


@router.post("/webhooks")
async def vapi_webhook(request: Request) -> dict[str, Any]:
    """Single Vapi server-message endpoint.

    Vapi posts events here for: transcript chunks, function-calls,
    status updates, and end-of-call reports. Dispatch on message.type
    and fan out to the SSE bus so P2 (Listener/Reporter) and P3
    (dashboard) can consume.

    Set this URL on the Vapi assistant's Server URL field (use ngrok
    in dev: `ngrok http 8080` -> paste https URL).
    """
    payload = await request.json()
    message = payload.get("message") or {}
    msg_type = message.get("type")
    call = message.get("call") or {}
    call_id = call.get("id")

    if msg_type == "transcript":
        raw_role = message.get("role", "")
        speaker = _ROLE_MAP.get(raw_role, raw_role)
        # Vapi `message.timestamp` is already epoch-ms. Convert to ms-since-call-start
        # because that's what `t_offset_ms` means in the frontend contract (see types.ts).
        ts = message.get("timestamp")
        now_ms = int(ts) if ts is not None else int(time.time() * 1000)
        start_ms = _call_start_ms.setdefault(call_id, now_ms)
        t_offset_ms = max(0, now_ms - start_ms)
        event = {
            "type": "transcript_delta",
            "call_id": call_id,
            "speaker": speaker,
            "text": message.get("transcript"),
            "t_offset_ms": t_offset_ms,
        }
        await bus.publish(event)
        await _forward_to_p2("/ingest", {"call_id": call_id, "text": message.get("transcript", "")})
        # Mirror to P2's SSE so the frontend (which subscribes to P2's /events) sees live transcripts
        await _forward_to_p2("/publish", event)

    elif msg_type == "function-call":
        # Mevrouw's nudge tool round-trips through here in Step 5.
        await bus.publish({
            "type": "function-call",
            "call_id": call_id,
            "raw": message,
        })

    elif msg_type == "status-update":
        await bus.publish({
            "type": "status-update",
            "call_id": call_id,
            "status": message.get("status"),
        })

    elif msg_type == "end-of-call-report":
        # P2's Reporter agent triggers from this event.
        clear_current_call(call_id)
        _call_start_ms.pop(call_id, None)
        duration_s = message.get("durationSeconds") or message.get("duration_seconds") or 0
        event = {
            "type": "call_ended",
            "call_id": call_id,
            "duration_s": duration_s,
        }
        await bus.publish(event)
        await _forward_to_p2("/call_ended", {"call_id": call_id, "duration_s": duration_s})

    return {"ok": True}
