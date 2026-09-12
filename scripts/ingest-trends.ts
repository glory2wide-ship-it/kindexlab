/**
 * Live entertainment metrics ingest.
 *
 * Pulls public music charts, Nielsen ratings, and news/trend feeds, then
 * writes src/data/ingestion/snapshot.json for TRENDS_DATA_SOURCE=live.
 *
 * Usage:
 *   npm run ingest:trends
 */
import { evaluateTrendsHealth } from "../src/lib/ingestion/health";
import { readPersistedSnapshot, runIngestJob } from "../src/lib/ingestion/job";

async function main() {
  const persist = !process.argv.includes("--no-persist");
  const result = await runIngestJob({ persist });
  console.log(
    JSON.stringify(
      {
        persisted: result.persisted,
        usedPreviousSnapshot: result.usedPreviousSnapshot,
        updatedAt: result.updatedAt,
        itemCount: result.itemCount,
        sources: result.sourceResults,
      },
      null,
      2,
    ),
  );

  if (!result.itemCount) {
    // Family timeouts leave orphaned fetches open; force-exit so CI cannot hang
    // until the 12m step timeout after health already decided.
    process.exit(1);
  }

  // Post-ingest guard: catch mock env, collapsed crawls, and source outages
  // before CI commits a bad snapshot or a local server keeps serving it.
  const health = evaluateTrendsHealth({
    snapshot: readPersistedSnapshot() ?? null,
    maxAgeMs: Number(process.env.TRENDS_HEALTH_POST_INGEST_MAX_AGE_MS ?? 45 * 60 * 1000),
    rejectMock: true,
    rejectUsedPrevious: true,
    usedPreviousSnapshot: result.usedPreviousSnapshot,
  });
  console.log(
    JSON.stringify(
      {
        healthOk: health.ok,
        requiredFailedCount: health.requiredFailedCount,
        failedSources: health.failedSources,
        issues: health.issues,
      },
      null,
      2,
    ),
  );
  if (!health.ok) {
    for (const issue of health.issues) {
      console.error(`[ingest:trends:${issue.level}] ${issue.message}`);
    }
    process.exit(1);
  }
  // Orphaned timed-out source fetches keep the event loop alive; exit cleanly
  // so a healthy snapshot is committed instead of dying on the step timeout.
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
