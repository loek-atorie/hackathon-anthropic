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

function vaultRoot(): string {
  return path.join(repoRoot(), "vault");
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

  // Prevent path traversal: resolve to absolute and verify it's inside vault/
  const fullPath = path.join(repoRoot(), relPath);
  if (!fullPath.startsWith(vaultRoot() + path.sep) && fullPath !== vaultRoot()) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  const nodeType = typeFromPath(relPath);
  if (!nodeType) {
    return NextResponse.json({ error: "unrecognised vault path" }, { status: 400 });
  }
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

  // Build edges: wikilinks that resolve to known IDs (case-insensitive)
  const knownIdsLower = new Map<string, string>(
    knownIdsParam
      ? knownIdsParam.split(",").filter(Boolean).map((id) => [id.toLowerCase(), id])
      : []
  );
  const links = [...frontmatterWikilinks(fm), ...extractWikilinks(body)];
  const seenEdges = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const link of links) {
    const canonical = knownIdsLower.get(link.toLowerCase());
    if (!canonical) continue;
    if (canonical === id) continue;
    const key = [id, canonical].sort().join("|");
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    edges.push({ source: id, target: canonical, kind: "wikilink" });
  }

  return NextResponse.json({ node, edges });
}
