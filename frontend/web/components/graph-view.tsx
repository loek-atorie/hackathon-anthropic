"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ForceGraph, NODE_COLORS, NODE_TYPE_LABELS } from "./force-graph";
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
          .then((r) => {
            if (!r.ok) throw new Error(`vault-node ${r.status}`);
            return r.json();
          })
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
    setSelectedId((prev) => (prev === node.id ? null : node.id));
  }, []);

  const handleDeselect = useCallback(() => setSelectedId(null), []);

  // Dismiss selection on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleDeselect(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDeselect]);

  // 1-hop neighborhood of selectedId: selected node + all direct neighbors
  const neighborhoodIds = useMemo<ReadonlySet<string>>(() => {
    if (!selectedId) return new Set();
    const ids = new Set<string>([selectedId]);
    for (const e of data.edges) {
      if (e.source === selectedId) ids.add(e.target);
      if (e.target === selectedId) ids.add(e.source);
    }
    return ids;
  }, [selectedId, data.edges]);

  // Legend counts — Partial record so it's safe for any GraphNodeType set
  const counts = useMemo(() => {
    const m: Partial<Record<GraphNodeType, number>> = {};
    for (const n of data.nodes) {
      m[n.type] = (m[n.type] ?? 0) + 1;
    }
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
                <span className="font-mono tabular-nums text-[var(--muted-2)]">{counts[t] ?? 0}</span>
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
          neighborhoodIds={neighborhoodIds}
          onNodeClick={handleNodeClick}
        />
        {selectedNode && (
          <NodeInfoCard node={selectedNode} onClose={handleDeselect} />
        )}
      </div>
    </div>
  );
}

// ─── NodeInfoCard ────────────────────────────────────────────────────────────

function NodeInfoCard({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  const fm = node.frontmatter as Record<string, unknown>;
  const color = NODE_COLORS[node.type] ?? "#e8eaed";

  const toStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String) : [];

  const stripWikilink = (s: string) => s.replace(/^\[\[|\]\]$/g, "");

  return (
    <div
      className="pointer-events-auto absolute bottom-5 left-1/2 z-20 w-[440px] max-w-[90vw] -translate-x-1/2 rounded-xl border backdrop-blur-md"
      style={{
        background: "rgba(14,19,24,0.93)",
        borderColor: `${color}33`,
        boxShadow: `0 0 40px ${color}12, 0 8px 32px rgba(0,0,0,0.65)`,
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2.5">
          <span
            className="h-3 w-3 flex-shrink-0 rounded-full"
            style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          />
          <span className="text-sm font-semibold" style={{ color }}>
            {node.label ?? node.id}
          </span>
          <span className="ml-auto text-[10px] uppercase tracking-widest text-[var(--muted)]">
            {NODE_TYPE_LABELS[node.type]}
          </span>
          <button
            onClick={onClose}
            className="ml-2 text-lg leading-none text-[var(--muted)] transition hover:text-[var(--foreground)]"
            aria-label="Sluiten"
          >
            ×
          </button>
        </div>

        {/* Type-specific fields */}
        {node.type === "scammer" && (
          <div className="flex flex-col gap-2">
            <InfoRow label="Gezien in">
              <ChipList items={toStringArray(fm.seen_in_calls).map(stripWikilink)} color="#00cfff" />
            </InfoRow>
            {fm.location != null && (
              <InfoRow label="Locatie">
                <ChipList items={[stripWikilink(String(fm.location))]} color="#a78bfa" />
              </InfoRow>
            )}
            {fm.notes != null && (
              <InfoRow label="Notities">
                <span className="text-[11px] text-[var(--muted)]">{String(fm.notes)}</span>
              </InfoRow>
            )}
          </div>
        )}

        {node.type === "call" && (
          <div className="flex flex-col gap-2">
            {fm.scammer != null && (
              <InfoRow label="Scammer">
                <ChipList items={[stripWikilink(String(fm.scammer))]} color="#ff4444" />
              </InfoRow>
            )}
            {fm.claimed_bank != null && (
              <InfoRow label="Doet zich voor als">
                <ChipList items={[String(fm.claimed_bank)]} color="#33ff99" />
              </InfoRow>
            )}
            {fm.script != null && (
              <InfoRow label="Script">
                <ChipList items={[stripWikilink(String(fm.script))]} color="#cc66ff" />
              </InfoRow>
            )}
            {fm.duration_s != null && (
              <InfoRow label="Duur">
                <span className="text-[11px] text-[var(--foreground)]">
                  {Math.floor(Number(fm.duration_s) / 60)}m {Number(fm.duration_s) % 60}s
                </span>
              </InfoRow>
            )}
          </div>
        )}

        {node.type === "location" && (
          <div className="flex flex-col gap-2">
            <InfoRow label="Stad">
              <span className="text-[11px] text-[var(--foreground)]">
                {fm.city ? String(fm.city) : node.id}
                {fm.country_code ? `, ${String(fm.country_code)}` : ""}
              </span>
            </InfoRow>
            <InfoRow label="Gesprekken">
              <ChipList items={toStringArray(fm.seen_in_calls).map(stripWikilink)} color="#00cfff" />
            </InfoRow>
          </div>
        )}

        {node.type === "bank" && (
          <div className="flex flex-col gap-2">
            <InfoRow label="Gesprekken">
              <ChipList items={toStringArray(fm.referenced_in_calls).map(stripWikilink)} color="#00cfff" />
            </InfoRow>
          </div>
        )}

        {node.type === "script" && (
          <div className="flex flex-col gap-2">
            {fm.description != null && (
              <InfoRow label="Omschrijving">
                <span className="line-clamp-2 text-[11px] text-[var(--muted)]">
                  {String(fm.description)}
                </span>
              </InfoRow>
            )}
            <InfoRow label="Gesprekken">
              <ChipList items={toStringArray(fm.seen_in_calls).map(stripWikilink)} color="#00cfff" />
            </InfoRow>
          </div>
        )}

        <p className="mt-3 text-[10px] text-[#383e47]">
          druk Esc om te deselecteren · klik opnieuw om te sluiten
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-[80px] flex-shrink-0 pt-0.5 text-[10px] text-[var(--muted)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function ChipList({ items, color }: { items: string[]; color: string }) {
  if (items.length === 0)
    return <span className="text-[10px] text-[var(--muted-2)]">—</span>;
  return (
    <>
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
          style={{ color, borderColor: color, background: `${color}12` }}
        >
          {item}
        </span>
      ))}
    </>
  );
}
