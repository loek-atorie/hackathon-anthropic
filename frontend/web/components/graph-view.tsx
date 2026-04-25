"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ForceGraph, NODE_COLORS, NODE_TYPE_LABELS } from "./force-graph";
import { MarkdownDrawer } from "./markdown-drawer";
import { useBus } from "@/lib/sse";
import type { GraphData, GraphNode, GraphNodeType, GraphEdge } from "@/lib/vault-reader";

interface GraphViewProps {
  initialData: GraphData;
}

const HIGHLIGHT_DURATION_MS = 4500;
const CALL_ENDED_REFRESH_DELAY_MS = 3000;

export function GraphView({ initialData }: GraphViewProps) {
  const router = useRouter();

  const [dynamicNodes, setDynamicNodes] = useState<GraphNode[]>([]);
  const [dynamicEdges, setDynamicEdges] = useState<GraphEdge[]>([]);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callEndedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodeEventsReceivedRef = useRef(false);
  const lastProcessedIndexRef = useRef(-1);

  const { events, reset: resetBus } = useBus();

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

  // Handle all events in order, walking forward from the last-processed index.
  useEffect(() => {
    for (let i = lastProcessedIndexRef.current + 1; i < events.length; i++) {
      const event = events[i];

      if (event.type === "graph_node_added") {
        const { node_id, markdown_path } = event;
        nodeEventsReceivedRef.current = true;

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

            setHighlightIds(new Set([node_id]));
            if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
            highlightTimeoutRef.current = setTimeout(
              () => setHighlightIds(new Set()),
              HIGHLIGHT_DURATION_MS,
            );
          })
          .catch((err) => console.warn("[graph-view] vault-node fetch failed:", err));
      }

      if (event.type === "call_ended") {
        nodeEventsReceivedRef.current = false;

        if (callEndedTimerRef.current) clearTimeout(callEndedTimerRef.current);
        callEndedTimerRef.current = setTimeout(() => {
          if (!nodeEventsReceivedRef.current) {
            router.refresh();
          }
        }, CALL_ENDED_REFRESH_DELAY_MS);
      }
    }
    lastProcessedIndexRef.current = events.length - 1;
  }, [events, knownIds, router]);

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
    lastProcessedIndexRef.current = -1;
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
