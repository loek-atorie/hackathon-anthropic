# Claude Code Instructions — Scammer's Mirror

## Workflow rules

- Run all commands yourself — do not ask the user to run them
- Only pause to ask the user for confirmation before: deleting files, pushing to git, or making changes that affect teammates (P1, P3)
- One step at a time — complete each step fully before moving to the next
- After every step:
  1. Run the code and show the output
  2. Review for bugs, edge cases, and best practices
  3. Fix any issues found before moving on
  4. Write or update tests to cover the new code and edge cases
  5. Show what was done, what the output means, and what's next

## Project layout

```
hackathon-anthropic/
├── backend/                  ← Python / FastAPI (this is P2's track)
│   ├── main.py               ← FastAPI app, SSE bus (/events, /publish)
│   ├── agents/
│   │   ├── models.py         ← shared Extraction model
│   │   ├── listener.py       ← Claude extraction agent
│   │   └── graph_builder.py  ← Obsidian vault writer
│   ├── tests/                ← test scripts
│   └── .env                  ← ANTHROPIC_API_KEY (never commit)
└── vault/                    ← Obsidian markdown files
    ├── calls/
    ├── ibans/
    ├── organisations/
    └── scripts/
```

## Always run commands from

```bash
cd /home/pskpe/hackathon-anthropic/backend
```

## Python environment

```bash
# Load env vars
set -a && source .env && set +a

# Run Python
.venv/bin/python <script>

# Install packages
.venv/bin/pip install <package>
```

## Running tests

```bash
cd /home/pskpe/hackathon-anthropic/backend && set -a && source .env && set +a && .venv/bin/python tests/test_cases.py
cd /home/pskpe/hackathon-anthropic/backend && set -a && source .env && set +a && .venv/bin/python tests/test_graph_builder.py
```

## Running the server

```bash
cd /home/pskpe/hackathon-anthropic/backend && set -a && source .env && set +a && .venv/bin/uvicorn main:app --reload --port 8000
```

## What's built (P2 track status)

| Component | Status |
|---|---|
| FastAPI skeleton + SSE bus (`/events`, `/publish`) | ✅ Done |
| Listener — Claude extraction from NL transcript | ✅ Done |
| Graph Builder — writes Obsidian vault markdown | ✅ Done |
| Wired: listener → graph builder → SSE | ✅ Done |
| Interrogator agent | ⬜ Next |
| Reporter — 4 stakeholder reports | ⬜ |
| Voiceprint placeholder | ⬜ |
| Integration with P1 (Vapi transcript stream) | ⬜ |

## Extraction schema (current)

Fields emitted by `agents/listener.py`:
- `language` — nl / en / tr / ar / other
- `claimed_organisation` — impersonated org (bank, police, PostNL, etc.)
- `iban` + `iban_direction` — IBAN and whether victim sends TO it or gives it
- `payment_method` — iban / gift_card / crypto / western_union / foreign_account
- `callback_number`
- `tactics[]` — urgency / authority / fear / isolation / pretexting / social_proof / scarcity / reciprocity
- `urgency_score` — 0–10
- `is_scam` + `is_scam_confidence` — explicit verdict + confidence
- `script_signature` — enum: bank-helpdesk / overheid-boete / pakket-fraude / microsoft-support / investering-fraude / belasting-teruggave / romance-fraude / opa-oma-fraude / loterij-fraude / voorschot-fraude / other / none

## Key decisions made

- Reson8 MCP not integrated — using Claude directly (tested, reliable, identical output)
- Graph Builder only writes vault files when `is_scam: true` AND `confidence >= 0.7`
- Vault writes are atomic (temp file + os.replace) and file-locked (fcntl) for concurrency safety
- `Extraction` model lives in `agents/models.py` to avoid circular imports
- Minimum 8 words in transcript before calling Claude (skip short/wrong-number calls)
- `script_signature` is a fixed enum — Claude cannot invent new categories

## SSE events emitted

| Event type | When |
|---|---|
| `extraction` | After every Claude extraction |
| `graph_update` | After vault files are written (scam confirmed only) |
