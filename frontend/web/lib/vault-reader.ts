// Server-side vault reader. Fetches the live graph from the P2 backend (which
// owns the vault volume on Fly). On Vercel the local filesystem is empty for
// vault/, so all reads go through the backend.
//
// IMPORTANT: do not import this from a client component. It uses server-only
// env (BACKEND_URL).

import "server-only";
import type { GraphNodeType } from "@/lib/types";

export type { GraphNodeType };

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  /** Path relative to the repo root, e.g. "vault/banks/ING.md". */
  path: string;
  frontmatter: Record<string, unknown>;
  /** Raw markdown body (frontmatter stripped). */
  body: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: "wikilink";
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function backendUrl(): string {
  const url = process.env.BACKEND_URL;
  if (!url) {
    throw new Error("BACKEND_URL is not set — point it at the P2 backend (e.g. https://whale-p2.fly.dev)");
  }
  return url.replace(/\/$/, "");
}

export async function loadVault(): Promise<GraphData> {
  const res = await fetch(`${backendUrl()}/api/graph`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`backend /api/graph failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as GraphData;
}
