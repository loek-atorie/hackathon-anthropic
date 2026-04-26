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
  call:     "#00cfff", // cyan — neutral hub
  scammer:  "#ff4444", // red — threat actor
  location: "#a78bfa", // purple — geography
  bank:     "#33ff99", // green — legitimate institution
  script:   "#cc66ff", // purple-pink — conversation method
};

export const NODE_TYPE_LABELS: Record<GraphNodeType, string> = {
  call:     "Call",
  scammer:  "Scammer",
  location: "Locatie",
  bank:     "Bank",
  script:   "Script",
};

// Zone centers as fractions of canvas dimensions (used for cluster forces + ghost ellipses)
const ZONE_FX: Record<GraphNodeType, number> = {
  scammer:  0.20,
  call:     0.50,
  location: 0.20,
  bank:     0.80,
  script:   0.80,
};
const ZONE_FY: Record<GraphNodeType, number> = {
  scammer:  0.22,
  call:     0.50,
  location: 0.78,
  bank:     0.22,
  script:   0.78,
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
  /** When non-empty, all nodes NOT in this set are dimmed to ~8% opacity. */
  neighborhoodIds?: ReadonlySet<string>;
}

export function ForceGraph(props: ForceGraphProps) {
  const { data, highlightedIds, onNodeClick, selectedId, neighborhoodIds } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<unknown>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // Wall-clock used to drive the highlight pulse. We keep it in a ref + a
  // re-render counter so we don't re-mount the graph on every tick.
  const [, setTick] = useState(0);

  // Compute degrees and build node/link lists for the simulation.
  const { fgNodes, fgLinks, nodeTypeMap } = useMemo(() => {
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
    const typeMap = new Map<string, GraphNodeType>(nodes.map((n) => [n.id, n.type]));
    return { fgNodes: nodes, fgLinks: links, nodeTypeMap: typeMap };
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
          d3Force: (
            name: string,
            force?: unknown,
          ) => { distance?: (d: number) => unknown; strength?: (s: number) => unknown } | undefined;
        }
      | null;
    if (!fg) return;
    try {
      const linkForce = fg.d3Force("link");
      linkForce?.distance?.(80);
      const chargeForce = fg.d3Force("charge");
      chargeForce?.strength?.(-220);

      // Soft cluster attraction — same-type nodes drift toward their zone center.
      // Strength 0.06 is intentionally weak so cross-cluster edges can pull nodes between zones.
      const d3 = (
        window as unknown as {
          d3?: {
            forceX: (fn: (n: unknown) => number) => { strength: (s: number) => unknown };
            forceY: (fn: (n: unknown) => number) => { strength: (s: number) => unknown };
          };
        }
      ).d3;
      if (d3 && size.w > 0 && size.h > 0) {
        fg.d3Force(
          "clusterX",
          d3.forceX((node: unknown) => {
            const n = node as FGNode;
            return size.w * (ZONE_FX[n.type] ?? 0.5);
          }).strength(0.06),
        );
        fg.d3Force(
          "clusterY",
          d3.forceY((node: unknown) => {
            const n = node as FGNode;
            return size.h * (ZONE_FY[n.type] ?? 0.5);
          }).strength(0.06),
        );
      }
    } catch {
      // Some d3 versions don't expose these; clustering degrades gracefully.
    }
  };

  // Ghost zone ellipse definitions — rendered as SVG underlay behind the canvas.
  const clusterZones = size.w > 0 && size.h > 0
    ? (Object.keys(NODE_COLORS) as GraphNodeType[]).map((type) => ({
        type,
        cx: size.w * ZONE_FX[type],
        cy: size.h * ZONE_FY[type],
        rx: size.w * 0.13,
        ry: size.h * 0.16,
        color: NODE_COLORS[type],
        label: NODE_TYPE_LABELS[type].toUpperCase(),
      }))
    : [];

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {/* Cluster ghost zones — decorative SVG underlay */}
      {size.w > 0 && size.h > 0 && (
        <svg
          className="pointer-events-none absolute inset-0"
          width={size.w}
          height={size.h}
          aria-hidden
        >
          {clusterZones.map((z) => (
            <g key={z.type}>
              <ellipse
                cx={z.cx} cy={z.cy} rx={z.rx} ry={z.ry}
                fill={z.color} fillOpacity={0.04}
                stroke={z.color} strokeOpacity={0.12} strokeWidth={1}
              />
              <text
                x={z.cx} y={z.cy - z.ry - 8}
                textAnchor="middle"
                fill={z.color} fillOpacity={0.3}
                fontSize={9} fontWeight={700}
                letterSpacing="0.1em"
                style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
              >
                {z.label}
              </text>
            </g>
          ))}
        </svg>
      )}

      {size.w > 0 && size.h > 0 ? (
        <ForceGraph2D
          ref={onEngineRef as never}
          width={size.w}
          height={size.h}
          graphData={{ nodes: fgNodes, links: fgLinks }}
          backgroundColor="rgba(7, 8, 10, 0)"
          nodeRelSize={4}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const n = node as FGNode;
            const baseR = 4 + Math.min(8, Math.sqrt(n.degree) * 1.7);
            const color = NODE_COLORS[n.type] ?? "#888";
            const x = n.x ?? 0;
            const y = n.y ?? 0;

            const isDimmed =
              neighborhoodIds && neighborhoodIds.size > 0 && !neighborhoodIds.has(n.id);
            const isSelected = selectedId === n.id;

            // Highlight pulse for newly-inserted nodes.
            if (!isDimmed && highlightedIds?.has(n.id)) {
              const t = (Date.now() % 1400) / 1400;
              const pulseR = baseR + 4 + Math.sin(t * Math.PI * 2) * 4;
              ctx.beginPath();
              ctx.arc(x, y, pulseR, 0, Math.PI * 2);
              ctx.strokeStyle = color;
              ctx.globalAlpha = 0.45;
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();
              ctx.globalAlpha = 1;
            }

            // Selected: double ring (outer faint, inner solid)
            if (isSelected) {
              ctx.globalAlpha = 0.2;
              ctx.beginPath();
              ctx.arc(x, y, baseR + 8, 0, Math.PI * 2);
              ctx.strokeStyle = color;
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();

              ctx.globalAlpha = 0.5;
              ctx.beginPath();
              ctx.arc(x, y, baseR + 4, 0, Math.PI * 2);
              ctx.strokeStyle = color;
              ctx.lineWidth = 1.5 / globalScale;
              ctx.stroke();

              ctx.globalAlpha = 1;
            }

            // The node itself.
            ctx.globalAlpha = isDimmed ? 0.08 : 1;
            ctx.beginPath();
            ctx.arc(x, y, baseR, 0, Math.PI * 2);
            ctx.fillStyle = color;

            // Glow for non-dimmed nodes
            if (!isDimmed) {
              ctx.shadowColor = color;
              ctx.shadowBlur = isSelected ? 12 : 5;
            }
            ctx.fill();
            ctx.shadowBlur = 0;

            // Label
            {
              const label = n.label ?? n.id;
              const fontSize = Math.max(8, 11 / Math.max(0.8, globalScale));
              ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              const textW = ctx.measureText(label).width;
              const textH = fontSize;
              const labelY = y + baseR + 3;
              const padX = 3;
              const padY = 1.5;
              ctx.fillStyle = "rgba(7, 8, 10, 0.72)";
              ctx.fillRect(
                x - textW / 2 - padX,
                labelY - padY,
                textW + padX * 2,
                textH + padY * 2,
              );
              ctx.fillStyle = isDimmed ? "rgba(232,234,237,0.2)" : "#e8eaed";
              ctx.fillText(label, x, labelY);
            }

            ctx.globalAlpha = 1;
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
          linkColor={() => "rgba(0,0,0,0)"}
          linkWidth={0}
          linkCanvasObject={(link, ctx, globalScale) => {
            const src = link.source as FGNode;
            const tgt = link.target as FGNode;
            if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) return;

            const srcType = nodeTypeMap.get(src.id);
            const tgtType = nodeTypeMap.get(tgt.id);

            // Edge color matches target node type
            const edgeColor = NODE_COLORS[tgtType ?? "call"] ?? "rgba(232,234,237,0.18)";

            // Semantic label
            let edgeLabel = "linked";
            if (srcType === "call" && tgtType === "scammer")        edgeLabel = "identified as";
            else if (srcType === "scammer" && tgtType === "location") edgeLabel = "operates from";
            else if (srcType === "call" && tgtType === "bank")       edgeLabel = "impersonated";
            else if (srcType === "call" && tgtType === "script")     edgeLabel = "used script";

            // Dimming: fade edges where either endpoint is outside the neighborhood
            const srcIn = !neighborhoodIds || neighborhoodIds.size === 0 || neighborhoodIds.has(src.id);
            const tgtIn = !neighborhoodIds || neighborhoodIds.size === 0 || neighborhoodIds.has(tgt.id);
            const edgeDimmed = !(srcIn && tgtIn);
            const edgeAlpha = edgeDimmed ? 0.05 : 0.65;

            // Line
            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(tgt.x, tgt.y);
            ctx.strokeStyle = edgeColor;
            ctx.globalAlpha = edgeAlpha;
            ctx.lineWidth = (srcType === "scammer" || tgtType === "scammer" ? 2 : 1.5) / globalScale;
            ctx.stroke();

            // Arrowhead (only when not dimmed)
            if (!edgeDimmed) {
              const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
              const tgtR = 4 + Math.min(8, Math.sqrt((tgt as FGNode).degree) * 1.7);
              const ax = tgt.x - Math.cos(angle) * (tgtR + 3 / globalScale);
              const ay = tgt.y - Math.sin(angle) * (tgtR + 3 / globalScale);
              const arrowLen = 7 / globalScale;
              const arrowAngle = 0.4;
              ctx.beginPath();
              ctx.moveTo(ax, ay);
              ctx.lineTo(
                ax - arrowLen * Math.cos(angle - arrowAngle),
                ay - arrowLen * Math.sin(angle - arrowAngle),
              );
              ctx.lineTo(
                ax - arrowLen * Math.cos(angle + arrowAngle),
                ay - arrowLen * Math.sin(angle + arrowAngle),
              );
              ctx.closePath();
              ctx.fillStyle = edgeColor;
              ctx.globalAlpha = edgeAlpha;
              ctx.fill();
            }

            // Edge label — always visible (no zoom gate), only when not dimmed
            if (!edgeDimmed) {
              const mx = (src.x + tgt.x) / 2;
              const my = (src.y + tgt.y) / 2;
              const fontSize = Math.max(6, 8 / globalScale);
              ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              const textW = ctx.measureText(edgeLabel).width;
              const padX = 2.5;
              const padY = 1.5;
              ctx.fillStyle = "rgba(7, 8, 10, 0.8)";
              ctx.globalAlpha = 0.8;
              ctx.fillRect(mx - textW / 2 - padX, my - fontSize / 2 - padY, textW + padX * 2, fontSize + padY * 2);
              ctx.fillStyle = edgeColor;
              ctx.globalAlpha = 0.55;
              ctx.fillText(edgeLabel, mx, my);
            }

            ctx.globalAlpha = 1;
          }}
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
