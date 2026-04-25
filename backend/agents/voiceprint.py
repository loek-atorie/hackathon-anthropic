"""Voiceprint placeholder — hash-based scammer cluster ID.

NOT real voice biometrics. Takes caller metadata and produces a stable
12-char ID that groups calls likely from the same scammer operation.

Same phone + same script + same org → same ID every time.
This makes Obsidian draw edges between calls from the same operation.

Marked clearly as mock so the roadmap pitch is honest.
"""
import asyncio
import hashlib
import logging
import os
import sys
from datetime import datetime, timezone
from functools import partial
from pathlib import Path

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

import httpx

from agents.models import Extraction

log = logging.getLogger(__name__)

PUBLISH_URL = os.getenv("PUBLISH_URL", "http://localhost:8000/publish")
VAULT_ROOT = Path(os.getenv("VAULT_PATH", "/home/pskpe/hackathon-anthropic/vault"))


# ── Hash logic ────────────────────────────────────────────────────────────────

def compute_voice_id(
    caller_number: str | None,
    script_signature: str | None,
    claimed_organisation: str | None,
) -> str:
    """
    Produce a stable 12-char cluster ID from caller metadata.
    Same inputs always produce the same ID — no randomness.
    """
    if not any([caller_number, script_signature, claimed_organisation]):
        return None  # nothing to cluster on — don't group all unknowns together
    raw = "|".join([
        (caller_number or "unknown").strip().lower(),
        (script_signature or "unknown").strip().lower(),
        (claimed_organisation or "unknown").strip().lower(),
    ])
    return hashlib.sha256(raw.encode()).hexdigest()[:12]


# ── Vault file ────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _upsert_scammer(voice_id: str, call_id: str, extraction: Extraction) -> Path:
    """Create or update vault/scammers/{voice_id}.md."""
    path = VAULT_ROOT / "scammers" / f"{voice_id}.md"

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
        path.write_text(text, encoding="utf-8")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        content = f"""---
type: scammer
cluster_id: {voice_id}
mock: true
first_seen: {_now()}
seen_in_calls: ["[[{call_id}]]"]
script_signature: "{extraction.script_signature or 'unknown'}"
claimed_organisation: "{extraction.claimed_organisation or 'unknown'}"
notes: "Hash-based mock cluster — not real voice biometrics"
---

# Scammer Cluster {voice_id}

> ⚠️ Mock voiceprint — hash-based cluster, not real biometrics.

First detected in [[{call_id}]].

**Script:** {extraction.script_signature or "—"}
**Organisation impersonated:** {extraction.claimed_organisation or "—"}
"""
        path.write_text(content, encoding="utf-8")

    return path


# ── Main entry point ──────────────────────────────────────────────────────────

async def fingerprint(
    call_id: str,
    extraction: Extraction,
    caller_number: str | None = None,
) -> str | None:
    """Compute voice ID, write vault file, publish to SSE. Returns voice_id."""
    if not extraction.is_scam or extraction.is_scam_confidence < 0.7:
        return None

    voice_id = compute_voice_id(
        caller_number,
        extraction.script_signature,
        extraction.claimed_organisation,
    )
    if voice_id is None:
        log.info("voiceprint: insufficient metadata for %s — skipping", call_id)
        return None

    loop = asyncio.get_running_loop()
    path = await loop.run_in_executor(None, partial(_upsert_scammer, voice_id, call_id, extraction))
    log.info("voiceprint: cluster %s → %s", voice_id, path)

    async with httpx.AsyncClient() as http:
        try:
            await http.post(PUBLISH_URL, json={
                "type": "voiceprint",
                "call_id": call_id,
                "voice_id": voice_id,
                "mock": True,
                "script_signature": extraction.script_signature,
                "claimed_organisation": extraction.claimed_organisation,
            }, timeout=5.0)
        except httpx.RequestError:
            pass

    return voice_id


# ── Standalone test ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import asyncio

    async def _test() -> None:
        extraction = Extraction(
            is_scam=True,
            is_scam_confidence=1.0,
            claimed_organisation="ING",
            script_signature="bank-helpdesk",
        )

        cases = [
            ("call-001", "+31612345678"),
            ("call-002", "+31612345678"),   # same number → same ID
            ("call-003", "+31699999999"),   # different number → different ID
            ("call-004", None),             # no number → still works
        ]

        print("Voice cluster IDs:\n")
        for call_id, caller_number in cases:
            vid = await fingerprint(call_id, extraction, caller_number)
            print(f"  {call_id}  caller={caller_number or 'unknown':20s}  → cluster: {vid}")

        print("\nVault files:")
        for f in sorted((VAULT_ROOT / "scammers").glob("*.md")):
            print(f"  {f.name}")

    asyncio.run(_test())
