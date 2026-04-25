# Plan B — End-to-End UI Test Guide

This document explains how to verify that Plan B is working correctly in the browser — no backend required. All testing uses the mock-bus fixture data already embedded in the frontend.

---

## What Plan B Changes

Before Plan B, the `/graph` page injected a hardcoded `DEMO_CALL_NODE` (call-0042 with fictional edges) whenever a `call_ended` event fired. After Plan B:

1. When a `graph_node_added` event fires, the frontend fetches `/api/vault-node?path=<markdown_path>` and adds the **real vault node** to the graph.
2. When `call_ended` fires without any `graph_node_added` events within 3 seconds, the page does a `router.refresh()` to reload from vault.
3. The "Replay" button resets everything cleanly.

---

## Prerequisites

- Node.js 18+ and `pnpm` installed
- You are in the `plan-b` worktree: `.worktrees/plan-b/`

---

## Step 1 — Install dependencies

```bash
cd .worktrees/plan-b/frontend/web
pnpm install
```

---

## Step 2 — Start the dev server

```bash
cd .worktrees/plan-b/frontend/web
pnpm dev
```

Wait for: `✓ Ready on http://localhost:3000`

---

## Step 3 — Smoke-test the API route

In a second terminal, run:

```bash
curl "http://localhost:3000/api/vault-node?path=vault/calls/call-0031.md&knownIds=ING,NL43RABO0147082471"
```

**Expected response** (abbreviated):
```json
{
  "node": {
    "id": "call-0031",
    "type": "call",
    "label": "call-0031",
    "path": "vault/calls/call-0031.md",
    "frontmatter": { "type": "call", "id": "call-0031", "claimed_bank": "[[ING]]", "..." : "..." },
    "body": "..."
  },
  "edges": [
    { "source": "call-0031", "target": "ING", "kind": "wikilink" }
  ]
}
```

If you get a `{ "error": "file not found" }`, check that the `vault/` folder exists two levels above `frontend/web/` (i.e., at repo root).

---

## Step 4 — Open the graph page

Navigate to: [http://localhost:3000/graph](http://localhost:3000/graph)

**What you should see:**
- The force-directed graph renders with ~10 pre-seeded call nodes and their connected entity nodes.
- The node/edge counts in the header are non-zero.
- No `call-0042` node appears (the hardcoded demo node is gone).

---

## Step 5 — Watch the mock-bus fire `graph_node_added`

The mock-bus in `lib/mock-bus.ts` replays fixture events on a timeline. With the fixture event added in Task 3 of the implementation plan, a `graph_node_added` event fires at `t_offset_ms: 246000` — about 4 minutes 6 seconds after the page loads.

**Wait ~246 seconds** (or open DevTools → Network tab and watch for the `/api/vault-node` request).

> **Tip to speed this up:** In `lib/mock-bus.ts`, the `subscribe()` function accepts a `speed` option. You can temporarily call `subscribe(handler, { speed: 20 })` to run the fixture timeline 20x faster (246 s → ~12 s). Revert before committing.

**What you should see:**
1. A new node labeled `call-0031` appears in the graph with a highlight pulse (lime/amber glow that fades after ~4.5 seconds). **Note:** `call-0031` may already exist in `initialData` from vault — if it does, no duplicate will be added (the dedup guard runs).
2. The node count in the header increases by 1 (if it was not already present).
3. In DevTools → Network, you should see a `GET /api/vault-node?path=vault%2Fcalls%2Fcall-0031.md&knownIds=...` request with a 200 response.

**To test with a node that does NOT exist in vault yet** (simulating a brand-new call):

1. Stop the dev server.
2. Delete `vault/calls/call-0031.md` temporarily (or change the fixture `markdown_path` to a non-existing path like `vault/calls/call-9999.md`).
3. Restart the dev server and navigate back to `/graph`.
4. After 55 seconds, the fetch will return 404 and a console warning appears — the graph is unchanged. This is correct fallback behavior.
5. Restore the file.

---

## Step 6 — Test the `call_ended` fallback

The `call_ended` event fires at the end of the fixture timeline (check `fixtures/transcript.json` for the exact `t_offset_ms`). After it fires and 3 seconds pass without a `graph_node_added` event, the page calls `router.refresh()`, which re-fetches the vault server-side.

**To verify:**
1. Open DevTools → Network.
2. Watch for a `call_ended` event (it fires as a fixture event in the mock timeline, typically near the end).
3. Within 3 seconds of `call_ended`, if no `graph_node_added` fires, Next.js performs a soft navigation refresh (you'll see a document request in the Network tab or a brief re-render).

**To force this path** (test fallback without graph_node_added):

1. Temporarily comment out or remove the `graph_node_added` fixture entry from `fixtures/extractions.json`.
2. Restart the dev server.
3. On `/graph`, after ~245 seconds (when `call_ended` fires at t=245000ms), the page should refresh within 3 seconds.
4. Restore the fixture entry.

---

## Step 7 — Test the "Replay" button

1. After the graph has updated (Step 5), click the **Replay** button in the top-right of the graph header.
2. **Expected:** All dynamically-added nodes disappear from the graph. The node count drops back to the initial vault count. Highlight fades immediately.
3. Wait ~246 seconds again (or use speed multiplier tip above) — the mock-bus replays the fixture timeline, and the new node is fetched and added again with the highlight pulse.

---

## Step 8 — Click a live-added node

1. After the `graph_node_added` fixture fires and the new node appears, click on it.
2. **Expected:** The `MarkdownDrawer` slides in from the right, showing the node's markdown body and frontmatter-derived metadata (the same format as any other vault node).
3. Clicking a `[[wikilink]]` inside the drawer that matches a known node ID should navigate the selection to that node.

---

## What Success Looks Like

| Check | Expected |
|-------|---------|
| `/api/vault-node` returns 200 for existing vault files | ✓ |
| `/api/vault-node` returns 404 for missing files | ✓ |
| Path traversal (`?path=../../etc/passwd`) returns 400 | ✓ |
| New node appears in graph after `graph_node_added` event | ✓ |
| Highlight pulse appears on new node, fades after ~4.5 s | ✓ |
| No `call-0042` DEMO node in the graph | ✓ |
| `call_ended` with no node events → page refreshes after 3 s | ✓ |
| "Replay" clears dynamic nodes + restarts fixture timeline | ✓ |
| Clicking new node opens drawer with real markdown | ✓ |

---

## Troubleshooting

**"file not found" from /api/vault-node:**
The route computes `repoRoot()` as `process.cwd()/../..`. During `pnpm dev`, `process.cwd()` is `frontend/web/`, so the repo root should resolve correctly. If it does not, check your working directory when you ran `pnpm dev`.

**No `graph_node_added` fires:**
Check `fixtures/extractions.json` — the event must have `"type": "graph_node_added"` and a valid `t_offset_ms`. The mock-bus validates `type` and rejects unknown types.

**Duplicate node appears:**
The dedup guard in `graph-view.tsx` checks `prev.some((n) => n.id === node.id)` before adding. If you see a duplicate, check that the `id` returned by `/api/vault-node` matches the existing node's `id` exactly (case-sensitive).

**Graph is empty after refresh:**
The `router.refresh()` re-runs the server `loadVault()` call. If `vault/` is empty or paths are broken, `initialData` will be empty. Run `ls ../../vault/calls/` from `frontend/web/` to verify vault files are present.
