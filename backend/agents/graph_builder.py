"""Graph Builder — writes Obsidian vault markdown files from extracted call intel.

One call produces up to 4 files:
  vault/calls/{call_id}.md          — always written (new file per call)
  vault/ibans/{iban}.md             — upserted (same IBAN across calls = same file)
  vault/organisations/{org}.md      — upserted
  vault/scripts/{signature}.md      — upserted

Upserts are atomic: write to .tmp then os.replace() to avoid partial writes
corrupting the vault if two calls finish simultaneously.
"""
import fcntl
import logging
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from agents.models import Extraction

log = logging.getLogger(__name__)

_DEFAULT_VAULT = Path(__file__).resolve().parents[2] / "vault"
VAULT_ROOT = Path(os.getenv("VAULT_PATH", str(_DEFAULT_VAULT)))

# Canonical org names for known Dutch targets — prevents ING vs "ING Bank" split files
_ORG_CANONICAL: dict[str, str] = {
    "ing": "ING",
    "ing bank": "ING",
    "abn amro": "ABN_AMRO",
    "abn": "ABN_AMRO",
    "rabobank": "Rabobank",
    "sns bank": "SNS_Bank",
    "sns": "SNS_Bank",
    "triodos": "Triodos",
    "politie": "Politie",
    "nationale politie": "Politie",
    "belastingdienst": "Belastingdienst",
    "postnl": "PostNL",
    "dhl": "DHL",
    "microsoft": "Microsoft",
    "gemeente": "Gemeente",
}


def _canonical_org(org: str) -> str:
    """Return a canonical filename-safe org name, falling back to _safe()."""
    return _ORG_CANONICAL.get(org.lower().strip(), _safe(org))


def _safe(name: str) -> str:
    """Strip characters invalid in filenames. Prevents path traversal."""
    return re.sub(r"[^\w\-.]", "_", name)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _atomic_write(path: Path, content: str) -> None:
    """Write content to path atomically using a temp file + rename."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp, path)  # atomic on Linux/Mac
    except Exception:
        os.unlink(tmp)
        raise


MAX_SEEN = 50


def _cap_seen_in_calls(text: str) -> str:
    """Keep only the most recent MAX_SEEN entries in seen_in_calls (frontmatter only)."""
    parts = text.split("---", 2)
    if len(parts) < 3:
        return text
    frontmatter = parts[1]
    match = re.search(r'seen_in_calls: \[([^\]]*)\]', frontmatter)
    if not match:
        return text
    items = [i.strip() for i in match.group(1).split(",") if i.strip()]
    if len(items) <= MAX_SEEN:
        return text
    items = items[:MAX_SEEN]
    new_fm = frontmatter[:match.start()] + f'seen_in_calls: [{", ".join(items)}]' + frontmatter[match.end():]
    return "---".join([parts[0], new_fm, parts[2]])


def _upsert_seen(path: Path, call_id: str, new_content_fn) -> None:
    """
    If file exists: append call_id to seen_in_calls list in frontmatter.
    If file does not exist: call new_content_fn() to create it fresh.
    """
    lock_path = path.with_suffix(".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with open(lock_path, "w") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)  # blocks until lock is free
        try:
            if path.exists():
                text = path.read_text(encoding="utf-8")
                if f'"[[{call_id}]]"' not in text:
                    parts = text.split("---", 2)
                    if len(parts) >= 3:
                        parts[1] = parts[1].replace(
                            "seen_in_calls: [",
                            f'seen_in_calls: ["[[{call_id}]]", ',
                        )
                        text = "---".join(parts)
                text = _cap_seen_in_calls(text)
                _atomic_write(path, text)
            else:
                _atomic_write(path, new_content_fn())
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)
            lock_path.unlink(missing_ok=True)


# ── Call file ─────────────────────────────────────────────────────────────────

def _call_content(call_id: str, extraction: Extraction) -> str:
    org_link = f'"[[{_canonical_org(extraction.claimed_organisation)}]]"' if extraction.claimed_organisation else "null"
    iban_link = f'"[[{extraction.iban}]]"' if extraction.iban else "null"
    script_link = f'"[[{extraction.script_signature}]]"' if extraction.script_signature and extraction.script_signature != "none" else "null"

    tactics_yaml = (
        "\n".join(f"  - {t}" for t in extraction.tactics)
        if extraction.tactics else "  []"
    )

    return f"""---
type: call
id: {call_id}
recorded_at: {_now()}
language: {extraction.language or "unknown"}
claimed_organisation: {org_link}
script: {script_link}
extracted_iban: {iban_link}
iban_direction: {extraction.iban_direction or "null"}
payment_method: {extraction.payment_method or "null"}
callback_number: {extraction.callback_number or "null"}
tactics:
{tactics_yaml}
urgency_score: {extraction.urgency_score}
is_scam: {str(extraction.is_scam).lower()}
is_scam_confidence: {extraction.is_scam_confidence}
---

# Call {call_id}

**Organisation claimed:** {extraction.claimed_organisation or "—"}
**Script pattern:** {extraction.script_signature or "—"}
**Is scam:** {"⚠️ YES" if extraction.is_scam else "✅ NO"} (confidence: {extraction.is_scam_confidence:.0%})
**Urgency:** {extraction.urgency_score}/10
**Tactics:** {", ".join(extraction.tactics) if extraction.tactics else "none detected"}

## Payment intel
- IBAN: {f"[[{extraction.iban}]]" if extraction.iban else "—"}
- Direction: {extraction.iban_direction or "—"}
- Method: {extraction.payment_method or "—"}
- Callback: {extraction.callback_number or "—"}

## Linked entities
- Organisation: {f"[[{_canonical_org(extraction.claimed_organisation)}]]" if extraction.claimed_organisation else "—"}
- Script: {f"[[{extraction.script_signature}]]" if extraction.script_signature and extraction.script_signature != "none" else "—"}
"""


# ── IBAN file ─────────────────────────────────────────────────────────────────

def _iban_content(iban: str, call_id: str, extraction: Extraction) -> str:
    status = "flagged" if extraction.is_scam else "review"
    note = (
        "This IBAN was mentioned in a call flagged as a scam."
        if extraction.is_scam
        else "This IBAN was mentioned in a call that appears legitimate. Manual review advised."
    )
    return f"""---
type: iban
iban: {iban}
first_seen: {_now()}
seen_in_calls: ["[[{call_id}]]"]
status: {status}
---

# IBAN {iban}

First seen in [[{call_id}]].

{note}
"""


# ── Organisation file ─────────────────────────────────────────────────────────

def _org_content(org: str, call_id: str) -> str:
    return f"""---
type: organisation
name: "{org}"
first_seen: {_now()}
seen_in_calls: ["[[{call_id}]]"]
---

# {org}

Impersonated in [[{call_id}]].
"""


# ── Script file ───────────────────────────────────────────────────────────────

def _script_content(signature: str, call_id: str) -> str:
    return f"""---
type: script
signature: {signature}
first_seen: {_now()}
seen_in_calls: ["[[{call_id}]]"]
---

# Script: {signature}

First observed in [[{call_id}]].
"""


# ── Main entry point ──────────────────────────────────────────────────────────

def build(call_id: str, extraction: Extraction) -> list[Path]:
    """Write all vault files for one call. Returns list of files written."""
    if not call_id or not call_id.strip():
        raise ValueError("call_id must be a non-empty string")
    written: list[Path] = []

    # Call file — always a new file, no upsert needed
    call_path = VAULT_ROOT / "calls" / f"{_safe(call_id)}.md"
    if call_path.exists():
        raise ValueError(f"call_id {call_id!r} already exists in vault — Vapi IDs must be unique")
    _atomic_write(call_path, _call_content(call_id, extraction))
    log.info("wrote call file: %s", call_path)
    written.append(call_path)

    # IBAN file — upsert (same IBAN may appear across multiple calls)
    if extraction.iban:
        iban_path = VAULT_ROOT / "ibans" / f"{_safe(extraction.iban)}.md"
        _upsert_seen(iban_path, call_id, lambda: _iban_content(extraction.iban, call_id, extraction))
        log.info("upserted iban file: %s", iban_path)
        written.append(iban_path)

    # Organisation file — upsert
    if extraction.claimed_organisation:
        org_path = VAULT_ROOT / "organisations" / f"{_canonical_org(extraction.claimed_organisation)}.md"
        _upsert_seen(org_path, call_id, lambda: _org_content(extraction.claimed_organisation, call_id))
        log.info("upserted org file: %s", org_path)
        written.append(org_path)

    # Script file — upsert (skip "none" and "other" — not useful as graph nodes)
    if extraction.script_signature and extraction.script_signature not in ("none", "other"):
        script_path = VAULT_ROOT / "scripts" / f"{_safe(extraction.script_signature)}.md"
        _upsert_seen(script_path, call_id, lambda: _script_content(extraction.script_signature, call_id))
        log.info("upserted script file: %s", script_path)
        written.append(script_path)

    log.info("graph build complete for %s: %d files written", call_id, len(written))
    return written
