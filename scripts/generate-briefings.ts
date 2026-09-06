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
import {
  deliverGenerationReport,
  type GenerationReportRow,
} from "../src/lib/ops/generation-report";
import { resetGeminiUsage, snapshotGeminiUsage, formatKrw } from "../src/lib/ops/gemini-usage";

function resolveOvernightBatch(): boolean {
  if (process.argv.includes("--no-batch")) return false;
  if (process.argv.includes("--batch")) return true;
  // CI overnight always Batches unless explicitly disabled via env.
  if (process.env.GITHUB_ACTIONS === "true" && process.env.GEMINI_USE_BATCH !== "0") {
    return true;
  }
  return geminiBatchEnabled();
}

function toRow(outcome: {
  name: string;
  status: "ok" | "fail";
  channel: string;
  kind: string;
  deskLabel?: string;
  reason?: string;
}): GenerationReportRow {
  return {
    name: outcome.name,
    status: outcome.status,
    meta: [outcome.channel, outcome.kind, outcome.deskLabel].filter(Boolean).join(" · "),
    reason: outcome.reason,
  };
}

async function main() {
  const force = process.argv.includes("--force");
  const editionDate = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg)) ?? kstDateString();
  const useGeminiBatch = resolveOvernightBatch();
  resetGeminiUsage(process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash");

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

  const mains = result.outcomes.filter((item) => item.kind === "main");
  const dives = result.outcomes.filter((item) => item.kind === "deep-dive");

  const summary = {
    skipped: result.skipped,
    reason: result.reason ?? null,
    editionDate: result.editionDate,
    removed: result.removed,
    persisted: result.persisted,
    geminiBatch: result.geminiBatch ?? useGeminiBatch,
    mainsOk: mains.filter((item) => item.status === "ok").length,
    mainsFail: mains.filter((item) => item.status === "fail").length,
    deepDivesOk: dives.filter((item) => item.status === "ok").length,
    deepDivesFail: dives.filter((item) => item.status === "fail").length,
    total: result.outcomes.length,
  };
  console.log(JSON.stringify(summary, null, 2));

  const notes = [
    result.skipped ? `Job skipped: ${result.reason ?? "already published"}` : undefined,
    `Gemini Batch=${result.geminiBatch ?? useGeminiBatch}`,
    `API 추정 ${formatKrw(snapshotGeminiUsage().estimatedKrw)}`,
  ].filter(Boolean) as string[];

  const delivery = await deliverGenerationReport(
    {
      subject: `[KinDex] 브리핑·Update 키워드 생성 보고 · ${result.editionDate}`,
      editionDate: result.editionDate,
      pipeline: "daily-briefings",
      generatedAt: new Date().toISOString(),
      cost: snapshotGeminiUsage(),
      sections: [
        {
          title: "일일 브리핑",
          rows: mains.map((item) => ({
            ...toRow(item),
            status: result.skipped ? "skip" : item.status,
            reason: result.skipped ? result.reason ?? "already-published" : item.reason,
          })),
        },
        {
          title: "Update 키워드",
          rows: dives.map((item) => ({
            ...toRow(item),
            status: result.skipped ? "skip" : item.status,
            reason: result.skipped ? result.reason ?? "already-published" : item.reason,
          })),
        },
      ],
      notes,
    },
    `briefings-${result.editionDate}`,
  );
  console.log(`[report] ${delivery.detail}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
