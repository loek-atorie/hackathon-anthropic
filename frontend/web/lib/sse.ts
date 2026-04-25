"use client";

// React hook wrapping the bus. Today it points at mock-bus; tomorrow we swap
// the import for a real EventSource adapter — public API stays the same.

import { useCallback, useEffect, useState } from "react";
import type { BusEvent } from "./types";
import { subscribe } from "./mock-bus";

export interface UseBusResult {
  events: BusEvent[];
  latest: BusEvent | null;
  reset: () => void;
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

  return { events, latest, reset };
}
