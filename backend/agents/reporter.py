"""Reporter agent — generates 4 stakeholder reports at end of call.

Reports written to vault/reports/{call_id}/ and published to SSE.
Each report targets a different audience: Politie, Bank, Telco, Public.
"""
import asyncio
import logging
import os
import sys
from pathlib import Path

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

import anthropic
import httpx

from agents.models import Extraction

log = logging.getLogger(__name__)

_client = anthropic.AsyncAnthropic()

PUBLISH_URL = os.getenv("PUBLISH_URL", "http://localhost:8000/publish")
_DEFAULT_VAULT = Path(__file__).resolve().parents[2] / "vault"
VAULT_ROOT = Path(os.getenv("VAULT_PATH", str(_DEFAULT_VAULT)))

# ── Report definitions ────────────────────────────────────────────────────────

_REPORTS = [
    {
        "id": "politie",
        "audience": "Politie",
        "system": (
            "Je schrijft officiële meldingen voor de Nederlandse Politie, afdeling cybercrime. "
            "Gebruik formele taal. Structureer het rapport als een zaakdossier met kopjes. "
            "Wees feitelijk en precies — geen speculatie."
        ),
        "prompt_template": (
            "Schrijf een politiemelding voor de volgende oplichtersinformatie:\n\n"
            "Organisatie: {claimed_organisation}\n"
            "IBAN: {iban} (richting: {iban_direction})\n"
            "Terugbelnummer: {callback_number}\n"
            "Betaalmethode: {payment_method}\n"
            "Tactieken: {tactics}\n"
            "Urgentiescore: {urgency_score}/10\n"
            "Scriptpatroon: {script_signature}\n\n"
            "Gebruik kopjes: Samenvatting, Modus Operandi, Technische Details, Aanbevolen Actie."
        ),
    },
    {
        "id": "bank",
        "audience": "Bank fraudeteam",
        "system": (
            "Je schrijft interne fraudemeldingen voor het fraudeteam van een Nederlandse bank. "
            "Gebruik professionele maar toegankelijke taal. Focus op het IBAN, het scriptpatroon "
            "en aanbevolen blokkeermaatregelen."
        ),
        "prompt_template": (
            "Schrijf een fraudemelding voor het bankfraudeteam:\n\n"
            "Organisatie geïmiteerd: {claimed_organisation}\n"
            "Verdacht IBAN: {iban}\n"
            "IBAN richting: {iban_direction}\n"
            "Scriptpatroon: {script_signature}\n"
            "Tactieken: {tactics}\n\n"
            "Gebruik kopjes: Fraudemelding, Verdacht Rekeningnummer, Script Analyse, Actie Vereist."
        ),
    },
    {
        "id": "telco",
        "audience": "Telecomprovider",
        "system": (
            "Je schrijft misbruikmeldingen voor de afdeling nummerhandhaving van een Nederlandse telecomprovider. "
            "Focus op het misbruikte telefoonnummer en verzoek tot blokkering."
        ),
        "prompt_template": (
            "Schrijf een nummerhandhavingsmelding:\n\n"
            "Misbruikt terugbelnummer: {callback_number}\n"
            "Organisatie geïmiteerd: {claimed_organisation}\n"
            "Scriptpatroon: {script_signature}\n"
            "Urgentiescore: {urgency_score}/10\n\n"
            "Gebruik kopjes: Melding Nummermisbruik, Bewijs, Verzoek tot Actie."
        ),
    },
    {
        "id": "public",
        "audience": "Publiek",
        "system": (
            "Je schrijft publiekswaarschuwingen over oplichting voor gewone Nederlanders, "
            "inclusief ouderen. Gebruik eenvoudige, duidelijke taal. Geen jargon. "
            "Maak het herkenbaar en praktisch: wat zijn de signalen, wat moet je doen."
        ),
        "prompt_template": (
            "Schrijf een publiekswaarschuwing over dit type oplichting:\n\n"
            "Type oplichting: {script_signature}\n"
            "Organisatie geïmiteerd: {claimed_organisation}\n"
            "Tactieken: {tactics}\n\n"
            "Gebruik kopjes: ⚠️ Waarschuwing, Hoe Herken Je Dit?, Wat Moet Je Doen?, "
            "Wat Doet Een Echte Bank Nooit?. Schrijf voor een breed publiek inclusief ouderen."
        ),
    },
]


# ── Core functions ────────────────────────────────────────────────────────────

async def _generate_one(report_def: dict, extraction: Extraction) -> str:
    """Generate a single report using Claude. Returns markdown string."""
    prompt = report_def["prompt_template"].format(
        claimed_organisation=extraction.claimed_organisation or "onbekend",
        iban=extraction.iban or "niet gevonden",
        iban_direction=extraction.iban_direction or "onbekend",
        callback_number=extraction.callback_number or "niet gevonden",
        payment_method=extraction.payment_method or "onbekend",
        tactics=", ".join(extraction.tactics) if extraction.tactics else "geen",
        urgency_score=extraction.urgency_score,
        script_signature=extraction.script_signature or "onbekend",
    )

    try:
        response = await asyncio.wait_for(
            _client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=report_def["system"],
                messages=[{"role": "user", "content": prompt}],
            ),
            timeout=30.0,
        )
    except asyncio.TimeoutError:
        log.warning("reporter: timeout generating %s report", report_def["id"])
        return f"# {report_def['audience']} rapport\n\n*Rapport kon niet worden gegenereerd (timeout).*\n"

    if not response.content:
        return f"# {report_def['audience']} rapport\n\n*Rapport kon niet worden gegenereerd.*\n"

    return response.content[0].text.strip()


def _write_report(call_id: str, report_id: str, content: str) -> Path:
    """Write report to vault/_reports/{call_id}-{report_id}.md (sync — call via executor)."""
    report_dir = VAULT_ROOT / "_reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    path = report_dir / f"{call_id}-{report_id}.md"
    path.write_text(content, encoding="utf-8")
    return path


async def _write_report_async(call_id: str, report_id: str, content: str) -> Path:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _write_report, call_id, report_id, content)


async def _publish(payload: dict) -> None:
    async with httpx.AsyncClient() as http:
        try:
            await http.post(PUBLISH_URL, json=payload, timeout=5.0)
        except httpx.RequestError:
            pass


# ── Main entry point ──────────────────────────────────────────────────────────

async def generate_reports(call_id: str, extraction: Extraction) -> list[Path]:
    """Generate all 4 reports and write to vault. Returns list of paths written."""
    if not extraction.is_scam or extraction.is_scam_confidence < 0.7:
        log.info("reporter: skipping non-scam call %s", call_id)
        return []

    async def _run_one(report_def: dict) -> Path:
        log.info("reporter: generating %s report for %s", report_def["id"], call_id)
        content = await _generate_one(report_def, extraction)
        path = await _write_report_async(call_id, report_def["id"], content)
        log.info("reporter: wrote %s", path)
        await _publish({
            "type": "report_ready",
            "call_id": call_id,
            "report_id": report_def["id"],
            "audience": report_def["audience"],
            "path": str(path),
            "preview": content.strip()[:200],
        })
        return path

    active_reports = [
        r for r in _REPORTS
        if r["id"] != "telco" or extraction.callback_number  # skip telco if no number
    ]
    written = list(await asyncio.gather(*[_run_one(r) for r in active_reports]))
    log.info("reporter: %d reports written for %s", len(written), call_id)
    return written


# ── Standalone test ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    from agents.listener import CANNED_TRANSCRIPT, extract

    async def _test() -> None:
        print("Extracting from canned transcript...")
        extraction = await extract(CANNED_TRANSCRIPT)
        print(f"is_scam={extraction.is_scam}, confidence={extraction.is_scam_confidence}")

        print("\nGenerating reports...")
        paths = await generate_reports("test-report-001", extraction)

        for path in paths:
            print(f"\n{'='*60}")
            print(f"  {path.name}")
            print('='*60)
            print(Path(path).read_text()[:500], "...\n")

    asyncio.run(_test())
