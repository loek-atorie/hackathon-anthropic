import asyncio
import datetime as dt
import os
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

VAPI_BASE = "https://api.vapi.ai"

demo_router = APIRouter(prefix="/demo", tags=["demo"])
internal_router = APIRouter(prefix="/internal", tags=["internal"])

# In-process state for the single in-flight demo call. We track BOTH legs
# of the self-call: the outbound (Scammer) and the inbound (Mevrouw) twin.
# Nudges go to Mevrouw's inbound leg; abort ends the outbound initiator.
_outbound_call_id: str | None = None
_outbound_control_url: str | None = None
_inbound_call_id: str | None = None
_inbound_control_url: str | None = None


def _env() -> tuple[str, str, str, str, str]:
    api_key = os.environ.get("VAPI_API_KEY")
    scammer_id = os.environ.get("VAPI_ASSISTANT_ID_SCAMMER")
    phone_id = os.environ.get("VAPI_PHONE_NUMBER_ID")
    target = os.environ.get("MEVROUW_PHONE_NUMBER")
    mevrouw_id = os.environ.get("VAPI_ASSISTANT_ID_MEVROUW")
    missing = [k for k, v in {
        "VAPI_API_KEY": api_key,
        "VAPI_ASSISTANT_ID_SCAMMER": scammer_id,
        "VAPI_PHONE_NUMBER_ID": phone_id,
        "MEVROUW_PHONE_NUMBER": target,
        "VAPI_ASSISTANT_ID_MEVROUW": mevrouw_id,
    }.items() if not v]
    if missing:
        raise HTTPException(500, f"Missing env vars: {', '.join(missing)}")
    return api_key, scammer_id, phone_id, target, mevrouw_id  # type: ignore[return-value]


async def _find_inbound_twin(
    api_key: str, mevrouw_id: str, after_iso: str
) -> tuple[str | None, str | None]:
    """Locate Mevrouw's inbound call leg paired with our outbound trigger.

    Self-calling on a single Vapi DID produces two records: an outbound
    (the Scammer's leg, returned by POST /call) and an inbound (Mevrouw's
    leg, materialized by Vapi when the call lands on her DID). Polls up
    to ~16s for the inbound to appear.
    """
    async with httpx.AsyncClient(timeout=10) as client:
        for _ in range(8):
            r = await client.get(
                f"{VAPI_BASE}/call",
                params={"limit": 10},
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if r.status_code < 400:
                for c in r.json():
                    if (
                        c.get("type") == "inboundPhoneCall"
                        and c.get("assistantId") == mevrouw_id
                        and (c.get("createdAt") or "") >= after_iso
                    ):
                        return c.get("id"), (c.get("monitor") or {}).get("controlUrl")
            await asyncio.sleep(2)
    return None, None


@demo_router.post("/trigger")
async def trigger_demo() -> dict[str, Any]:
    """Kick off the Scammer Agent → Mevrouw Jansen demo call.

    Places an outbound Vapi call (Scammer) targeting Mevrouw's DID. Then
    locates Mevrouw's inbound twin so /internal/nudge can target her
    rather than the Scammer.
    """
    global _outbound_call_id, _outbound_control_url
    global _inbound_call_id, _inbound_control_url

    if _outbound_call_id or _inbound_call_id:
        raise HTTPException(
            409,
            f"Call already in flight (outbound={_outbound_call_id}, "
            f"inbound={_inbound_call_id}). POST /demo/abort first.",
        )

    api_key, scammer_id, phone_id, target, mevrouw_id = _env()

    started_at = dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{VAPI_BASE}/call",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "assistantId": scammer_id,
                "phoneNumberId": phone_id,
                "customer": {"number": target},
            },
        )
        if r.status_code >= 400:
            raise HTTPException(r.status_code, r.text)
        data = r.json()

    _outbound_call_id = data.get("id")
    _outbound_control_url = (data.get("monitor") or {}).get("controlUrl")

    _inbound_call_id, _inbound_control_url = await _find_inbound_twin(
        api_key, mevrouw_id, started_at
    )

    return {
        "outboundCallId": _outbound_call_id,
        "inboundCallId": _inbound_call_id,
        "nudgeReady": bool(_inbound_control_url),
        "status": data.get("status"),
    }


@demo_router.post("/abort")
async def abort_demo() -> dict[str, Any]:
    """Hang up the in-flight demo call. Idempotent."""
    global _outbound_call_id, _outbound_control_url
    global _inbound_call_id, _inbound_control_url

    if not (_outbound_call_id or _inbound_call_id):
        return {"ok": True, "note": "no active call"}

    ended = []
    async with httpx.AsyncClient(timeout=10) as client:
        for url in (_outbound_control_url, _inbound_control_url):
            if not url:
                continue
            try:
                await client.post(url, json={"type": "end-call"})
                ended.append(url)
            except Exception:
                pass

    out_cid, in_cid = _outbound_call_id, _inbound_call_id
    _outbound_call_id = _outbound_control_url = None
    _inbound_call_id = _inbound_control_url = None
    return {"ok": True, "outboundCallId": out_cid, "inboundCallId": in_cid, "ended": ended}


class NudgeRequest(BaseModel):
    question: str
    call_id: str | None = None


@internal_router.post("/nudge")
async def nudge(body: NudgeRequest) -> dict[str, Any]:
    """Inject a line for Mevrouw to say mid-call (the visibly-agentic moment).

    P2's Interrogator detects a gap (e.g. "no IBAN extracted yet") and
    POSTs a Dutch nudge here. Forwarded to Vapi as a "say" control message
    on Mevrouw's inbound-leg controlUrl.
    """
    if not (_inbound_call_id and _inbound_control_url):
        raise HTTPException(
            409,
            "No active call to nudge. Hit POST /demo/trigger and wait for nudgeReady=true.",
        )
    if body.call_id and body.call_id not in {_inbound_call_id, _outbound_call_id}:
        raise HTTPException(
            404, f"call_id {body.call_id} is not part of the active call pair"
        )

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            _inbound_control_url,
            json={
                "type": "say",
                "content": body.question,
                "endCallAfterSpoken": False,
            },
        )
        if r.status_code >= 400:
            raise HTTPException(r.status_code, f"Vapi control rejected: {r.text}")

    return {"ok": True, "callId": _inbound_call_id, "spoken": body.question}


def clear_current_call(call_id: str | None) -> None:
    """Called from webhooks.py when end-of-call-report arrives for either leg."""
    global _outbound_call_id, _outbound_control_url
    global _inbound_call_id, _inbound_control_url
    if not call_id:
        return
    if call_id in {_outbound_call_id, _inbound_call_id}:
        _outbound_call_id = _outbound_control_url = None
        _inbound_call_id = _inbound_control_url = None
