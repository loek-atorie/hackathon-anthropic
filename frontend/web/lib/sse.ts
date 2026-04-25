"use client";

// React hook wrapping the bus. When NEXT_PUBLIC_SSE_URL is set at build time,
// uses the real EventSource adapter (real-bus.ts). Otherwise falls back to
// mock-bus fixture replay — safe for dev and demo without a running backend.

import { useCallback, useEffect, useState } from "react";
import type { BusEvent } from "./types";
import { subscribe as mockSubscribe } from "./mock-bus";
import { subscribe as realSubscribe } from "./real-bus";

// NEXT_PUBLIC_ vars are inlined by Next.js at build time, so this branch is
// resolved statically — only one subscribe implementation is bundled per build.
const subscribe = process.env.NEXT_PUBLIC_SSE_URL ? realSubscribe : mockSubscribe;

export interface UseBusResult {
  events: BusEvent[];
  latest: BusEvent | null;
  reset: () => void;
  /** Bumps each time `reset()` is called. Lets consumers re-anchor wall-clock state. */
  sessionKey: number;
}

export function useBus(): UseBusResult {
  const [events, setEvents] = useState<BusEvent[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      setEvents((prev) => [...prev, event]);
    });
    return unsubscribe;
  }, [version]); // re-subscribe when reset bumps the version

  const reset = useCallback(() => {
    setEvents([]);
    setVersion((v) => v + 1);
  }, []);

  const latest = events.at(-1) ?? null;

  return { events, latest, reset, sessionKey: version };
}
