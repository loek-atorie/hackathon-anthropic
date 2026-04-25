import os
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/demo", tags=["demo"])

VAPI_BASE = "https://api.vapi.ai"

_current_call_id: str | None = None


def _env() -> tuple[str, str, str, str]:
    api_key = os.environ.get("VAPI_API_KEY")
    scammer_id = os.environ.get("VAPI_ASSISTANT_ID_SCAMMER")
    phone_id = os.environ.get("VAPI_PHONE_NUMBER_ID")
    target = os.environ.get("MEVROUW_PHONE_NUMBER")
    missing = [k for k, v in {
        "VAPI_API_KEY": api_key,
        "VAPI_ASSISTANT_ID_SCAMMER": scammer_id,
        "VAPI_PHONE_NUMBER_ID": phone_id,
        "MEVROUW_PHONE_NUMBER": target,
    }.items() if not v]
    if missing:
        raise HTTPException(500, f"Missing env vars: {', '.join(missing)}")
    return api_key, scammer_id, phone_id, target  # type: ignore[return-value]


@router.post("/trigger")
async def trigger_demo() -> dict[str, Any]:
    """Kick off the Scammer Agent → Mevrouw Jansen demo call.

    Vapi places a PSTN call: phoneNumberId is the Scammer's outbound DID,
    customer.number is Mevrouw's DID (same physical number is fine —
    Vapi handles concurrent in/out on a single DID).
    """
    global _current_call_id
    if _current_call_id:
        raise HTTPException(
            409, f"Call already in flight: {_current_call_id}. POST /demo/abort first."
        )
    api_key, scammer_id, phone_id, target = _env()

    payload = {
        "assistantId": scammer_id,
        "phoneNumberId": phone_id,
        "customer": {"number": target},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{VAPI_BASE}/call",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if r.status_code >= 400:
            raise HTTPException(r.status_code, r.text)
        data = r.json()

    _current_call_id = data.get("id")
    return {"callId": _current_call_id, "status": data.get("status")}


@router.post("/abort")
async def abort_demo() -> dict[str, Any]:
    """Hang up the in-flight demo call. Idempotent."""
    global _current_call_id
    if not _current_call_id:
        return {"ok": True, "note": "no active call"}
    api_key, *_ = _env()
    cid = _current_call_id
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            f"{VAPI_BASE}/call/{cid}/end",
            headers={"Authorization": f"Bearer {api_key}"},
        )
    _current_call_id = None
    return {"ok": True, "callId": cid, "vapiStatus": r.status_code}


def clear_current_call(call_id: str | None) -> None:
    """Called from webhooks.py when end-of-call-report arrives."""
    global _current_call_id
    if call_id and _current_call_id == call_id:
        _current_call_id = None
