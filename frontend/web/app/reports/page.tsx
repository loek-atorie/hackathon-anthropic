import { ComingSoon, PageShell } from "@/components/page-shell";

export default function ReportsPage() {
  return (
    <PageShell
      eyebrow="Stakeholders"
      title="Reports"
      subtitle="Politie, bank, telco, and public — every call rendered as a fluent Dutch case file."
    >
      <ComingSoon
        phase="Phase D"
        description="shadcn Tabs over four stakeholders. Renders markdown from vault/_reports/<call-id>-<stakeholder>.md with a print-friendly stylesheet."
      />
    </PageShell>
  );
}
