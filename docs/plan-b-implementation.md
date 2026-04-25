# Plan B — Graph Page: Real Vault Nodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `DEMO_CALL_NODE` in `graph-view.tsx` with a real vault fetch so that when `graph_node_added` events arrive on the bus, the actual markdown-derived node is added to the graph; fall back to a full vault reload when `call_ended` fires without node events.

**Architecture:** A new Next.js API route (`/api/vault-node`) reads a single markdown file server-side, parses it with gray-matter (reusing the logic already in `vault-reader.ts`), and returns a `GraphNode` + `GraphEdge[]`. The client component subscribes to `graph_node_added` bus events, fetches each new node via this route, and merges it into local state. A 3-second timer on `call_ended` triggers `router.refresh()` as a safety net if no node events arrived.

**Tech Stack:** Next.js 16 App Router, TypeScript 5, gray-matter, existing `lib/vault-reader.ts` (server), existing `lib/sse.ts` + `useBus()` (client), `next/navigation` `useRouter`.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `frontend/web/components/graph-view.tsx` | Remove DEMO constants; handle `graph_node_added` + `call_ended` events |
| Create | `frontend/web/app/api/vault-node/route.ts` | `GET /api/vault-node?path=…` → `{ node, edges }` |

No other files touched.

---

## Task 1: Create `/api/vault-node` route

**Files:**
- Create: `frontend/web/app/api/vault-node/route.ts`

This route receives `?path=vault/calls/call-0042.md` (relative to repo root), reads the file with `fs.readFile`, parses frontmatter with `gray-matter`, extracts wikilinks, resolves which wikilinks are known node IDs (passed as `?knownIds=id1,id2,...` query param), and returns `{ node: GraphNode, edges: GraphEdge[] }`.

- [ ] **Step 1: Create the route file with the handler skeleton**

```typescript
// frontend/web/app/api/vault-node/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { GraphNode, GraphEdge } from "@/lib/vault-reader";
import type { GraphNodeType } from "@/lib/types";

const TYPE_DIRS: Record<string, GraphNodeType> = {
  calls: "call",
  scammers: "scammer",
  ibans: "iban",
  banks: "bank",
  scripts: "script",
};

const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/g;

function extractWikilinks(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(WIKILINK_RE)) {
    const trimmed = m[1].trim();
    if (trimmed) out.push(trimmed);
  }
  return out;
}

function frontmatterWikilinks(fm: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const value of Object.values(fm)) {
    if (typeof value === "string") {
      out.push(...extractWikilinks(value));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") out.push(...extractWikilinks(item));
      }
    }
  }
  return out;
}

function repoRoot(): string {
  // process.cwd() during next dev/build is frontend/web/
  return path.resolve(process.cwd(), "..", "..");
}

function typeFromPath(relPath: string): GraphNodeType | null {
  // relPath is like "vault/calls/call-0042.md"
  const parts = relPath.split("/");
  if (parts.length < 3) return null;
  const dir = parts[1]; // "calls", "scammers", etc.
  return TYPE_DIRS[dir] ?? null;
}

function deriveId(type: GraphNodeType, filename: string, fm: Record<string, unknown>): string {
  if (type === "call") {
    const id = typeof fm.id === "string" ? fm.id : null;
    if (id) return id;
  }
  if (type === "script") {
    const sig = typeof fm.signature === "string" ? fm.signature : null;
    if (sig) return sig;
  }
  return filename;
}

function deriveLabel(type: GraphNodeType, id: string, fm: Record<string, unknown>): string {
  switch (type) {
    case "call": return typeof fm.id === "string" ? fm.id : id;
    case "bank": return typeof fm.name === "string" ? fm.name : id;
    case "iban": return typeof fm.iban === "string" ? fm.iban : id;
    case "script": return typeof fm.signature === "string" ? fm.signature : id;
    case "scammer": return typeof fm.cluster_id === "string" ? fm.cluster_id : id;
    default: return id;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const relPath = searchParams.get("path");
  const knownIdsParam = searchParams.get("knownIds") ?? "";

  if (!relPath) {
    return NextResponse.json({ error: "missing path param" }, { status: 400 });
  }

  // Prevent path traversal — relPath must start with "vault/"
  if (!relPath.startsWith("vault/") || relPath.includes("..")) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  const nodeType = typeFromPath(relPath);
  if (!nodeType) {
    return NextResponse.json({ error: "unrecognised vault path" }, { status: 400 });
  }

  const fullPath = path.join(repoRoot(), relPath);
  let raw: string;
  try {
    raw = await fs.readFile(fullPath, "utf8");
  } catch {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  const parsed = matter(raw);
  const fm = Object.fromEntries(
    Object.entries(parsed.data ?? {}).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])
  ) as Record<string, unknown>;
  const body = parsed.content ?? "";
  const filename = path.basename(relPath, ".md");

  const id = deriveId(nodeType, filename, fm);
  const label = deriveLabel(nodeType, id, fm);

  const node: GraphNode = { id, type: nodeType, label, path: relPath, frontmatter: fm, body };

  // Build edges: wikilinks that resolve to known IDs
  const knownIds = new Set(knownIdsParam ? knownIdsParam.split(",").filter(Boolean) : []);
  const links = [...frontmatterWikilinks(fm), ...extractWikilinks(body)];
  const seenEdges = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const link of links) {
    if (!knownIds.has(link)) continue;
    if (link === id) continue;
    const key = [id, link].sort().join("|");
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    edges.push({ source: id, target: link, kind: "wikilink" });
  }

  return NextResponse.json({ node, edges });
}
```

- [ ] **Step 2: Verify the route exists and compiles**

```bash
cd frontend/web
pnpm build 2>&1 | grep -E "(vault-node|error|Error)" | head -20
```

Expected: route listed under `/api/vault-node`, no TypeScript errors.

- [ ] **Step 3: Smoke-test the route manually**

Start the dev server (`pnpm dev` in `frontend/web`) and run:

```bash
curl "http://localhost:3000/api/vault-node?path=vault/calls/call-0031.md&knownIds=ING,NL43RABO0147082471"
```

Expected response shape:
```json
{
  "node": {
    "id": "call-0031",
    "type": "call",
    "label": "call-0031",
    "path": "vault/calls/call-0031.md",
    "frontmatter": { "...": "..." },
    "body": "..."
  },
  "edges": [
    { "source": "call-0031", "target": "ING", "kind": "wikilink" }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/web/app/api/vault-node/route.ts
git commit -m "feat: add /api/vault-node route for single-node reads"
```

---

## Task 2: Rewrite `graph-view.tsx` to use real vault data

**Files:**
- Modify: `frontend/web/components/graph-view.tsx`

Remove all three DEMO constants. Add state for live-added nodes/edges. Subscribe to `graph_node_added` events and fetch each new node from `/api/vault-node`. On `call_ended`, if no node events arrived within 3 s, trigger `router.refresh()` as fallback.

- [ ] **Step 1: Add the router import and dynamic-nodes state**

Replace the current imports + constant block at the top of `graph-view.tsx`:

```typescript
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ForceGraph, NODE_COLORS, NODE_TYPE_LABELS } from "./force-graph";
import { MarkdownDrawer } from "./markdown-drawer";
import { useBus } from "@/lib/sse";
import type { GraphData, GraphNode, GraphNodeType } from "@/lib/vault-reader";
import type { GraphEdge } from "@/lib/vault-reader";

interface GraphViewProps {
  initialData: GraphData;
}

const HIGHLIGHT_DURATION_MS = 4500;
const CALL_ENDED_REFRESH_DELAY_MS = 3000;
```

- [ ] **Step 2: Replace the component body — state + event handlers**

Replace the entire `GraphView` function body (from `export function GraphView` through the closing `}`):

```typescript
export function GraphView({ initialData }: GraphViewProps) {
  const router = useRouter();

  const [dynamicNodes, setDynamicNodes] = useState<GraphNode[]>([]);
  const [dynamicEdges, setDynamicEdges] = useState<GraphEdge[]>([]);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callEndedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodeEventsReceivedRef = useRef(false);

  const { events, reset: resetBus } = useBus();

  // Collect all known node IDs (initial + dynamic) for edge resolution.
  const data = useMemo<GraphData>(
    () => ({
      nodes: [...initialData.nodes, ...dynamicNodes],
      edges: [...initialData.edges, ...dynamicEdges],
    }),
    [initialData, dynamicNodes, dynamicEdges],
  );

  const knownIds = useMemo(() => new Set(data.nodes.map((n) => n.id)), [data]);

  const nodeById = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of data.nodes) m.set(n.id, n);
    return m;
  }, [data]);

  const selectedNode = selectedId ? (nodeById.get(selectedId) ?? null) : null;

  // Handle graph_node_added: fetch the real node and merge into state.
  useEffect(() => {
    const latest = events.at(-1);
    if (!latest || latest.type !== "graph_node_added") return;

    const { node_id, markdown_path } = latest;
    nodeEventsReceivedRef.current = true;

    // Build knownIds string at fetch time for edge resolution.
    const knownIdsParam = [...knownIds].join(",");
    const url = `/api/vault-node?path=${encodeURIComponent(markdown_path)}&knownIds=${encodeURIComponent(knownIdsParam)}`;

    fetch(url)
      .then((r) => r.json())
      .then(({ node, edges }: { node: GraphNode; edges: GraphEdge[] }) => {
        setDynamicNodes((prev) => {
          if (prev.some((n) => n.id === node.id)) return prev;
          return [...prev, node];
        });
        setDynamicEdges((prev) => {
          const existingKeys = new Set(prev.map((e) => [e.source, e.target].sort().join("|")));
          const newEdges = edges.filter(
            (e) => !existingKeys.has([e.source, e.target].sort().join("|")),
          );
          return [...prev, ...newEdges];
        });

        // Highlight the new node.
        setHighlightIds(new Set([node_id]));
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(
          () => setHighlightIds(new Set()),
          HIGHLIGHT_DURATION_MS,
        );
      })
      .catch((err) => console.warn("[graph-view] vault-node fetch failed:", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Handle call_ended: start a 3-second timer; if no node events arrived, refresh.
  useEffect(() => {
    const latest = events.at(-1);
    if (!latest || latest.type !== "call_ended") return;

    nodeEventsReceivedRef.current = false;

    if (callEndedTimerRef.current) clearTimeout(callEndedTimerRef.current);
    callEndedTimerRef.current = setTimeout(() => {
      if (!nodeEventsReceivedRef.current) {
        router.refresh();
      }
    }, CALL_ENDED_REFRESH_DELAY_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      if (callEndedTimerRef.current) clearTimeout(callEndedTimerRef.current);
    };
  }, []);

  const handleReset = useCallback(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    if (callEndedTimerRef.current) {
      clearTimeout(callEndedTimerRef.current);
      callEndedTimerRef.current = null;
    }
    setHighlightIds(new Set());
    setDynamicNodes([]);
    setDynamicEdges([]);
    setSelectedId(null);
    nodeEventsReceivedRef.current = false;
    resetBus();
  }, [resetBus]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedId(node.id);
  }, []);

  const handleWikilinkClick = useCallback(
    (id: string) => {
      if (knownIds.has(id)) setSelectedId(id);
    },
    [knownIds],
  );

  const handleCloseDrawer = useCallback(() => setSelectedId(null), []);

  const counts = useMemo(() => {
    const m: Record<GraphNodeType, number> = {
      call: 0,
      scammer: 0,
      iban: 0,
      bank: 0,
      script: 0,
    };
    for (const n of data.nodes) m[n.type]++;
    return m;
  }, [data.nodes]);

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Compact header strip */}
      <header className="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--background)]/70 px-6 py-4 backdrop-blur">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
            Intelligence
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
            Knowledge Graph
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono tabular-nums text-[var(--foreground)]">
              {data.nodes.length}
            </span>
            <span className="text-[var(--muted)]">knooppunten</span>
            <span className="text-[var(--border-strong)]">·</span>
            <span className="font-mono tabular-nums text-[var(--foreground)]">
              {data.edges.length}
            </span>
            <span className="text-[var(--muted)]">verbindingen</span>
          </div>

          <div className="hidden items-center gap-3 border-l border-[var(--border)] pl-4 md:flex">
            {(Object.keys(NODE_TYPE_LABELS) as GraphNodeType[]).map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: NODE_COLORS[t] }}
                />
                <span className="text-[var(--foreground)]">{NODE_TYPE_LABELS[t]}</span>
                <span className="font-mono tabular-nums text-[var(--muted-2)]">{counts[t]}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--background-elev)] px-3 text-xs font-medium text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
            Replay
          </button>
        </div>
      </header>

      {/* The graph fills the remaining space. */}
      <div className="relative flex-1">
        <ForceGraph
          data={data}
          highlightedIds={highlightIds}
          selectedId={selectedId}
          onNodeClick={handleNodeClick}
        />
      </div>

      <MarkdownDrawer
        node={selectedNode}
        knownIds={knownIds}
        onClose={handleCloseDrawer}
        onWikilinkClick={handleWikilinkClick}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd frontend/web
pnpm build 2>&1 | grep -E "(error|Error|warn)" | grep -v "^warn" | head -30
```

Expected: zero TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/web/components/graph-view.tsx
git commit -m "feat: replace DEMO_CALL_NODE with real vault fetch on graph_node_added"
```

---

## Task 3: Add a `graph_node_added` fixture event + wire mock-bus for UI testing

**Files:**
- Modify: `frontend/web/fixtures/extractions.json`

The mock-bus needs a `graph_node_added` event so we can test Plan B end-to-end in the browser without any backend running. Add one fixture event pointing at an existing vault file.

- [ ] **Step 1: Append a `graph_node_added` event to `extractions.json`**

Open `frontend/web/fixtures/extractions.json`. It is a JSON array. Append this object as the last element. The `call_ended` event fires at `t_offset_ms: 245000`; this event fires 1 second later so the fallback timer does not trigger:

```json
{
  "type": "graph_node_added",
  "call_id": "call-0042",
  "node_id": "call-0031",
  "node_type": "call",
  "markdown_path": "vault/calls/call-0031.md",
  "t_offset_ms": 246000
}
```

(`call-0031` is a real pre-seeded vault file. Using a different `node_id` than the ongoing call exercises the cross-call node addition path.)

- [ ] **Step 2: Verify mock-bus validation still passes**

```bash
cd frontend/web
pnpm build 2>&1 | tail -5
```

Expected: no errors (mock-bus validates `graph_node_added` as a valid type already — it's in the `VALID_TYPES` set).

- [ ] **Step 3: Commit**

```bash
git add frontend/web/fixtures/extractions.json
git commit -m "test: add graph_node_added fixture event for UI smoke test"
```

---

## Task 4: Write the end-to-end test guide

**Files:**
- Create: `docs/test-plan-b-end-to-end.md` (in the worktree root `docs/` folder)

- [ ] **Step 1: Create the testing guide**

See `docs/test-plan-b-end-to-end.md` — this is created as a separate document (see below).

- [ ] **Step 2: Commit**

```bash
git add docs/test-plan-b-end-to-end.md
git commit -m "docs: add end-to-end UI test guide for Plan B"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Remove `DEMO_CALL_NODE`, `DEMO_CALL_ID`, `DEMO_TARGET_IDS` | Task 2 Step 1 |
| Handle `graph_node_added` → fetch `/api/vault-node` | Task 2 Step 2 |
| Add `GET /api/vault-node?path=…` route | Task 1 |
| Reuse wikilink parser from `vault-reader.ts` | Task 1 (inlined, same logic) |
| Highlight pulse on new node | Task 2 Step 2 (`setHighlightIds`) |
| `call_ended` → `router.refresh()` fallback after 3s | Task 2 Step 2 |
| No backend files touched | Confirmed — only `frontend/web/` |

**Placeholder scan:** None found. All steps contain actual code.

**Type consistency:** `GraphNode`, `GraphEdge`, `GraphData` are imported from `@/lib/vault-reader` in both Task 1 and Task 2. `GraphNodeType` from `@/lib/types`. Consistent.
