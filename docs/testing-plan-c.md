# Plan C — End-to-End Testing Guide

This guide explains how to verify that Plan C is working: the frontend connects to the real P1 SSE stream, shows live transcript events, and the "Start Demo" button triggers an outbound call.

---

## What Plan C changes

| File | What changed |
|------|-------------|
| `frontend/web/lib/real-bus.ts` | New file — wraps `EventSource`, reconnects with backoff |
| `frontend/web/lib/sse.ts` | Conditionally imports `real-bus` when `NEXT_PUBLIC_SSE_URL` is set |
| `frontend/web/.env.local.example` | Template for the two env vars needed |
| `frontend/web/app/live/page.tsx` | "Start Demo" button (real mode only), dynamic call ID from events |

Without `NEXT_PUBLIC_SSE_URL` the frontend falls back to mock fixtures — existing demo mode is unchanged.

---

## Prerequisites

You need all three services running. Open **three terminals**.

### Terminal 1 — P1 (Vapi webhook + SSE bus)

```bash
cd apps/api
cp .env.example .env          # fill in VAPI_API_KEY, ELEVENLABS_API_KEY, etc.
pip install -r requirements.txt
uvicorn main:app --port 8080 --reload
```

Verify: `curl http://localhost:8080/healthz` should return `{"status":"ok"}` (or equivalent).

### Terminal 2 — P2 (intelligence pipeline + vault writer)

```bash
cd backend
cp .env.example .env          # set VAULT_PATH=../vault, ANTHROPIC_API_KEY, etc.
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

Verify: `curl http://localhost:8000/healthz` should return `{"status":"ok"}`.

### Terminal 3 — Frontend

```bash
cd frontend/web
cp .env.local.example .env.local   # already has the right defaults
pnpm install
pnpm dev
```

The frontend starts at **http://localhost:3000**.

---

## Step-by-step test flow

### 1. Confirm mock mode is gone

Open http://localhost:3000/live **without** setting `NEXT_PUBLIC_SSE_URL`.

Expected: transcript stream shows fixture events replaying automatically (mock mode, no "Start Demo" button). This is unchanged.

### 2. Switch to real SSE mode

Stop the frontend. Ensure `frontend/web/.env.local` contains:

```
NEXT_PUBLIC_SSE_URL=http://localhost:8080/events
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Restart `pnpm dev`.

### 3. Verify SSE connection

Open http://localhost:3000/live.

Expected:
- Page loads with an **empty** transcript (no fixture events replay).
- Call ID header shows **"waiting…"** instead of a hardcoded `call-0042`.
- A **"Start Demo"** button appears in the top-right (lime/accent color).
- Browser DevTools → Network → filter `EventStream` shows a persistent connection to `http://localhost:8080/events`.

### 4. Trigger a demo call

Click **"Start Demo"** on the `/live` page (or run the curl equivalent):

```bash
curl -X POST http://localhost:8080/demo/trigger
```

Expected within ~2 seconds:
- The call ID header updates from "waiting…" to the real `call_id` (e.g. `call-0042`).
- Transcript lines start appearing one by one in the stream panel.
- The extraction sidebar starts populating (claimed bank, IBAN, tactics, etc.).
- The `CallTimer` starts counting up.

### 5. Verify reconnect behavior

While the frontend is showing a live call, kill P1 (`Ctrl+C` in Terminal 1).

Expected:
- The browser console logs `[real-bus] connection lost, reconnecting in 500ms`.
- Retry attempts are visible in the console with increasing delays (500ms, 1s, 2s, …, 10s max).
- No crash or error shown to the user on screen.

Restart P1. Expected: the `EventSource` reconnects automatically within one backoff cycle.

### 6. Verify call end

Wait for the call to finish (or send a manual `call_ended` event):

```bash
# Simulate call_ended manually via P1's SSE publish endpoint
curl -X POST http://localhost:8080/publish \
  -H "Content-Type: application/json" \
  -d '{"type":"call_ended","call_id":"call-0042","t_offset_ms":60000,"duration_s":60}'
```

Expected:
- `CallTimer` freezes.
- `/live` page shows the call as ended.

Then open **http://localhost:3000/graph** — the new call node should appear (requires Plan B to be merged).

Then open **http://localhost:3000/reports** — the 4 stakeholder reports for the new call should be visible (requires Plan A reporter fix to be merged).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| "Start Demo" button not visible | `NEXT_PUBLIC_SSE_URL` not set or frontend not restarted after adding it | Set env var, restart `pnpm dev` |
| EventStream not visible in DevTools | P1 not running or wrong port | Check Terminal 1, verify port 8080 |
| Transcript empty after clicking Start Demo | P1→P2 bridge not wired (`P2_INGEST_URL` unset) or P2 not running | Plan A fixes this; set `P2_INGEST_URL=http://localhost:8000` in `apps/api/.env` |
| `[real-bus] unknown event type` in console | P1 emits old field names (`type: "transcript"` instead of `"transcript_delta"`) | Plan A fixes the field names |
| `triggerError` shows "Demo trigger failed: 404" | P1 `/demo/trigger` route not implemented | Check `apps/api/main.py` for the route |
| Mock fixture replay still running | Old `.env.local` without `NEXT_PUBLIC_SSE_URL`, or Next.js cache | Delete `.next/` and restart |

---

## Mock mode fallback (demo safety net)

Remove or comment out `NEXT_PUBLIC_SSE_URL` from `.env.local` and restart. The frontend silently falls back to `mock-bus.ts` fixture replay — no code change needed. The "Start Demo" button disappears and "Replay demo" returns.

This is the safe demo fallback if the backend is unavailable.
