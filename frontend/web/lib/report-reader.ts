// Server-side report reader. Reads stakeholder markdown reports from
// vault/_reports/<callId>-<stakeholder>.md in the repo root.
//
// IMPORTANT: do not import this from a client component. It uses node:fs.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

const STAKEHOLDERS = ["politie", "bank", "telco", "public"] as const;
type Stakeholder = (typeof STAKEHOLDERS)[number];

export type ReportMap = Record<Stakeholder, string>;

function reportsDir(): string {
  // This file lives at frontend/web/lib/report-reader.ts.
  // process.cwd() during `next dev` / `next build` is frontend/web/, so the
  // vault lives two levels up.
  // turbopackIgnore: true — we intentionally use fs; don't trace the whole tree.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "..", "vault", "_reports");
}

/**
 * Reads all four stakeholder reports for a given call ID.
 * Returns a map of { politie, bank, telco, public } → markdown string.
 * If a file is missing or unreadable, returns an empty string for that key.
 */
export async function loadReports(callId: string): Promise<ReportMap> {
  const dir = reportsDir();

  const results = await Promise.all(
    STAKEHOLDERS.map(async (stakeholder) => {
      const filePath = path.join(dir, `${callId}-${stakeholder}.md`);
      try {
        const content = await fs.readFile(filePath, "utf8");
        return [stakeholder, content] as const;
      } catch {
        // File missing or unreadable — return empty string, don't throw.
        return [stakeholder, ""] as const;
      }
    }),
  );

  return Object.fromEntries(results) as ReportMap;
}

/**
 * Scans vault/_reports/ and returns a sorted list of unique call IDs
 * (most recent first — relies on lexicographic sort of call-NNNN format).
 */
export async function listReportCallIds(): Promise<string[]> {
  const dir = reportsDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const ids = new Set<string>();
  for (const filename of entries) {
    if (!filename.endsWith(".md")) continue;
    // Filename pattern: <callId>-<stakeholder>.md
    // Stakeholders are exactly: politie, bank, telco, public
    const match = filename.match(/^(.+)-(politie|bank|telco|public)\.md$/);
    if (match) {
      ids.add(match[1]);
    }
  }

  // Sort descending (most recent first) — works for call-NNNN lexicographic order.
  return Array.from(ids).sort((a, b) => b.localeCompare(a));
}
