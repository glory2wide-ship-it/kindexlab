/**
 * Guardrail for the three recurring trends regressions:
 *   1. TRENDS_DATA_SOURCE=mock accidentally serving fixtures
 *   2. Stale src/data/ingestion/snapshot.json
 *   3. Too many crawl sources failing
 *
 * Usage:
 *   npm run trends:health
 *   npm run trends:health -- --post-ingest
 *   TRENDS_REQUIRE_LIVE=1 npm run trends:health
 */
import { evaluateTrendsHealth } from "../src/lib/ingestion/health";

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function main() {
  const postIngest = flag("--post-ingest");
  const report = evaluateTrendsHealth({
    maxAgeMs: postIngest
      ? Number(process.env.TRENDS_HEALTH_POST_INGEST_MAX_AGE_MS ?? 45 * 60 * 1000)
      : undefined,
    rejectMock: true,
    rejectUsedPrevious: postIngest || flag("--reject-used-previous"),
    usedPreviousSnapshot: process.env.TRENDS_USED_PREVIOUS === "1",
  });

  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        source: report.source,
        updatedAt: report.updatedAt,
        ageMinutes:
          report.ageMs != null ? Number((report.ageMs / 60_000).toFixed(1)) : undefined,
        itemCount: report.itemCount,
        sourceCount: report.sourceCount,
        failedCount: report.failedCount,
        requiredFailedCount: report.requiredFailedCount,
        failedSources: report.failedSources,
        issues: report.issues,
      },
      null,
      2,
    ),
  );

  for (const issue of report.issues) {
    if (process.env.CI === "true") {
      console.error(`::${issue.level}::${issue.message}`);
    } else {
      console.error(`[trends:health:${issue.level}] ${issue.message}`);
    }
  }

  if (!report.ok) process.exitCode = 1;
}

main();
