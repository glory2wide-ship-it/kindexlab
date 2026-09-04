/**
 * Overnight 오늘의 분석 for every heatmap menu tile.
 *
 * Uses Gemini Batch (−50%) when GEMINI_USE_BATCH=1. Fresh TTL hits are skipped
 * unless --force. First-click detail pages stay on Live API (see pipeline.ts).
 *
 * Usage:
 *   npx tsx scripts/generate-heatmap-analysis.ts
 *   npx tsx scripts/generate-heatmap-analysis.ts --channel=economy --limit=10
 *   npx tsx scripts/generate-heatmap-analysis.ts --force --dry
 */
import { listHeatmapAnalysisTargets } from "../src/lib/analysis/heatmap-inventory";
import {
  ANALYSIS_OVERNIGHT_BATCH_SIZE,
  runHeatmapAnalysisOvernight,
} from "../src/lib/analysis/overnight-batch";
import { kstDateString } from "../src/lib/briefing/dates";
import { getRankings } from "../src/lib/api";
import { deliverGenerationReport } from "../src/lib/ops/generation-report";
import { formatKrw, resetGeminiUsage, snapshotGeminiUsage } from "../src/lib/ops/gemini-usage";
import { POST_CHANNELS } from "../src/lib/posts/channels";
import type { PostChannel } from "../src/lib/posts/types";

function flag(name: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match?.slice(name.length + 3);
}

function num(name: string, fallback: number): number {
  const parsed = Number.parseInt(flag(name) ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseChannel(): PostChannel | undefined {
  const raw = flag("channel");
  const allowed = POST_CHANNELS.map((channel) => channel.id);
  return allowed.includes(raw as PostChannel) ? (raw as PostChannel) : undefined;
}

async function main() {
  const startedAt = Date.now();
  const channel = parseChannel();
  const editionDate = flag("date") ?? kstDateString();
  const offset = num("offset", 0);
  const force = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry");
  const batchSize = num("batch", ANALYSIS_OVERNIGHT_BATCH_SIZE) || ANALYSIS_OVERNIGHT_BATCH_SIZE;
  resetGeminiUsage(process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash");

  const all = await listHeatmapAnalysisTargets({ channel });
  const limit = num("limit", all.length);
  const targets = all.slice(offset, offset + limit);

  console.log(
    `[inventory] ${targets.length}건 / 전체 ${all.length}건 · edition=${editionDate} · force=${force}`,
  );

  if (dryRun) {
    for (const [index, target] of targets.entries()) {
      console.log(
        `  ${String(index + 1).padStart(3)}. [${target.channel}/${target.boardSlug}] ${target.entity.name} → ${target.entity.slug}`,
      );
    }
    return;
  }

  const market = await getRankings();
  const run = await runHeatmapAnalysisOvernight(targets, {
    market,
    editionDate,
    force,
    batchSize,
    onProgress: (item, position, total) => {
      const tag = item.skipped ? "skip" : item.ok ? "ok" : "fail";
      console.log(
        `[${position}/${total}] ${tag} ${item.keyword} (${item.kind ?? item.reason ?? "-"}) ${item.ms}ms`,
      );
    },
  });

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[done] generated=${run.generated} skipped=${run.skipped} failed=${run.failed} batches=${run.batches} geminiBatch=${run.geminiBatch} ${seconds}s`,
  );

  const delivery = await deliverGenerationReport(
    {
      subject: `[KindexLab] 오늘의 분석 생성 보고 · ${editionDate}`,
      editionDate,
      pipeline: "heatmap-analysis",
      generatedAt: new Date().toISOString(),
      cost: snapshotGeminiUsage(),
      sections: [
        {
          title: "오늘의 분석",
          rows: run.items.map((item) => ({
            name: item.keyword,
            status: item.skipped ? ("skip" as const) : item.ok ? ("ok" as const) : ("fail" as const),
            meta: `${item.channel}/${item.boardSlug}`,
            reason: item.skipped
              ? "ttl-hit"
              : item.ok
                ? item.chars
                  ? `${item.chars}자`
                  : undefined
                : item.reason,
          })),
        },
      ],
      notes: [
        `generated=${run.generated}`,
        `skipped=${run.skipped}`,
        `failed=${run.failed}`,
        `geminiBatch=${run.geminiBatch}`,
        `${seconds}s`,
        `API 추정 ${formatKrw(snapshotGeminiUsage().estimatedKrw)}`,
      ],
    },
    `heatmap-analysis-${editionDate}`,
  );
  console.log(`[report] ${delivery.detail}`);

  if (run.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
