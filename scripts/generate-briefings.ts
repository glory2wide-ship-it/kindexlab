/**
 * Backend template for the daily briefing job.
 *
 * Generates 1–3 analytical articles (1000+ words) from top-ranking entities.
 * Optional OpenAI drafting runs when OPENAI_API_KEY is set; otherwise the
 * deterministic composer is used.
 *
 * Usage:
 *   npm run briefing:generate
 *   npm run briefing:generate -- --force 2026-08-24
 *
 * Production trigger: GET/POST /api/cron/briefings (CRON_SECRET) at 07:00 KST.
 */
import { runDailyBriefingJob } from "../src/lib/briefing/job";

async function main() {
  const force = process.argv.includes("--force");
  const editionDate = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));
  const result = await runDailyBriefingJob({ persist: true, force, editionDate });
  const summary = {
    skipped: result.skipped,
    reason: result.reason ?? null,
    editionDate: result.editionDate,
    persisted: result.persisted,
    articles: result.articles.map((item) => ({
      slug: item.slug,
      kind: item.kind,
      category: item.category,
      wordCount: item.wordCount,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
