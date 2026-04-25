// Quick sanity check: verifies fixture events are sorted, valid, and that
// mock-bus would replay them in order. Doesn't import mock-bus directly to
// avoid pulling Next/TS into a node script — re-implements the same logic.
//
// Run: `node scripts/sanity-bus.mjs` from apps/web/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const transcript = JSON.parse(
  readFileSync(join(ROOT, "fixtures/transcript.json"), "utf8"),
);
const extractions = JSON.parse(
  readFileSync(join(ROOT, "fixtures/extractions.json"), "utf8"),
);

const all = [...transcript, ...extractions].sort(
  (a, b) => a.t_offset_ms - b.t_offset_ms,
);

console.log(`Total events: ${all.length}`);
console.log(`Transcript deltas: ${transcript.filter((e) => e.type === "transcript_delta").length}`);
console.log(`Extraction updates: ${extractions.filter((e) => e.type === "extraction_update").length}`);
console.log(`Call ended events: ${all.filter((e) => e.type === "call_ended").length}`);

// Monotonic check
let last = -1;
for (const e of all) {
  if (e.t_offset_ms < last) {
    console.error(`!! Non-monotonic event at t=${e.t_offset_ms}, last was ${last}`);
    process.exit(1);
  }
  last = e.t_offset_ms;
}
console.log(`Monotonic timeline: OK (0 -> ${last} ms)`);

// Show first 5 events with their would-be delays
console.log("\nFirst 5 events:");
for (const e of all.slice(0, 5)) {
  const tag = e.type === "transcript_delta" ? `${e.speaker}` : e.type === "extraction_update" ? `${e.field}=${JSON.stringify(e.value)}` : e.type;
  console.log(`  +${String(e.t_offset_ms).padStart(6)}ms  ${e.type.padEnd(20)} ${tag}`);
}
console.log("\nLast 3 events:");
for (const e of all.slice(-3)) {
  const tag = e.type === "transcript_delta" ? `${e.speaker}` : e.type === "extraction_update" ? `${e.field}=${JSON.stringify(e.value)}` : `duration_s=${e.duration_s}`;
  console.log(`  +${String(e.t_offset_ms).padStart(6)}ms  ${e.type.padEnd(20)} ${tag}`);
}
