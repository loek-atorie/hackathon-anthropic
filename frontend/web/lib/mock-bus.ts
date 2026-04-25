// Mock event bus — replays fixture events on a setTimeout schedule based on
// each event's `t_offset_ms`. Drop-in stand-in for the real SSE bus until P2 ships.
//
// Usage:
//   const unsubscribe = subscribe((e) => console.log(e));
//   // ... later
//   unsubscribe();

import type { BusEvent } from "./types";
import transcriptFixture from "../fixtures/transcript.json";
import extractionsFixture from "../fixtures/extractions.json";

type Handler = (event: BusEvent) => void;

type TimedBusEvent = Extract<BusEvent, { t_offset_ms: number }>;

interface SubscribeOptions {
  /** ms offset to start at; events with smaller t_offset_ms are skipped. Default 0. */
  startAt?: number;
  /** speed multiplier; 2 = twice as fast. Default 1. */
  speed?: number;
}

const VALID_TYPES = new Set<BusEvent["type"]>([
  "transcript_delta",
  "extraction_update",
  "call_ended",
  "graph_node_added",
]);

function assertTimedBusEvent(value: unknown, source: string): TimedBusEvent {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Invalid bus event in ${source}: not an object`);
  }
  const v = value as Record<string, unknown>;
  if (typeof v.type !== "string" || !VALID_TYPES.has(v.type as BusEvent["type"])) {
    throw new Error(`Invalid bus event in ${source}: unknown type "${String(v.type)}"`);
  }
  if (typeof v.call_id !== "string") {
    throw new Error(`Invalid bus event in ${source}: missing call_id`);
  }
  if (typeof v.t_offset_ms !== "number") {
    throw new Error(`Invalid bus event in ${source}: missing t_offset_ms`);
  }
  return value as TimedBusEvent;
}

function loadFixtureEvents(): TimedBusEvent[] {
  const transcript = (transcriptFixture as unknown[]).map((e) =>
    assertTimedBusEvent(e, "transcript.json"),
  );
  const extractions = (extractionsFixture as unknown[]).map((e) =>
    assertTimedBusEvent(e, "extractions.json"),
  );
  const all = [...transcript, ...extractions];
  // Sort by t_offset_ms ascending so handlers get a coherent timeline.
  return all.sort((a, b) => a.t_offset_ms - b.t_offset_ms);
}

export function subscribe(
  handler: Handler,
  options: SubscribeOptions = {},
): () => void {
  const { startAt = 0, speed = 1 } = options;
  const events = loadFixtureEvents();
  const timeouts: ReturnType<typeof setTimeout>[] = [];

  for (const event of events) {
    if (event.t_offset_ms < startAt) continue;
    const delay = Math.max(0, (event.t_offset_ms - startAt) / speed);
    const id = setTimeout(() => {
      handler(event);
    }, delay);
    timeouts.push(id);
  }

  return function unsubscribe() {
    for (const id of timeouts) clearTimeout(id);
    timeouts.length = 0;
  };
}

/**
 * Convenience: returns the full fixture timeline synchronously, useful for
 * tests, snapshot rendering, or "show all" debugging modes. Sorted by t_offset_ms.
 */
export function getAllFixtureEvents(): TimedBusEvent[] {
  return loadFixtureEvents();
}
