// Server-side vault reader. Walks the repo-root vault/ directory, parses every
// markdown file's YAML frontmatter, and emits a graph of nodes + edges suitable
// for the /graph page.
//
// IMPORTANT: do not import this from a client component. It uses node:fs.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
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

const TYPE_DIRS: Record<string, GraphNodeType> = {
  calls: "call",
  scammers: "scammer",
  ibans: "iban",
  banks: "bank",
  scripts: "script",
};

const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/g;

function repoRoot(): string {
  // This file lives at frontend/web/lib/vault-reader.ts — repo root is two
  // directories up from frontend/web/ (which is process.cwd() during next build).
  // turbopackIgnore: true — we intentionally use fs; don't trace the whole tree.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "..");
}

function vaultRoot(): string {
  // process.cwd() during `next dev` / `next build` is frontend/web/, so the
  // vault lives two levels up.
  // turbopackIgnore: true — we intentionally use fs; don't trace the whole tree.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "..", "vault");
}

async function listMarkdown(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  return entries.filter((f) => f.endsWith(".md")).map((f) => path.join(dir, f));
}

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
        if (typeof item === "string") {
          out.push(...extractWikilinks(item));
        }
      }
    }
  }
  return out;
}

interface ParsedFile {
  filename: string;
  relPath: string;
  type: GraphNodeType;
  frontmatter: Record<string, unknown>;
  body: string;
  links: string[];
}

async function parseFile(
  fullPath: string,
  type: GraphNodeType,
  rootForRel: string,
): Promise<ParsedFile> {
  const raw = await fs.readFile(fullPath, "utf8");
  const parsed = matter(raw);
  const fm = Object.fromEntries(
    Object.entries(parsed.data ?? {}).map(([k, v]) => [
      k,
      v instanceof Date ? v.toISOString() : v,
    ])
  ) as Record<string, unknown>;
  const body = parsed.content ?? "";
  const links = [...frontmatterWikilinks(fm), ...extractWikilinks(body)];
  const relPath = path.relative(rootForRel, fullPath);
  const filename = path.basename(fullPath, ".md");
  return {
    filename,
    relPath: relPath.split(path.sep).join("/"),
    type,
    frontmatter: fm,
    body,
    links,
  };
}

function deriveId(parsed: ParsedFile): string {
  const fm = parsed.frontmatter;
  // Prefer explicit `id` from frontmatter for calls (filenames are timestamped).
  if (parsed.type === "call") {
    const id = typeof fm.id === "string" ? fm.id : null;
    if (id) return id;
  }
  // Scripts: prefer `signature`.
  if (parsed.type === "script") {
    const sig = typeof fm.signature === "string" ? fm.signature : null;
    if (sig) return sig;
  }
  // For everything else: filename without extension. (Matches how wikilinks
  // reference banks/ibans/scammers — by filename.)
  return parsed.filename;
}

function deriveLabel(node: GraphNode): string {
  const fm = node.frontmatter;
  switch (node.type) {
    case "call":
      return typeof fm.id === "string" ? fm.id : node.id;
    case "bank":
      return typeof fm.name === "string" ? fm.name : node.id;
    case "iban":
      return typeof fm.iban === "string" ? fm.iban : node.id;
    case "script":
      return typeof fm.signature === "string" ? fm.signature : node.id;
    case "scammer":
      return typeof fm.cluster_id === "string" ? fm.cluster_id : node.id;
    default:
      return node.id;
  }
}

export async function loadVault(): Promise<GraphData> {
  const vault = vaultRoot();
  const root = repoRoot();

  const parsedFiles: ParsedFile[] = [];
  for (const [dirName, type] of Object.entries(TYPE_DIRS)) {
    const dir = path.join(vault, dirName);
    const files = await listMarkdown(dir);
    for (const f of files) {
      try {
        parsedFiles.push(await parseFile(f, type, root));
      } catch (err) {
        // Don't kill the whole graph if one file fails — log and move on.
        console.warn(`[vault-reader] failed to parse ${f}:`, err);
      }
    }
  }

  // Build nodes with ids.
  const nodes: GraphNode[] = parsedFiles.map((p) => {
    const node: GraphNode = {
      id: deriveId(p),
      type: p.type,
      label: "",
      path: p.relPath,
      frontmatter: p.frontmatter,
      body: p.body,
    };
    node.label = deriveLabel(node);
    return node;
  });

  // Build a case-insensitive lookup so [[ing]] still resolves to the ING node.
  const byId = new Map<string, GraphNode>();
  const byIdLower = new Map<string, GraphNode>();
  for (const n of nodes) {
    byId.set(n.id, n);
    byIdLower.set(n.id.toLowerCase(), n);
  }

  // Build edges (deduped by source|target).
  const seenEdges = new Set<string>();
  const edges: GraphEdge[] = [];
  for (let i = 0; i < parsedFiles.length; i++) {
    const parsed = parsedFiles[i];
    const sourceNode = nodes[i];
    for (const link of parsed.links) {
      const target = byId.get(link) ?? byIdLower.get(link.toLowerCase());
      if (!target) {
        console.warn(
          `[vault-reader] unresolved wikilink "${link}" from ${parsed.relPath}`,
        );
        continue;
      }
      if (target.id === sourceNode.id) continue;
      const key = [sourceNode.id, target.id].sort().join("|");
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      edges.push({ source: sourceNode.id, target: target.id, kind: "wikilink" });
    }
  }

  return { nodes, edges };
}
