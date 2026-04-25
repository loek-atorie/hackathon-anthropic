"""Interrogator agent — identifies intel gaps and suggests the next question
for Mevrouw Jansen to ask the scammer mid-call.

Flow:
  1. Receive current Extraction state
  2. Detect what's still missing (IBAN, callback number, org, etc.)
  3. Ask Claude to generate a natural Dutch question Mevrouw Jansen can ask
  4. POST the hint to P1's webhook so Vapi injects it into the call
  5. Publish hint to SSE bus so P3's dashboard shows it live
"""
import asyncio
import logging
import os
import sys

# Allow running this file directly: python agents/interrogator.py
_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

import anthropic
import httpx

from agents.models import Extraction

log = logging.getLogger(__name__)

_client = anthropic.AsyncAnthropic()

PUBLISH_URL = os.getenv("PUBLISH_URL", "http://localhost:8000/publish")
P1_WEBHOOK_URL = os.getenv("P1_WEBHOOK_URL", "")  # empty = P1 not connected yet

_SYSTEM_PROMPT = """Je bent de coach van Mevrouw Jansen, een 78-jarige vrouw in Zwolle die aan de telefoon zit met een oplichter.
Mevrouw Jansen is lief, een beetje vergeetachtig, en een beetje slechthorend — ze vraagt dingen soms twee keer.
Jij zegt haar welke vraag ze nu moet stellen om meer informatie van de oplichter te krijgen.

Regels:
- De vraag moet naturel klinken voor een oudere vrouw — niet slim of verdacht
- Maximaal 1 zin
- Altijd in het Nederlands
- Niet agressief, niet technisch
- Als alle informatie al bekend is: geef een tijdrekkende opmerking (bijv. "Zeg maar dat ze het nog een keer moet uitleggen")
"""


def _detect_gaps(extraction: Extraction) -> list[str]:
    """Return a list of missing intel items, in priority order."""
    gaps = []
    if not extraction.claimed_organisation:
        gaps.append("naam van de bank of organisatie")
    if not extraction.iban:
        gaps.append("rekeningnummer om naartoe over te maken")
    if not extraction.callback_number:
        gaps.append("terugbelnummer")
    if not extraction.payment_method or extraction.payment_method == "unknown":
        gaps.append("hoe ze wil betalen (welke methode)")
    return gaps


async def generate_hint(extraction: Extraction) -> str:
    """Ask Claude for the next question Mevrouw Jansen should ask."""
    gaps = _detect_gaps(extraction)

    if gaps:
        next_gap = gaps[0]  # highest priority gap
        user_msg = (
            f"De oplichter zegt dat hij belt namens: {extraction.claimed_organisation or 'onbekend'}.\n"
            f"Wat we nog niet weten: {next_gap}.\n"
            f"Welke vraag moet Mevrouw Jansen nu stellen om dit te achterhalen?"
        )
    else:
        user_msg = (
            "We hebben alle informatie al. "
            "Welke opmerking kan Mevrouw Jansen maken om de oplichter langer aan de telefoon te houden?"
        )

    try:
        response = await asyncio.wait_for(
            _client.messages.create(
                model="claude-haiku-4-5-20251001",  # fast — this fires mid-call
                max_tokens=128,
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
            ),
            timeout=8.0,  # hard cap — useless after 8s mid-call
        )
    except asyncio.TimeoutError:
        log.warning("interrogator: Claude timed out, using fallback hint")
        return "Kunt u dat nog eens herhalen? Ik verstond u niet goed."
    if not response.content:
        return "Kunt u dat nog eens herhalen? Ik verstond u niet goed."
    return response.content[0].text.strip()


async def interrogate(call_id: str, extraction: Extraction) -> str | None:
    """Generate a hint and send it to P1 + SSE. Returns the hint string."""
    if not extraction.is_scam or extraction.is_scam_confidence < 0.7:
        log.info("interrogator: skipping call %s (is_scam=%s, confidence=%.2f)",
                 call_id, extraction.is_scam, extraction.is_scam_confidence)
        return None

    hint = await generate_hint(extraction)
    log.info("interrogator hint for %s: %s", call_id, hint)

    payload = {"type": "interrogator_hint", "call_id": call_id, "hint": hint}

    async with httpx.AsyncClient() as http:
        # Publish to SSE bus so P3 dashboard shows the hint live
        try:
            await http.post(PUBLISH_URL, json=payload, timeout=5.0)
        except httpx.RequestError:
            pass

        # POST to P1's Vapi webhook so Mevrouw Jansen actually asks it
        if P1_WEBHOOK_URL:
            try:
                await http.post(P1_WEBHOOK_URL, json=payload, timeout=5.0)
                log.info("interrogator: hint sent to P1 webhook")
            except Exception as exc:
                log.warning("interrogator: P1 webhook failed: %s", exc)
        else:
            log.info("interrogator: P1_WEBHOOK_URL not set — hint published to SSE only")

    return hint


# ── Standalone test ───────────────────────────────────────────────────────────

if __name__ == "__main__":

    async def _test() -> None:
        cases = [
            ("missing everything", Extraction(is_scam=True, is_scam_confidence=0.9)),
            ("missing iban", Extraction(
                is_scam=True, is_scam_confidence=0.95,
                claimed_organisation="ING", callback_number="020-1234567",
            )),
            ("all known", Extraction(
                is_scam=True, is_scam_confidence=1.0,
                claimed_organisation="ING", iban="NL91ABNA0417164300",
                callback_number="020-1234567", payment_method="iban",
                urgency_score=9,
            )),
            ("not a scam", Extraction(is_scam=False, is_scam_confidence=0.95)),
        ]

        for label, extraction in cases:
            print(f"\n{'='*50}")
            print(f"Case: {label}")
            gaps = _detect_gaps(extraction)
            print(f"Gaps: {gaps or 'none'}")
            hint = await interrogate("test-call", extraction)
            print(f"Hint: {hint or '(skipped — not a scam)'}")

    asyncio.run(_test())
