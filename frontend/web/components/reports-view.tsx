"use client";

import { useState, useTransition } from "react";
import { ReportTabs } from "@/components/report-tabs";
import type { ReportMap } from "@/lib/report-reader";

interface ReportsViewProps {
  initialCallId: string;
  initialReports: ReportMap;
  callIds: string[];
}

export function ReportsView({
  initialCallId,
  initialReports,
  callIds,
}: ReportsViewProps) {
  const [selectedCallId, setSelectedCallId] = useState(initialCallId);
  const [reports, setReports] = useState<ReportMap>(initialReports);
  const [isPending, startTransition] = useTransition();

  async function selectCall(callId: string) {
    if (callId === selectedCallId) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/reports/${encodeURIComponent(callId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ReportMap = await res.json();
        setSelectedCallId(callId);
        setReports(data);
      } catch (err) {
        console.error("[reports] failed to load call reports:", err);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      {/* Left sidebar: call selector */}
      <aside className="shrink-0 lg:w-44">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background-elev)] overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[var(--background-card)] px-4 py-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
              Gesprekken
            </span>
          </div>
          <nav className="flex flex-col p-1.5 max-h-[60vh] overflow-y-auto lg:max-h-[calc(100vh-280px)]">
            {callIds.map((callId) => {
              const active = callId === selectedCallId;
              return (
                <button
                  key={callId}
                  type="button"
                  onClick={() => selectCall(callId)}
                  disabled={isPending}
                  className={[
                    "relative w-full rounded-md px-3 py-2 text-left text-sm font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
                    active
                      ? "bg-[var(--background-card)] text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:bg-[var(--background-card)] hover:text-[var(--foreground)]",
                    isPending && !active ? "opacity-50" : "",
                  ].join(" ")}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 inset-y-2 w-[2px] rounded-full bg-[var(--accent)]"
                    />
                  )}
                  <span className="pl-1">{callId}</span>
                  {callId === initialCallId && (
                    <span className="ml-1.5 text-[10px] font-sans text-[var(--accent)] opacity-80">
                      demo
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content: report tabs */}
      <div
        className={[
          "min-w-0 flex-1 transition-opacity duration-150",
          isPending ? "opacity-50 pointer-events-none" : "opacity-100",
        ].join(" ")}
      >
        <ReportTabs key={selectedCallId} reports={reports} />
      </div>
    </div>
  );
}
