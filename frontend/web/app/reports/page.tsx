import { loadReports, listReportCallIds } from "@/lib/report-reader";
import { ReportsView } from "@/components/reports-view";
import { PageShell } from "@/components/page-shell";

// Always re-read reports so new files show up in dev.
export const dynamic = "force-dynamic";

const DEFAULT_CALL_ID = "call-0042";

export default async function ReportsPage() {
  const [callIds, initialReports] = await Promise.all([
    listReportCallIds(),
    loadReports(DEFAULT_CALL_ID),
  ]);

  // Ensure the default call is in the list even if no fixture exists yet
  const allCallIds = callIds.includes(DEFAULT_CALL_ID)
    ? callIds
    : [DEFAULT_CALL_ID, ...callIds];

  return (
    <PageShell
      eyebrow="Stakeholders"
      title="Reports"
      subtitle="Four stakeholder views — every call rendered as a Dutch case file."
    >
      <ReportsView
        initialCallId={DEFAULT_CALL_ID}
        initialReports={initialReports}
        callIds={allCallIds}
      />
    </PageShell>
  );
}
