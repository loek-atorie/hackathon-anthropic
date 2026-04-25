"use client";

// Real EventSource adapter. Same subscribe() signature as mock-bus so sse.ts
// can swap it in without touching any component code.
//
// Connects to process.env.NEXT_PUBLIC_SSE_URL (e.g. http://localhost:8080/events).
// Reconnects on error with exponential backoff capped at 10s.

import type { BusEvent } from "./types";

type Handler = (event: BusEvent) => void;

const VALID_TYPES = new Set<BusEvent["type"]>([
  "transcript_delta",
  "extraction_update",
  "call_ended",
  "graph_node_added",
]);

function parseEvent(raw: string): BusEvent | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.type !== "string" || !VALID_TYPES.has(parsed.type as BusEvent["type"])) {
      console.warn("[real-bus] unknown event type:", parsed.type);
      return null;
    }
    return parsed as unknown as BusEvent;
  } catch {
    console.warn("[real-bus] failed to parse event data:", raw);
    return null;
  }
}

export function subscribe(handler: Handler): () => void {
  const url = process.env.NEXT_PUBLIC_SSE_URL;
  if (!url) {
    console.error("[real-bus] NEXT_PUBLIC_SSE_URL is not set");
    return () => {};
  }

  // Narrowed to string after the guard above
  const sseUrl: string = url;
  let es: EventSource | null = null;
  let cancelled = false;
  let backoffMs = 500;

  function connect() {
    if (cancelled) return;

    es = new EventSource(sseUrl);

    es.onmessage = (ev: MessageEvent<string>) => {
      const event = parseEvent(ev.data);
      if (event) handler(event);
    };

    es.onerror = () => {
      es?.close();
      es = null;
      if (cancelled) return;
      // Exponential backoff: 500ms → 1s → 2s → 4s → 8s → 10s max
      const delay = backoffMs;
      backoffMs = Math.min(backoffMs * 2, 10_000);
      console.warn(`[real-bus] connection lost, reconnecting in ${delay}ms`);
      setTimeout(connect, delay);
    };

    es.onopen = () => {
      backoffMs = 500; // reset on successful connection
    };
  }

  connect();

  return function unsubscribe() {
    cancelled = true;
    es?.close();
    es = null;
  };
}
