import { ComingSoon, PageShell } from "@/components/page-shell";

export default function PublicPage() {
  return (
    <PageShell
      eyebrow="Counter"
      title="Scammer minutes wasted"
      subtitle="Every minute is a minute they're not scamming someone's grandmother."
    >
      <ComingSoon
        phase="Phase E"
        description="Animated big-number counter, ticking up in real time. Below: a small grid of today's anonymised calls."
      />
    </PageShell>
  );
}
