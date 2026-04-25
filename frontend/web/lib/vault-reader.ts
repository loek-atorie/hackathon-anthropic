// Server-side helper for reading the Obsidian vault. Phase C will implement
// this fully (parses frontmatter + extracts [[wikilinks]] + returns nodes/edges).
// For Phase A this is a stub returning [] so the import path is stable.

import type { VaultEntity } from "./types";

export async function loadVault(): Promise<VaultEntity[]> {
  // Phase C will replace this with a real reader using fs + gray-matter.
  return [];
}
