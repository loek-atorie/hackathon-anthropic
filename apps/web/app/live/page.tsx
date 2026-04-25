import { ComingSoon, PageShell } from "@/components/page-shell";

export default function LivePage() {
  return (
    <PageShell
      eyebrow="Realtime"
      title="Live call"
      subtitle="Transcript stream, extraction sidebar, and call timer. Wired to the mock bus during dev; flips to P2's SSE bus at H17."
    >
      <ComingSoon
        phase="Phase B"
        description="Speaker-labeled transcript, monospace timer, and extraction cards (bank, IBAN, tactics, urgency, script signature). Will consume useBus()."
      />
    </PageShell>
  );
}
