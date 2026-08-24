/**
 * Live entertainment metrics ingest.
 *
 * Pulls public music charts, Nielsen ratings, and news/trend feeds, then
 * writes src/data/ingestion/snapshot.json for TRENDS_DATA_SOURCE=live.
 *
 * Usage:
 *   npm run ingest:trends
 */
import { runIngestJob } from "../src/lib/ingestion/job";

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
  if (!result.itemCount) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
