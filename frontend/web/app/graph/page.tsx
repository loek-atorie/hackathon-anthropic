import { ComingSoon, PageShell } from "@/components/page-shell";

export default function GraphPage() {
  return (
    <PageShell
      eyebrow="Intelligence"
      title="Knowledge graph"
      subtitle="Force-directed view of every call, scammer voice, IBAN, bank, and script. Click a node to see the raw markdown — same files Obsidian reads."
    >
      <ComingSoon
        phase="Phase C"
        description="react-force-graph-2d, color-coded nodes, animated insertion when a call ends. Reads vault/*.md via lib/vault-reader.ts."
      />
    </PageShell>
  );
}
