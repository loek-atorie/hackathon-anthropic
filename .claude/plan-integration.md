# Integration End-to-End Plan

## Context

The hackathon demo requires a live end-to-end flow: Vapi phone call → real-time transcript on `/live` → Claude extraction → vault write → knowledge graph update on `/graph` → stakeholder reports on `/reports`. Currently every layer is mocked or disconnected:

- P1 webhook emits wrong event shape (`type: "transcript"`, `callId`, `role`) vs. frontend contract (`type: "transcript_delta"`, `call_id`, `speaker`)
- P2 backend has no connection to P1's SSE — transcript chunks never reach the extraction pipeline
- Frontend is hardwired to `mock-bus.ts` fixtures; real SSE is not wired
- Graph page synthesizes a hardcoded `DEMO_CALL_NODE` instead of reading real vault data
- Reporter writes to `vault/reports/{call_id}/politie.md` but the frontend scans `vault/_reports/{call_id}-politie.md`
- `VAULT_PATH` is hardcoded to `/home/pskpe/...` — will fail on any other machine
- `graph_node_added` event is defined in `lib/types.ts` but never emitted by P2

The work is split into **3 independent plans** designed to avoid merge conflicts: each plan owns distinct files with no overlapping edits.

---

## Plan A — P1 Webhook Normalization + P2 Bridge (Backend only)

**Owner files:** `apps/api/vapi/webhooks.py`, `apps/api/streaming.py`, `backend/agents/graph_builder.py`, `backend/agents/reporter.py`, `backend/.env`, `apps/api/.env.example`

**Goal:** Make P1 emit BusEvent-compatible JSON, and make P2 subscribe to P1's SSE so every transcript chunk triggers extraction.

### Steps

1. **Fix field names in `apps/api/vapi/webhooks.py`**
   - `transcript` event: rename `type` → `"transcript_delta"`, `callId` → `call_id`, `role` → `speaker` (map `"user"` → `"scammer"`, `"assistant"` → `"mevrouw"`), add `t_offset_ms` (use Unix ms from `message.get("timestamp")` or derive from call start), rename `transcript` field → `text`
   - `end-of-call-report` event: emit `{"type": "call_ended", "call_id": ..., "duration_s": ...}` (pull duration from `message.endedReason` or `message.durationSeconds`)
   - Keep `function-call` and `status-update` pass-through as-is (frontend ignores them)

2. **Bridge P1 → P2: forward transcript chunks and call_ended**
   - In `apps/api/vapi/webhooks.py`, after publishing to P1 bus, also POST `http://P2_INGEST_URL/ingest` for each `transcript_delta` (fire-and-forget with `httpx.AsyncClient` timeout=2s)
   - Add `P2_INGEST_URL` env var to `apps/api/.env.example` (default empty = disabled)
   - On `call_ended`: POST `http://P2_INGEST_URL/call_ended` with `call_id` and `duration_s` so P2 can finalize vault + reports

3. **Fix `VAULT_PATH` default** in `backend/agents/graph_builder.py` and `backend/agents/reporter.py`
   - Change default from `/home/pskpe/hackathon-anthropic/vault` → relative `../vault` resolved from `__file__`, with fallback to `VAULT_PATH` env var
   - Add `VAULT_PATH` to `backend/.env` pointing to the repo's vault/ folder

4. **Fix reporter output path** in `backend/agents/reporter.py`
   - Currently writes `vault/reports/{call_id}/{report_id}.md`
   - Change to `vault/_reports/{call_id}-{report_id}.md` to match frontend's `report-reader.ts` scan pattern (`vault/_reports/{callId}-{politie,bank,telco,public}.md`)

5. **Emit `graph_node_added` from P2 listener** in `backend/agents/listener.py`
   - After `graph_builder.build()` returns the list of written files, for each file emit `{"type": "graph_node_added", "call_id": ..., "node_id": ..., "node_type": ..., "markdown_path": ...}`
   - These go to P2's SSE `/publish`; the frontend will pick them up once Plan C wires real SSE

**No frontend files touched. No vault-reader touched.**

---

## Plan B — Graph Page: Real Vault Nodes Instead of DEMO_CALL_NODE

**Owner files:** `frontend/web/components/graph-view.tsx` only

**Goal:** When `call_ended` or `graph_node_added` arrives on the bus, fetch the real vault node instead of injecting the hardcoded `DEMO_CALL_NODE`.

### Steps

1. **Remove `DEMO_CALL_NODE`, `DEMO_CALL_ID`, `DEMO_TARGET_IDS` constants** from `graph-view.tsx`

2. **Handle `graph_node_added` events** — the event carries `{ node_id, node_type, markdown_path }`. On receipt:
   - Fetch `GET /api/vault-node?path={markdown_path}` to get the full `GraphNode` (see step 3)
   - Add the returned node + its wikilink edges to the graph state
   - Trigger the existing highlight pulse on the new `node_id`

3. **Add a minimal Next.js API route** `frontend/web/app/api/vault-node/route.ts`
   - `GET /api/vault-node?path=vault/calls/call-0042.md`
   - Reads the single markdown file, parses with `gray-matter`, resolves wikilinks against known node IDs, returns `{ node: GraphNode, edges: GraphEdge[] }`
   - Reuses the wikilink parser already in `vault-reader.ts`

4. **Keep `call_ended` handler** but use it only to trigger a full vault reload via `router.refresh()` (Next.js App Router) as a fallback if no `graph_node_added` events arrive within 3 seconds

**No backend files touched. No SSE wiring touched (still uses mock-bus until Plan C).**

---

## Plan C — Frontend: Real SSE + Remove Mock Data

**Owner files:** `frontend/web/lib/sse.ts`, `frontend/web/lib/mock-bus.ts` (keep as fallback), `frontend/web/app/live/page.tsx` (env-flag only), new file `frontend/web/lib/real-bus.ts`, `.env.local.example` in `frontend/web/`

**Goal:** Swap mock-bus for a real EventSource connection to P1's SSE endpoint, gated by an env var so dev can still use fixtures.

### Steps

1. **Create `frontend/web/lib/real-bus.ts`**
   - Wraps `new EventSource(process.env.NEXT_PUBLIC_SSE_URL)` (e.g. `http://localhost:8080/events`)
   - Parses `event.data` as JSON, type-narrows to `BusEvent` using the discriminated union from `lib/types.ts`
   - Returns same `subscribe(handler) → unsubscribe` signature as mock-bus
   - Handles reconnect on error (exponential backoff, max 10s)

2. **Update `frontend/web/lib/sse.ts`**
   - Replace static `import { subscribe } from "./mock-bus"` with conditional:
     ```ts
     const { subscribe } = process.env.NEXT_PUBLIC_SSE_URL
       ? await import("./real-bus")
       : await import("./mock-bus");
     ```
   - If `NEXT_PUBLIC_SSE_URL` is not set, falls back to mock-bus (dev fixtures still work)

3. **Add env vars to `frontend/web/.env.local.example`**
   - `NEXT_PUBLIC_SSE_URL=http://localhost:8080/events` — P1's SSE stream

4. **Remove demo trigger button hardcoding** on `/live` page if present — replace with a "Start Demo" button that POSTs to `NEXT_PUBLIC_API_URL/demo/trigger`

5. **Keep `mock-bus.ts` and fixtures** — do not delete. They remain as the fallback when `NEXT_PUBLIC_SSE_URL` is unset. This is the demo safety net.

**No backend files touched. No graph components touched (Plan B owns those).**

---

## Conflict Analysis

| File | Plan A | Plan B | Plan C |
|------|--------|--------|--------|
| `apps/api/vapi/webhooks.py` | ✏️ | — | — |
| `backend/agents/listener.py` | ✏️ | — | — |
| `backend/agents/graph_builder.py` | ✏️ | — | — |
| `backend/agents/reporter.py` | ✏️ | — | — |
| `frontend/web/components/graph-view.tsx` | — | ✏️ | — |
| `frontend/web/app/api/vault-node/route.ts` | — | ✏️ (new) | — |
| `frontend/web/lib/sse.ts` | — | — | ✏️ |
| `frontend/web/lib/real-bus.ts` | — | — | ✏️ (new) |
| `frontend/web/app/live/page.tsx` | — | — | ✏️ |

Zero shared files across the three plans — **merge conflicts are structurally impossible**.

---

## What We Are NOT Doing (Scope Cuts)

- **Voice clustering (voiceprint.py)** — hash-based mock is fine for demo; no real embeddings needed
- **Interrogator → Vapi nudge** — `P1_WEBHOOK_URL` wiring is a nice-to-have; P2 still publishes hints to SSE
- **Reporter agent quality** — reports are already generated by Claude; no template redesign in this integration sprint
- **Multi-call demo** — one call at a time; global state in `outbound.py` is acceptable for hackathon

---

## Verification

After all three plans are merged to `integration-end-to-end`:

1. Start P1: `cd apps/api && uvicorn main:app --port 8080`
2. Start P2: `cd backend && uvicorn main:app --port 8000`
3. Start frontend: `cd frontend/web && pnpm dev`
4. Set `NEXT_PUBLIC_SSE_URL=http://localhost:8080/events` in `frontend/web/.env.local`
5. Set `P2_INGEST_URL=http://localhost:8000` in `apps/api/.env`
6. Trigger demo: `curl -X POST http://localhost:8080/demo/trigger`
7. Open `http://localhost:3000/live` — should show live transcript + extraction sidebar updating in real time
8. When call ends: open `http://localhost:3000/graph` — new call node should appear highlighted with wikilink edges
9. Open `http://localhost:3000/reports` — new call's 4 stakeholder reports should be visible
