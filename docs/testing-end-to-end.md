# Testing the End-to-End Flow

This guide walks you through running a real scam call through the full pipeline and verifying every layer in the UI.

---

## What you're testing

```
Vapi call → P1 webhook → normalise → P2 ingest
  → Claude extraction → vault files written
  → graph_node_added events → frontend graph updates
  → call ends → reports generated → /reports page updates
```

---

## Prerequisites

### 1. Clone and install

```bash
git clone git@github.com:loek-atorie/hackathon-anthropic.git
cd hackathon-anthropic
git checkout plan-a   # or the branch/PR you're testing
```

Install backend dependencies:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

Install P1 dependencies:

```bash
cd apps/api
pip install -r requirements.txt
cd ..
```

Install frontend:

```bash
cd frontend/web
pnpm install
cd ../..
```

### 2. Set up environment files

**`apps/api/.env`** — copy from example and fill in Vapi credentials:

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and fill in:

```
VAPI_API_KEY=<your Vapi API key>
VAPI_ASSISTANT_ID_MEVROUW=<assistant ID for Mevrouw Jansen>
VAPI_ASSISTANT_ID_SCAMMER=<assistant ID for the Scammer Agent>
VAPI_PHONE_NUMBER_ID=<phone number ID in Vapi dashboard>
MEVROUW_PHONE_NUMBER=<the Dutch DID Mevrouw answers on, e.g. +31...>
ANTHROPIC_API_KEY=<your Anthropic API key>
P2_INGEST_URL=http://localhost:8000
```

**`backend/.env`** — only the API key is required (VAULT_PATH is auto-detected):

```
ANTHROPIC_API_KEY=<same or different Anthropic API key>
```

> `VAULT_PATH` defaults to `vault/` in the repo root. You do not need to set it.

### 3. Expose P1 to Vapi with ngrok (required for real calls)

Vapi needs a public HTTPS URL to post webhook events to. In a separate terminal:

```bash
ngrok http 8080
```

Copy the `https://xxxx.ngrok-free.app` URL, then in the **Vapi dashboard**:
- Go to your assistant → **Server URL**
- Set it to `https://xxxx.ngrok-free.app/vapi/webhooks`

> Without this, Vapi can't send transcript chunks back to P1 and the pipeline won't run.

---

## Starting the services

Open **three terminal tabs**.

**Tab 1 — P2 backend (extraction + reports):**

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --port 8000 --reload
```

You should see: `Application startup complete.`

**Tab 2 — P1 API (Vapi bridge + SSE):**

```bash
cd apps/api
uvicorn main:app --port 8080 --reload
```

You should see: `Application startup complete.`

**Tab 3 — Frontend:**

```bash
cd frontend/web
NEXT_PUBLIC_SSE_URL=http://localhost:8080/events pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Triggering the call

Run the integration test script from the repo root:

```bash
bash scripts/test-integration.sh
```

This will:
1. Check P1 and P2 are healthy
2. Call `POST /demo/trigger` on P1 — Vapi places a real outbound call from the Scammer Agent to Mevrouw's DID
3. Stream P1's SSE endpoint in your terminal so you see events in real time
4. Print a summary when the call ends

Alternatively, trigger manually:

```bash
curl -X POST http://localhost:8080/demo/trigger
```

---

## What to watch in the UI

### `/live` — Real-time transcript

Open [http://localhost:3000/live](http://localhost:3000/live) as soon as the call starts.

**What you should see:**
- Transcript lines appearing in real time as the call progresses
  - Scammer lines appear on one side (labelled `scammer`)
  - Mevrouw lines on the other (labelled `mevrouw`)
- The extraction sidebar on the right updating as Claude identifies entities:
  - Claimed organisation (e.g. ING)
  - IBAN
  - Tactics detected
  - Urgency score
  - Script signature (e.g. `bank-helpdesk`)

**If nothing appears:** Check that `NEXT_PUBLIC_SSE_URL` is set and P1 is running. Open browser DevTools → Network → filter `events` to see if the SSE connection is established.

---

### `/graph` — Knowledge graph

Open [http://localhost:3000/graph](http://localhost:3000/graph) after the call ends (or during — nodes arrive as the vault is written).

**What you should see:**
- A new call node (e.g. `call-20260425143211`) connected by edges to:
  - An IBAN node (if one was extracted)
  - An organisation node (e.g. `ING`)
  - A script node (e.g. `bank-helpdesk`)
- Nodes from earlier seeded calls are still visible — the new call links into the existing graph

**If no new node appears:** Check `vault/calls/` — if the file exists there, the vault write succeeded but the SSE `graph_node_added` event may not have reached the frontend. Refresh the page (`router.refresh()`) to force a server re-read of the vault.

---

### `/reports` — Stakeholder reports

Open [http://localhost:3000/reports](http://localhost:3000/reports) about 15–20 seconds after the call ends (Claude needs time to generate all four reports).

**What you should see:**
- Four tabs: Politie / Bank / Telco / Publiek
- Each tab shows a structured Dutch-language report for the call that just ended
- The Politie report contains: Samenvatting, Modus Operandi, Technische Details, Aanbevolen Actie
- The Bank report focuses on the IBAN and script pattern
- The Publiek report is written for a general audience (including elderly readers)

**If reports are missing:** Check `vault/_reports/` — files should be named `{call_id}-politie.md`, `{call_id}-bank.md`, etc. If they're not there, check the P2 terminal for errors from the reporter agent (requires `is_scam=true` and confidence ≥ 0.7).

---

## Verifying vault output directly

After the call, confirm the vault files were written:

```bash
ls -lt vault/calls/       # most recent call file at top
ls -lt vault/_reports/    # 4 report files per call
ls -lt vault/ibans/       # IBAN file if one was extracted
ls -lt vault/organisations/
```

Read a report:

```bash
cat vault/_reports/<call_id>-politie.md
```

---

## Checking service health

```bash
# P1 health
curl http://localhost:8080/healthz

# P2 health (shows subscriber count)
curl http://localhost:8000/health
```

---

## Aborting a stuck call

If a call gets stuck (Vapi billing continues while a call is live):

```bash
curl -X POST http://localhost:8080/demo/abort
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `/demo/trigger` returns 500 with "Missing env vars" | `apps/api/.env` incomplete | Fill in all `VAPI_*` vars |
| Transcript appears in P1 terminal but not in `/live` | `NEXT_PUBLIC_SSE_URL` not set in frontend | Restart with env var set |
| Vault files written but no reports | `is_scam_confidence < 0.7` or call too short | Use the canned transcript test below |
| P2 crashes on startup with ImportError | Missing `python-dotenv` | `pip install -r backend/requirements.txt` |
| Graph shows no new nodes after call | Vault write failed | Check P2 logs for `vault write failed` errors |
| Vapi webhooks not arriving | ngrok not set as Server URL in Vapi dashboard | Update Server URL in Vapi dashboard |

---

## Offline test (no Vapi needed)

To test the extraction + vault + reports pipeline without a real call, send the canned transcript directly to P2:

```bash
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "test-offline-001",
    "text": "Oplichter: Goedemiddag, u spreekt met de beveiligingsdienst van ING Bank. Mijn naam is meneer De Vries, personeelsnummer 4471. We hebben verdachte transacties gedetecteerd. U moet uw geld overmaken naar rekeningnummer NL91ABNA0417164300. Dit is code rood, hoogste urgentie. Terugbellen op 020-1234567."
  }'
```

Wait 10 seconds, then check:

```bash
ls vault/calls/test-offline-001.md
ls vault/_reports/test-offline-001-*.md
```

This bypasses Vapi and ngrok entirely — useful for verifying Claude extraction and report generation in isolation.
