import { loadReports } from "@/lib/report-reader";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ callId: string }> },
) {
  const { callId } = await params;
  const reports = await loadReports(callId);
  return Response.json(reports);
}
