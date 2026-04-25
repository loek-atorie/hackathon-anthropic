"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphData, GraphNode, GraphNodeType } from "@/lib/vault-reader";

// react-force-graph-2d touches `window`, so we must dynamically import with
// SSR off. The lib's default export takes a `ref` for imperative API.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

export const NODE_COLORS: Record<GraphNodeType, string> = {
  call: "#d4ff3a", // accent lime — the action
  scammer: "#f87171", // red
  iban: "#7dd3fc", // sky blue
  bank: "#fb923c", // orange
  script: "#c084fc", // purple
};

export const NODE_TYPE_LABELS: Record<GraphNodeType, string> = {
  call: "Call",
  scammer: "Stem-cluster",
  iban: "IBAN",
  bank: "Bank",
  script: "Script",
};

/** Internal force-graph node — superset of GraphNode that the lib mutates. */
type FGNode = GraphNode & {
  // these are added by the simulation
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  // our own metadata
  degree: number;
  highlightUntil?: number;
};

type FGLink = {
  source: string | FGNode;
  target: string | FGNode;
  kind: "wikilink";
};

interface ForceGraphProps {
  data: GraphData;
  /** ids that should be visually highlighted (e.g. just-inserted call). */
  highlightedIds?: ReadonlySet<string>;
  onNodeClick?: (node: GraphNode) => void;
  /** Optional currently-selected node id — drawn with a ring. */
  selectedId?: string | null;
}

export function ForceGraph(props: ForceGraphProps) {
  const { data, highlightedIds, onNodeClick, selectedId } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<unknown>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // Wall-clock used to drive the highlight pulse. We keep it in a ref + a
  // re-render counter so we don't re-mount the graph on every tick.
  const [, setTick] = useState(0);

  // Compute degrees + alway-on labels for high-degree nodes.
  const { fgNodes, fgLinks, alwaysLabelIds } = useMemo(() => {
    const degree = new Map<string, number>();
    for (const e of data.edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    const nodes: FGNode[] = data.nodes.map((n) => ({
      ...n,
      degree: degree.get(n.id) ?? 0,
    }));
    const links: FGLink[] = data.edges.map((e) => ({
      source: e.source,
      target: e.target,
      kind: e.kind,
    }));
    // Always label the top-N most connected nodes for orientation.
    const sortedByDegree = [...nodes].sort((a, b) => b.degree - a.degree);
    const TOP_N = 5;
    const ids = new Set(sortedByDegree.slice(0, TOP_N).map((n) => n.id));
    return { fgNodes: nodes, fgLinks: links, alwaysLabelIds: ids };
  }, [data]);

  // Resize observer — keep the canvas in sync with its container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ w: Math.max(0, Math.floor(width)), h: Math.max(0, Math.floor(height)) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Run a re-render loop only while there's an active highlight, so the pulse
  // animation visibly breathes.
  useEffect(() => {
    if (!highlightedIds || highlightedIds.size === 0) return;
    let rafId = 0;
    const tickFn = () => {
      setTick((t) => (t + 1) % 1_000_000);
      rafId = requestAnimationFrame(tickFn);
    };
    rafId = requestAnimationFrame(tickFn);
    return () => cancelAnimationFrame(rafId);
  }, [highlightedIds]);

  // Re-heat the simulation when nodes are added so new ones find a home.
  useEffect(() => {
    const fg = fgRef.current as
      | { d3ReheatSimulation?: () => void; d3Force?: (name: string, force: unknown) => unknown }
      | null;
    if (!fg) return;
    fg.d3ReheatSimulation?.();
  }, [fgNodes.length]);

  // Configure forces once the graph mounts.
  const onEngineRef = (graphRef: unknown) => {
    fgRef.current = graphRef;
    const fg = graphRef as
      | {
          d3Force: (name: string) => { distance?: (d: number) => unknown; strength?: (s: number) => unknown } | undefined;
        }
      | null;
    if (!fg) return;
    try {
      // Tune for calm steady-state.
      const linkForce = fg.d3Force("link");
      linkForce?.distance?.(70);
      const chargeForce = fg.d3Force("charge");
      chargeForce?.strength?.(-180);
    } catch {
      // Some d3 versions don't expose these; not fatal.
    }
  };

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {size.w > 0 && size.h > 0 ? (
        <ForceGraph2D
          ref={onEngineRef as never}
          width={size.w}
          height={size.h}
          graphData={{ nodes: fgNodes, links: fgLinks }}
          backgroundColor="rgba(7, 8, 10, 0)"
          nodeRelSize={4}
          // We render nodes ourselves so we can add labels + highlight rings.
          nodeCanvasObject={(node, ctx, globalScale) => {
            const n = node as FGNode;
            const baseR = 4 + Math.min(8, Math.sqrt(n.degree) * 1.7);
            const color = NODE_COLORS[n.type] ?? "#888";
            const x = n.x ?? 0;
            const y = n.y ?? 0;

            // Highlight pulse for newly-inserted nodes.
            if (highlightedIds?.has(n.id)) {
              const t = (Date.now() % 1400) / 1400; // 0..1
              const pulseR = baseR + 4 + Math.sin(t * Math.PI * 2) * 4 + 4;
              ctx.beginPath();
              ctx.arc(x, y, pulseR, 0, Math.PI * 2);
              ctx.strokeStyle = color;
              ctx.globalAlpha = 0.45;
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();
              ctx.globalAlpha = 1;
            }

            // Selected ring.
            if (selectedId && selectedId === n.id) {
              ctx.beginPath();
              ctx.arc(x, y, baseR + 3, 0, Math.PI * 2);
              ctx.strokeStyle = "#e8eaed";
              ctx.lineWidth = 1.5 / globalScale;
              ctx.stroke();
            }

            // The node itself.
            ctx.beginPath();
            ctx.arc(x, y, baseR, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            // Label: always for high-degree nodes, otherwise on hover (handled
            // by nodeLabel prop below — appears as a tooltip).
            if (alwaysLabelIds.has(n.id) || globalScale > 2) {
              const label = n.label ?? n.id;
              const fontSize = Math.max(10, 12 / Math.max(1, globalScale * 0.9));
              ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle = "#e8eaed";
              ctx.fillText(label, x, y + baseR + 3);
            }
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            const n = node as FGNode;
            const baseR = 4 + Math.min(8, Math.sqrt(n.degree) * 1.7);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(n.x ?? 0, n.y ?? 0, baseR + 4, 0, Math.PI * 2);
            ctx.fill();
          }}
          nodeLabel={(node) => {
            const n = node as FGNode;
            return `${n.label} · ${NODE_TYPE_LABELS[n.type]}`;
          }}
          linkColor={() => "rgba(232, 234, 237, 0.18)"}
          linkWidth={0.8}
          linkDirectionalParticles={0}
          cooldownTicks={120}
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.35}
          enableNodeDrag={true}
          onNodeClick={(node) => {
            if (onNodeClick) onNodeClick(node as FGNode);
          }}
        />
      ) : null}
    </div>
  );
}
