from typing import Any

from fastapi import APIRouter, Request

from streaming import bus
from vapi.outbound import clear_current_call

router = APIRouter(prefix="/vapi", tags=["vapi"])


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
        await bus.publish({
            "type": "transcript",
            "callId": call_id,
            "role": message.get("role"),
            "transcript": message.get("transcript"),
            "transcriptType": message.get("transcriptType"),
        })

    elif msg_type == "function-call":
        # Mevrouw's nudge tool round-trips through here in Step 5.
        await bus.publish({
            "type": "function-call",
            "callId": call_id,
            "raw": message,
        })

    elif msg_type == "status-update":
        await bus.publish({
            "type": "status-update",
            "callId": call_id,
            "status": message.get("status"),
        })

    elif msg_type == "end-of-call-report":
        # P2's Reporter agent triggers from this event.
        clear_current_call(call_id)
        await bus.publish({
            "type": "end-of-call-report",
            "callId": call_id,
            "raw": message,
        })

    return {"ok": True}
