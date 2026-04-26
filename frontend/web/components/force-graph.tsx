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

// Zone target centers as fractions of canvas — used only for the cluster force.
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
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
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
  highlightedIds?: ReadonlySet<string>;
  onNodeClick?: (node: GraphNode) => void;
  selectedId?: string | null;
  neighborhoodIds?: ReadonlySet<string>;
}

/** Draw a rounded ellipse that encloses a cluster of nodes on the canvas. */
function drawClusterZone(
  ctx: CanvasRenderingContext2D,
  nodes: FGNode[],
  color: string,
  label: string,
  globalScale: number,
) {
  const positioned = nodes.filter((n) => n.x != null && n.y != null);
  if (positioned.length === 0) return;

  // Compute bounding box of the cluster nodes with padding
  const PAD = 32 / globalScale;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of positioned) {
    const r = 4 + Math.min(8, Math.sqrt(n.degree) * 1.7);
    minX = Math.min(minX, (n.x ?? 0) - r);
    maxX = Math.max(maxX, (n.x ?? 0) + r);
    minY = Math.min(minY, (n.y ?? 0) - r);
    maxY = Math.max(maxY, (n.y ?? 0) + r);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = Math.max(28 / globalScale, (maxX - minX) / 2 + PAD);
  const ry = Math.max(22 / globalScale, (maxY - minY) / 2 + PAD);

  // Ellipse fill
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.06;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1 / globalScale;
  ctx.stroke();
  ctx.restore();

  // Label above the ellipse
  ctx.save();
  const fontSize = Math.max(7, 10 / globalScale);
  ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.letterSpacing = "0.1em";
  ctx.fillText(label, cx, cy - ry - 4 / globalScale);
  ctx.restore();
}

export function ForceGraph(props: ForceGraphProps) {
  const { data, highlightedIds, onNodeClick, selectedId, neighborhoodIds } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<unknown>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [, setTick] = useState(0);

  // Keep a ref to fgNodes so onRenderFramePre can read current positions
  // without closing over a stale value.
  const fgNodesRef = useRef<FGNode[]>([]);

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
    fgNodesRef.current = nodes;
    return { fgNodes: nodes, fgLinks: links, nodeTypeMap: typeMap };
  }, [data]);

  // Keep ref in sync when simulation mutates positions
  useEffect(() => {
    fgNodesRef.current = fgNodes;
  }, [fgNodes]);

  // Resize observer
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

  // Pulse animation loop for newly-inserted nodes
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

  // Re-heat when nodes are added
  useEffect(() => {
    const fg = fgRef.current as
      | { d3ReheatSimulation?: () => void }
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
      linkForce?.distance?.(60);
      const chargeForce = fg.d3Force("charge");
      chargeForce?.strength?.(-280);

      if (size.w > 0 && size.h > 0) {
        const STRENGTH = 0.12;
        let simNodes: FGNode[] = [];

        const clusterForce = Object.assign(
          function () {
            for (const n of simNodes) {
              const tx = size.w * (ZONE_FX[n.type] ?? 0.5);
              const ty = size.h * (ZONE_FY[n.type] ?? 0.5);
              n.vx = (n.vx ?? 0) + (tx - (n.x ?? 0)) * STRENGTH;
              n.vy = (n.vy ?? 0) + (ty - (n.y ?? 0)) * STRENGTH;
            }
          },
          {
            initialize(initNodes: FGNode[]) {
              simNodes = initNodes;
            },
          },
        );

        fg.d3Force("cluster", clusterForce);
      }
    } catch {
      // Not fatal — graph renders without clustering.
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
          // Draw cluster zone ellipses on canvas BEFORE nodes, using live node positions
          onRenderFramePre={(ctx, globalScale) => {
            const nodes = fgNodesRef.current;
            // Group nodes by type
            const byType = new Map<GraphNodeType, FGNode[]>();
            for (const n of nodes) {
              if (!byType.has(n.type)) byType.set(n.type, []);
              byType.get(n.type)!.push(n);
            }
            for (const [type, typeNodes] of byType) {
              drawClusterZone(
                ctx as CanvasRenderingContext2D,
                typeNodes,
                NODE_COLORS[type] ?? "#888",
                NODE_TYPE_LABELS[type].toUpperCase(),
                globalScale,
              );
            }
          }}
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

            // Selected: double ring
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

            // Node fill
            ctx.globalAlpha = isDimmed ? 0.08 : 1;
            ctx.beginPath();
            ctx.arc(x, y, baseR, 0, Math.PI * 2);
            ctx.fillStyle = color;
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

            const edgeColor = NODE_COLORS[tgtType ?? "call"] ?? "rgba(232,234,237,0.18)";

            let edgeLabel = "linked";
            if (srcType === "call" && tgtType === "scammer")          edgeLabel = "identified as";
            else if (srcType === "scammer" && tgtType === "location") edgeLabel = "operates from";
            else if (srcType === "call" && tgtType === "bank")        edgeLabel = "impersonated";
            else if (srcType === "call" && tgtType === "script")      edgeLabel = "used script";

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
              ctx.lineTo(ax - arrowLen * Math.cos(angle - arrowAngle), ay - arrowLen * Math.sin(angle - arrowAngle));
              ctx.lineTo(ax - arrowLen * Math.cos(angle + arrowAngle), ay - arrowLen * Math.sin(angle + arrowAngle));
              ctx.closePath();
              ctx.fillStyle = edgeColor;
              ctx.globalAlpha = edgeAlpha;
              ctx.fill();
            }

            // Edge labels only when neighborhood is active (node selected)
            const showLabel = !edgeDimmed && neighborhoodIds && neighborhoodIds.size > 0;
            if (showLabel) {
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
