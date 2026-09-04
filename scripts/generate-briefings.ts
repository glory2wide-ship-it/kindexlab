/**
 * Daily briefing job — all five channels, mains + submenu deep-dives.
 *
 * Overnight / CI uses Gemini Batch (−50%) for every main + deep-dive in one
 * coalesced session. Pass `--no-batch` for Live API (local debugging).
 *
 * Usage:
 *   npm run briefing:generate:local
 *   npm run briefing:generate -- --force 2026-09-02
 *   npm run briefing:generate -- --batch --force
 *
 * Production: GitHub Actions `.github/workflows/daily-briefings.yml`
 * (04:00 KST → Gemini Batch → commit extra.json → Vercel deploy ~07:00 KST).
 */
import {
  briefingLlmConfigured,
  briefingProvider,
  geminiBatchEnabled,
} from "../src/lib/analysis/chain/llm";
import { kstDateString } from "../src/lib/briefing/dates";
import { runDailyBriefingJob } from "../src/lib/briefing/job";

function resolveOvernightBatch(): boolean {
  if (process.argv.includes("--no-batch")) return false;
  if (process.argv.includes("--batch")) return true;
  // CI overnight always Batches unless explicitly disabled via env.
  if (process.env.GITHUB_ACTIONS === "true" && process.env.GEMINI_USE_BATCH !== "0") {
    return true;
  }
  return geminiBatchEnabled();
}

async function main() {
  const force = process.argv.includes("--force");
  const editionDate = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg)) ?? kstDateString();
  const useGeminiBatch = resolveOvernightBatch();

  if (useGeminiBatch && process.env.GEMINI_USE_BATCH !== "0") {
    process.env.GEMINI_USE_BATCH = "1";
  }

  if (!briefingLlmConfigured()) {
    console.error(
      `Briefing LLM is not configured (provider=${briefingProvider()}). Set GEMINI_API_KEY — briefings will fall back to templates.`,
    );
  }

  console.log(
    `Generating ${editionDate} briefings (force=${force}, provider=${briefingProvider()}, ai=${briefingLlmConfigured()}, geminiBatch=${useGeminiBatch})…`,
  );

  const result = await runDailyBriefingJob({
    persist: true,
    force,
    editionDate,
    useGeminiBatch,
    onChannel: (channel, count) => {
      console.log(`  ${channel}: ${count} articles`);
    },
  });

  const mains = result.articles.filter((item) => item.kind === "main").length;
  const dives = result.articles.filter((item) => item.kind === "deep-dive").length;

  const summary = {
    skipped: result.skipped,
    reason: result.reason ?? null,
    editionDate: result.editionDate,
    removed: result.removed,
    persisted: result.persisted,
    geminiBatch: result.geminiBatch ?? useGeminiBatch,
    mains,
    deepDives: dives,
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
