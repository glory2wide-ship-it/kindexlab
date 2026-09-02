/**
 * Daily briefing job — all five channels, main + deep-dives, OpenAI premium path.
 *
 * Usage:
 *   npm run briefing:generate
 *   npm run briefing:generate -- --force 2026-09-02
 *
 * Production trigger: GET/POST /api/cron/briefings (CRON_SECRET) at 07:00 KST.
 */
import { llmConfigured } from "../src/lib/analysis/chain/llm";
import { kstDateString } from "../src/lib/briefing/dates";
import { runDailyBriefingJob } from "../src/lib/briefing/job";

async function main() {
  const force = process.argv.includes("--force");
  const editionDate = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg)) ?? kstDateString();

  if (!llmConfigured()) {
    console.error("OPENAI_API_KEY is not set — briefings will fall back to templates.");
  }

  console.log(`Generating ${editionDate} briefings (force=${force}, ai=${llmConfigured()})…`);

  const result = await runDailyBriefingJob({
    persist: true,
    force,
    editionDate,
    onChannel: (channel, count) => {
      console.log(`  ${channel}: ${count} articles`);
    },
  });

  const summary = {
    skipped: result.skipped,
    reason: result.reason ?? null,
    editionDate: result.editionDate,
    removed: result.removed,
    persisted: result.persisted,
    total: result.articles.length,
    articles: result.articles.map((item) => ({
      slug: item.slug,
      kind: item.kind,
      channel: item.channel,
      wordCount: item.wordCount,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
