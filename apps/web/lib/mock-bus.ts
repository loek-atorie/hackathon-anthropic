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

function loadFixtureEvents(): TimedBusEvent[] {
  const all = [
    ...(transcriptFixture as TimedBusEvent[]),
    ...(extractionsFixture as TimedBusEvent[]),
  ];
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
  const t0 = performance.now();

  for (const event of events) {
    if (event.t_offset_ms < startAt) continue;
    const delay = Math.max(0, (event.t_offset_ms - startAt) / speed);
    const id = setTimeout(() => {
      handler(event);
    }, delay);
    timeouts.push(id);
  }

  // Reference t0 to keep eslint happy and to be useful for debugging.
  void t0;

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
