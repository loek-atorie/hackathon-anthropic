"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ForceGraph, NODE_COLORS, NODE_TYPE_LABELS } from "./force-graph";
import { MarkdownDrawer } from "./markdown-drawer";
import { useBus } from "@/lib/sse";
import type { GraphData, GraphNode, GraphNodeType } from "@/lib/vault-reader";

interface GraphViewProps {
  initialData: GraphData;
}

// The synthetic call we add when the bus emits `call_ended`. Mirrors the demo
// fixture: call-0042 → ING + NL12RABO0123456789 + bank-helpdesk-v3.
const DEMO_CALL_ID = "call-0042";
const DEMO_CALL_NODE: GraphNode = {
  id: DEMO_CALL_ID,
  type: "call",
  label: DEMO_CALL_ID,
  path: `vault/calls/${DEMO_CALL_ID}.md`,
  frontmatter: {
    type: "call",
    id: DEMO_CALL_ID,
    started_at: "2026-04-25T13:00:00Z",
    duration_s: 245,
    scammer: "[[scammer-voice-A7]]",
    claimed_bank: "[[ING]]",
    script: "[[bank-helpdesk-v3]]",
    extracted_ibans: ["[[NL12RABO0123456789]]"],
    callback_number: "+31 20 555 0142",
    tactics: ["urgency", "authority", "fear"],
    language: "nl",
  },
  body: `# Call 0042 — live demo

Net binnengekomen. \`[[scammer-voice-A7]]\` opnieuw, namens \`[[ING]]\`, met script \`[[bank-helpdesk-v3]]\` en bekend mule-IBAN \`[[NL12RABO0123456789]]\`.

> "Mevrouw, dit is zeer urgent. Uw spaargeld loopt gevaar."

Eerste keer dat we een terugbel-nummer (+31 20 555 0142) extraheren — handig voor cross-correlatie.
`,
};

const DEMO_TARGET_IDS = ["ING", "NL12RABO0123456789", "bank-helpdesk-v3"];

const HIGHLIGHT_DURATION_MS = 4500;

function isCallEnded(e: { type: string }): boolean {
  return e.type === "call_ended";
}

export function GraphView({ initialData }: GraphViewProps) {
  // highlightFaded tracks whether the post-call_ended highlight has expired.
  // It starts false; the timeout callback (not the effect body) sets it true,
  // which satisfies react-hooks/set-state-in-effect.
  const [highlightFaded, setHighlightFaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { events, reset: resetBus } = useBus();

  // Derive whether a call_ended event has been seen. This drives node/edge
  // insertion via useMemo below — no setState needed in an effect.
  const callEndedSeen = useMemo(() => events.some(isCallEnded), [events]);

  // Derive extra nodes and edges purely from callEndedSeen + initialData.
  const extraNodes = useMemo<GraphNode[]>(() => {
    if (!callEndedSeen) return [];
    if (initialData.nodes.some((n) => n.id === DEMO_CALL_ID)) return [];
    return [DEMO_CALL_NODE];
  }, [callEndedSeen, initialData.nodes]);

  const extraEdges = useMemo<GraphData["edges"]>(() => {
    if (!callEndedSeen) return [];
    if (initialData.nodes.some((n) => n.id === DEMO_CALL_ID)) return [];
    return DEMO_TARGET_IDS.filter((target) =>
      initialData.nodes.some((n) => n.id === target),
    ).map((target) => ({ source: DEMO_CALL_ID, target, kind: "wikilink" as const }));
  }, [callEndedSeen, initialData.nodes]);

  // Highlight the new call node until the timer fires. highlightFaded is only
  // ever set inside the setTimeout callback, not synchronously in the effect.
  const highlightIds = useMemo(
    () => (callEndedSeen && !highlightFaded ? new Set([DEMO_CALL_ID]) : new Set<string>()),
    [callEndedSeen, highlightFaded],
  );

  const data = useMemo<GraphData>(
    () => ({
      nodes: [...initialData.nodes, ...extraNodes],
      edges: [...initialData.edges, ...extraEdges],
    }),
    [initialData, extraNodes, extraEdges],
  );

  const knownIds = useMemo(() => new Set(data.nodes.map((n) => n.id)), [data]);

  const nodeById = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of data.nodes) m.set(n.id, n);
    return m;
  }, [data]);

  const selectedNode = selectedId ? (nodeById.get(selectedId) ?? null) : null;

  // Schedule the highlight-fade. setState only fires inside the timeout
  // callback, satisfying react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!callEndedSeen) return;
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(
      () => setHighlightFaded(true),
      HIGHLIGHT_DURATION_MS,
    );
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [callEndedSeen]);

  // Reset both the bus and the dynamic additions.
  const handleReset = useCallback(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    setHighlightFaded(false);
    setSelectedId(null);
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

  // Counts per type (for the legend).
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
