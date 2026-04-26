// Shared event + entity types for The Scammer's Mirror.
// These are the contract between P2's backend (FastAPI/SSE) and P3's webapp.
// Mock-bus replays these; real EventSource will emit identically-shaped events.

export type Speaker = "mevrouw" | "scammer";

export type ExtractionField =
  | "claimed_bank"
  | "location"
  | "callback_number"
  | "tactics"
  | "urgency_score"
  | "script_signature";

export interface TranscriptDelta {
  type: "transcript_delta";
  call_id: string;
  t_offset_ms: number;
  speaker: Speaker;
  text: string;
}

export interface ExtractionUpdate {
  type: "extraction_update";
  call_id: string;
  t_offset_ms: number;
  field: ExtractionField;
  value: string | string[] | number;
}

export interface CallEnded {
  type: "call_ended";
  call_id: string;
  t_offset_ms: number;
  duration_s: number;
}

export type GraphNodeType = "call" | "scammer" | "location" | "bank" | "script";

export interface GraphNodeAdded {
  type: "graph_node_added";
  call_id: string;
  node_id: string;
  node_type: GraphNodeType;
  markdown_path: string;
}

export type BusEvent =
  | TranscriptDelta
  | ExtractionUpdate
  | CallEnded
  | GraphNodeAdded;

// ----- Vault entity types (parsed shape: frontmatter + body) -----

export type EntityType = "call" | "scammer" | "location" | "bank" | "script";

export interface BaseEntity<TFrontmatter> {
  /** filesystem-relative path within the vault, e.g. "calls/2026-04-23T11-04-call-0031.md" */
  path: string;
  /** filename slug without extension, used as the node id */
  slug: string;
  /** YAML frontmatter, parsed */
  frontmatter: TFrontmatter;
  /** Markdown body (everything after the frontmatter block) */
  body: string;
  /** [[wikilinks]] extracted from body + frontmatter list fields */
  links: string[];
}

export interface CallFrontmatter {
  type: "call";
  id: string;
  started_at: string; // ISO
  duration_s: number;
  scammer: string; // wikilink string
  claimed_bank: string;
  script: string;
  tactics: string[];
  language: "nl";
}

export interface ScammerFrontmatter {
  type: "scammer";
  cluster_id: string;
  first_seen: string;
  seen_in_calls: string[];
  location?: string; // wikilink string e.g. "[[amsterdam]]" — optional for legacy/hash-named scammers
  notes?: string;
}

export interface LocationFrontmatter {
  type: "location";
  city: string;
  country: string;
  country_code: string; // ISO 3166-1 alpha-2
  first_seen: string; // ISO 8601
  seen_in_calls: string[]; // wikilinks
}

export interface BankFrontmatter {
  type: "bank";
  name: string;
  referenced_in_calls: string[];
}

export interface ScriptFrontmatter {
  type: "script";
  signature: string;
  description: string;
  seen_in_calls: string[];
}

export type CallEntity = BaseEntity<CallFrontmatter>;
export type ScammerEntity = BaseEntity<ScammerFrontmatter>;
export type LocationEntity = BaseEntity<LocationFrontmatter>;
export type BankEntity = BaseEntity<BankFrontmatter>;
export type ScriptEntity = BaseEntity<ScriptFrontmatter>;

export type VaultEntity =
  | CallEntity
  | ScammerEntity
  | LocationEntity
  | BankEntity
  | ScriptEntity;
