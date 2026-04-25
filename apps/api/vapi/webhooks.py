import os
import time
from typing import Any

import httpx
from fastapi import APIRouter, Request

from streaming import bus
from vapi.outbound import clear_current_call

router = APIRouter(prefix="/vapi", tags=["vapi"])

_P2_INGEST_URL = os.getenv("P2_INGEST_URL", "")

_ROLE_MAP = {"user": "scammer", "assistant": "mevrouw"}


async def _forward_to_p2(path: str, payload: dict) -> None:
    """Fire-and-forget POST to P2. Silently drops on timeout/error."""
    if not _P2_INGEST_URL:
        return
    try:
        async with httpx.AsyncClient() as client:
            await client.post(f"{_P2_INGEST_URL.rstrip('/')}{path}", json=payload, timeout=2.0)
    except Exception:
        pass


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
        timestamp_ms = message.get("timestamp")
        t_offset_ms = int(timestamp_ms * 1000) if timestamp_ms is not None else int(time.time() * 1000)
        event = {
            "type": "transcript_delta",
            "call_id": call_id,
            "speaker": speaker,
            "text": message.get("transcript"),
            "t_offset_ms": t_offset_ms,
        }
        await bus.publish(event)
        await _forward_to_p2("/ingest", {"call_id": call_id, "text": message.get("transcript", "")})

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
        duration_s = message.get("durationSeconds") or message.get("duration_seconds") or 0
        event = {
            "type": "call_ended",
            "call_id": call_id,
            "duration_s": duration_s,
        }
        await bus.publish(event)
        await _forward_to_p2("/call_ended", {"call_id": call_id, "duration_s": duration_s})

    return {"ok": True}
