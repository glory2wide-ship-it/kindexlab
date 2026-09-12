import { evaluateTrendsHealth } from "@/lib/ingestion/health";
import { readPersistedSnapshot } from "@/lib/ingestion/job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lightweight trends health probe for uptime monitors / on-call.
 * Does not expose secrets — only snapshot freshness and source failure counts.
 */
export async function GET() {
  const snapshot = readPersistedSnapshot() ?? null;
  const report = evaluateTrendsHealth({
    snapshot,
    rejectMock: true,
  });

  return Response.json(
    {
      ok: report.ok,
      source: report.source,
      updatedAt: report.updatedAt,
      ageMinutes:
        report.ageMs != null ? Number((report.ageMs / 60_000).toFixed(1)) : null,
      itemCount: report.itemCount,
      sourceCount: report.sourceCount,
      failedCount: report.failedCount,
      requiredFailedCount: report.requiredFailedCount,
      failedSources: report.failedSources.map((row) => ({
        id: row.id,
        optional: row.optional,
        error: row.error,
      })),
      issues: report.issues,
    },
    {
      status: report.ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
