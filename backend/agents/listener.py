"""Listener agent — extracts scammer intelligence from call transcripts.

Uses Claude Sonnet 4.6 with forced tool-use so the output is always
structured JSON, not free text. Post-extraction the result is broadcast
to all SSE consumers via POST /publish.

Reson8 MCP is the intended upstream; Claude is the fallback (plan risk note).
"""
import asyncio
import json
import logging
import os
import sys
from functools import partial

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

log = logging.getLogger(__name__)

import anthropic
import httpx
from agents import graph_builder, interrogator, reporter, voiceprint
from agents.models import Extraction

PUBLISH_URL = os.getenv("PUBLISH_URL", "http://localhost:8080/publish")

_client = anthropic.AsyncAnthropic()

# Tool schema drives Claude's output shape — acts as the extraction contract.
_EXTRACT_TOOL = {
    "name": "emit_extraction",
    "description": "Emit structured intelligence extracted from a scam call transcript.",
    "input_schema": {
        "type": "object",
        "properties": {
            "language": {
                "type": "string",
                "enum": ["nl", "en", "tr", "ar", "other"],
                "description": "Primary language spoken in the call.",
            },
            "claimed_organisation": {
                "type": "string",
                "description": (
                    "Organisation the caller claims to represent, e.g. ING, Rabobank, ABN AMRO, "
                    "Politie, Belastingdienst, PostNL, DHL, Microsoft, gemeente"
                ),
            },
            "iban": {
                "type": "string",
                "description": "IBAN mentioned in the call, e.g. NL12RABO0123456789",
            },
            "payment_method": {
                "type": "string",
                "enum": ["iban", "gift_card", "crypto", "western_union", "foreign_account", "unknown"],
                "description": (
                    "How the caller asks for payment. "
                    "gift_card: asks victim to buy and share a gift card code. "
                    "crypto: asks for Bitcoin or other crypto address. "
                    "western_union: wire transfer via Western Union or MoneyGram. "
                    "foreign_account: non-Dutch bank account. "
                    "unknown: payment requested but method unclear."
                ),
            },
            "iban_direction": {
                "type": "string",
                "enum": ["send_to", "requested_from_victim", "unknown"],
                "description": (
                    "send_to: caller instructs victim to transfer money TO this IBAN. "
                    "requested_from_victim: caller asks victim for their own IBAN. "
                    "unknown: IBAN mentioned but direction unclear."
                ),
            },
            "callback_number": {
                "type": "string",
                "description": "Phone number the scammer instructs the victim to call back",
            },
            "tactics": {
                "type": "array",
                "items": {"type": "string"},
                "description": (
                    "Persuasion tactics detected: urgency, authority, fear, "
                    "isolation, pretexting, social_proof, scarcity, reciprocity"
                ),
            },
            "urgency_score": {
                "type": "integer",
                "description": "0–10: how hard the scammer pushes for immediate action (10 = extreme pressure)",
            },
            "script_signature": {
                "type": "string",
                "enum": [
                    "bank-helpdesk",
                    "overheid-boete",
                    "pakket-fraude",
                    "microsoft-support",
                    "investering-fraude",
                    "belasting-teruggave",
                    "romance-fraude",
                    "opa-oma-fraude",
                    "loterij-fraude",
                    "voorschot-fraude",
                    "other",
                    "none",
                ],
                "description": (
                    "Scam script pattern. Use 'none' if the call shows no signs of fraud. "
                    "Use 'other' only if it is clearly a scam but matches no known pattern."
                ),
            },
            "is_scam": {
                "type": "boolean",
                "description": (
                    "True if the call shows clear signs of fraud or manipulation. "
                    "False if it appears to be a legitimate call."
                ),
            },
            "is_scam_confidence": {
                "type": "number",
                "description": "Confidence in the is_scam verdict, 0.0 (unsure) to 1.0 (certain).",
            },
        },
        "required": ["tactics", "urgency_score", "is_scam", "is_scam_confidence"],
    },
}

_SYSTEM_PROMPT = (
    "Je bent een forensisch analist die telefoongesprekken analyseert op mogelijke oplichting. "
    "Bepaal eerst of het gesprek kenmerken van oplichting vertoont. "
    "Extraheer alleen intelligence die expliciet in het transcript staat — verzin niets. "
    "Gebruik het gereedschap `emit_extraction` om gestructureerde data te retourneren."
)



MIN_TRANSCRIPT_WORDS = 8

async def extract(transcript: str) -> Extraction:
    """Run Claude extraction on a transcript string. Returns an Extraction."""
    if len(transcript.split()) < MIN_TRANSCRIPT_WORDS:
        return Extraction()

    response = await _client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=_SYSTEM_PROMPT,
        tools=[_EXTRACT_TOOL],
        tool_choice={"type": "tool", "name": "emit_extraction"},
        messages=[
            {
                "role": "user",
                "content": f"Analyseer dit transcript en extraheer de intelligence:\n\n{transcript}",
            }
        ],
    )
    for block in response.content:
        if block.type == "tool_use" and block.name == "emit_extraction":
            return Extraction(**block.input)
    return Extraction()


async def process_and_publish(transcript: str, call_id: str) -> Extraction:
    """Extract entities, broadcast to SSE bus, write vault files. Returns the Extraction."""
    extraction = await extract(transcript)

    # Publish extraction to SSE bus so P3's dashboard updates immediately
    payload = {"type": "extraction", "call_id": call_id, **extraction.model_dump()}
    async with httpx.AsyncClient() as http:
        try:
            await http.post(PUBLISH_URL, json=payload, timeout=5.0)
        except httpx.RequestError:
            pass  # server not running in standalone test mode

    # Write vault files only for confirmed scams (confidence >= 0.7)
    # Run in thread pool — file I/O must not block the async event loop
    if extraction.is_scam and extraction.is_scam_confidence >= 0.7:
        loop = asyncio.get_running_loop()
        try:
            files = await loop.run_in_executor(
                None, partial(graph_builder.build, call_id, extraction)
            )
            log.info("vault: %d files written for %s", len(files), call_id)

            # Emit graph_node_added for each file so the frontend graph updates live
            async with httpx.AsyncClient() as http:
                for file_path in files:
                    p = file_path if hasattr(file_path, "parts") else __import__("pathlib").Path(file_path)
                    _folder_to_type = {"calls": "call", "ibans": "iban", "scripts": "script", "organisations": "bank"}
                    node_type = _folder_to_type.get(p.parent.name, p.parent.name)
                    node_id = p.stem            # e.g. "call-0042", "NL91ABNA..."
                    node_event = {
                        "type": "graph_node_added",
                        "call_id": call_id,
                        "node_id": node_id,
                        "node_type": node_type,
                        "markdown_path": str(p),
                    }
                    try:
                        await http.post(PUBLISH_URL, json=node_event, timeout=5.0)
                    except httpx.ConnectError:
                        pass
        except Exception as exc:
            log.error("vault write failed for %s: %s", call_id, exc)

    # Fire interrogator — suggest next question for Mevrouw Jansen
    try:
        await interrogator.interrogate(call_id, extraction)
    except Exception as exc:
        log.error("interrogator failed for %s: %s", call_id, exc)

    # Generate stakeholder reports
    try:
        await reporter.generate_reports(call_id, extraction)
    except Exception as exc:
        log.error("reporter failed for %s: %s", call_id, exc)

    # Voiceprint cluster (mock)
    try:
        await voiceprint.fingerprint(call_id, extraction)
    except Exception as exc:
        log.error("voiceprint failed for %s: %s", call_id, exc)

    return extraction


# ---------------------------------------------------------------------------
# Canned Dutch bank-helpdesk scam transcript — used for offline testing
# ---------------------------------------------------------------------------
CANNED_TRANSCRIPT = """
Oplichter: Goedemiddag, u spreekt met de beveiligingsdienst van ING Bank.
    Mijn naam is meneer De Vries, personeelsnummer 4471.
Slachtoffer: Dag meneer.
Oplichter: Mevrouw, we hebben zojuist verdachte transacties gedetecteerd op uw rekening.
    Er is geprobeerd een bedrag van 4.800 euro over te maken naar een buitenlands
    rekeningnummer. Om uw geld veilig te stellen moet u nu onmiddellijk handelen.
Slachtoffer: Oh nee, dat is verschrikkelijk. Wat moet ik doen?
Oplichter: We hebben uw samenwerking nodig. U moet uw geld tijdelijk overmaken naar een
    beveiligde ING-kluis-rekening. Het rekeningnummer is NL91ABNA0417164300.
    Dit is een tijdelijke veiligheidsrekening en uw geld staat er binnen 24 uur weer op.
Slachtoffer: Maar is dat wel veilig?
Oplichter: Mevrouw, elke minuut dat u wacht loopt u het risico dat de oplichters uw
    rekening leegmaken. U kunt mij terugbellen op 020-1234567 als u verificatie wilt,
    maar daarna is het misschien te laat. Dit is de hoogste urgentie — code rood.
Slachtoffer: Hoeveel moet ik overmaken?
Oplichter: Alles wat u heeft. Dit is een noodprocedure van ING. Onze medewerkers staan
    klaar. U bent niet de enige — we hebben vandaag al 12 klanten geholpen met dit
    probleem. Iedereen die heeft meegewerkt heeft zijn geld teruggekregen.
"""


if __name__ == "__main__":
    async def _test() -> None:
        print("Running extraction on canned Dutch bank-helpdesk transcript...\n")
        result = await process_and_publish(CANNED_TRANSCRIPT, call_id="test-0001")
        print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))

    asyncio.run(_test())
