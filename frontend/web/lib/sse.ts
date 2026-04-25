"use client";

// React hook wrapping the bus. Today it points at mock-bus; tomorrow we swap
// the import for a real EventSource adapter — public API stays the same.

import { useCallback, useEffect, useRef, useState } from "react";
import type { BusEvent } from "./types";
import { subscribe } from "./mock-bus";

export interface UseBusResult {
  events: BusEvent[];
  latest: BusEvent | null;
  reset: () => void;
}

export function useBus(): UseBusResult {
  const [events, setEvents] = useState<BusEvent[]>([]);
  const [latest, setLatest] = useState<BusEvent | null>(null);
  const versionRef = useRef(0);

  useEffect(() => {
    const myVersion = versionRef.current;
    const unsubscribe = subscribe((event) => {
      // Guard against late-firing timeouts after a reset.
      if (myVersion !== versionRef.current) return;
      setLatest(event);
      setEvents((prev) => [...prev, event]);
    });
    return unsubscribe;
  }, [versionRef.current]); // re-subscribe when reset bumps the version

  const reset = useCallback(() => {
    versionRef.current += 1;
    setEvents([]);
    setLatest(null);
  }, []);

  return { events, latest, reset };
}
