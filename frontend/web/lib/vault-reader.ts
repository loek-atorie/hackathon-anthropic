// Server-side vault reader. Fetches the live graph from the P2 backend (which
// owns the vault volume on Fly). On Vercel the local filesystem is empty for
// vault/, so all reads go through the backend.
//
// In local dev, if the backend is unreachable, falls back to reading vault/
// from the repo root directly.
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

function backendUrl(): string | null {
  const url = process.env.BACKEND_URL;
  return url ? url.replace(/\/$/, "") : null;
}

async function loadVaultFromBackend(url: string): Promise<GraphData> {
  const res = await fetch(`${url}/api/graph`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`backend /api/graph failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as GraphData;
}

async function loadVaultFromFilesystem(): Promise<GraphData> {
  const { default: matter } = await import("gray-matter");
  const { readdirSync, readFileSync, statSync } = await import("fs");
  const { join, relative } = await import("path");

  const repoRoot = join(process.cwd(), "..", "..");
  const vaultRoot = join(repoRoot, "vault");

  const FOLDER_TO_TYPE: Record<string, GraphNodeType> = {
    calls: "call",
    scammers: "scammer",
    locations: "location",
    banks: "bank",
    scripts: "script",
    organisations: "organisation",
  };

  const nodes: GraphNode[] = [];
  const wikilinkRe = /\[\[([^\]]+)\]\]/g;

  for (const folder of Object.keys(FOLDER_TO_TYPE)) {
    const dir = join(vaultRoot, folder);
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const file of entries) {
      if (!file.endsWith(".md")) continue;
      const filePath = join(dir, file);
      if (!statSync(filePath).isFile()) continue;
      const raw = readFileSync(filePath, "utf-8");
      const { data: frontmatter, content: body } = matter(raw);
      const id = (frontmatter.id as string | undefined) ?? file.replace(/\.md$/, "");
      const label = (frontmatter.label as string | undefined) ?? id;
      nodes.push({
        id,
        type: FOLDER_TO_TYPE[folder],
        label,
        path: relative(repoRoot, filePath),
        frontmatter,
        body,
      });
    }
  }

  // Build edges from wikilinks
  const edges: GraphEdge[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const node of nodes) {
    const text = JSON.stringify(node.frontmatter) + node.body;
    for (const match of text.matchAll(wikilinkRe)) {
      const target = match[1].toLowerCase().replace(/\s+/g, "-");
      if (nodeIds.has(target) && target !== node.id) {
        edges.push({ source: node.id, target, kind: "wikilink" });
      }
    }
  }

  return { nodes, edges };
}

export async function loadVault(): Promise<GraphData> {
  const url = backendUrl();

  if (url) {
    try {
      return await loadVaultFromBackend(url);
    } catch (err) {
      if (process.env.NODE_ENV === "production") throw err;
      console.warn("[vault-reader] backend unreachable, falling back to local vault:", err);
    }
  }

  return loadVaultFromFilesystem();
}
