/**
 * Overnight 오늘의 분석 for every heatmap menu tile.
 *
 * Uses Gemini Batch (−50%) when GEMINI_USE_BATCH=1. Fresh TTL hits are skipped
 * unless --force. First-click detail pages stay on Live API (see pipeline.ts).
 *
 * In CI, each successful batch checkpoints `src/data/analysis/cache.json` to
 * GitHub so a 6h Actions timeout cannot discard already-written articles.
 *
 * Usage:
 *   npx tsx scripts/generate-heatmap-analysis.ts
 *   npx tsx scripts/generate-heatmap-analysis.ts --channel=economy --limit=10
 *   npx tsx scripts/generate-heatmap-analysis.ts --board=overseas-stock-index
 *   npx tsx scripts/generate-heatmap-analysis.ts --force --dry
 */
import { spawnSync } from "node:child_process";
import {
  assertRequiredHeatmapBoards,
  listHeatmapAnalysisTargets,
} from "../src/lib/analysis/heatmap-inventory";
import {
  ANALYSIS_OVERNIGHT_BATCH_SIZE,
  runHeatmapAnalysisOvernight,
  type HeatmapOvernightItem,
} from "../src/lib/analysis/overnight-batch";
import { getRankings } from "../src/lib/api";
import { kstDateString } from "../src/lib/briefing/dates";
import { OVERSEAS_STOCK_BOARD_SLUG } from "../src/lib/market/stock-codes";
import {
  deliverGenerationReport,
  writeGenerationReportArtifacts,
  type GenerationReport,
} from "../src/lib/ops/generation-report";
import { formatKrw, resetGeminiUsage, snapshotGeminiUsage } from "../src/lib/ops/gemini-usage";
import { POST_CHANNELS } from "../src/lib/posts/channels";
import type { PostChannel } from "../src/lib/posts/types";

/** GitHub-hosted runners hard-cap at 6h — push cache mid-run so cancels keep articles. */
function checkpointEnabled(): boolean {
  if (process.env.ANALYSIS_CHECKPOINT === "0") return false;
  return process.env.ANALYSIS_CHECKPOINT === "1" || process.env.CI === "true";
}

function pushAnalysisCacheCheckpoint(message: string): void {
  const result = spawnSync(
    "bash",
    ["scripts/ci-checkpoint-analysis-cache.sh", message, "src/data/analysis/cache.json"],
    { stdio: "inherit", env: process.env },
  );
  if (result.status !== 0) {
    console.warn(`[checkpoint] push failed (exit ${result.status ?? "?"}) — continuing generation`);
  }
}

function buildAnalysisReport(
  editionDate: string,
  items: HeatmapOvernightItem[],
  notes: string[],
): GenerationReport {
  return {
    subject: `[KinDex] 오늘의 분석 생성 보고 · ${editionDate}`,
    editionDate,
    pipeline: "heatmap-analysis",
    generatedAt: new Date().toISOString(),
    cost: snapshotGeminiUsage(),
    sections: [
      {
        title: "오늘의 분석",
        rows: items.map((item) => ({
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
    notes,
  };
}

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
  const boardSlug = flag("board");
  const editionDate = flag("date") ?? kstDateString();
  const offset = num("offset", 0);
  const force = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry");
  const batchSize = num("batch", ANALYSIS_OVERNIGHT_BATCH_SIZE) || ANALYSIS_OVERNIGHT_BATCH_SIZE;
  resetGeminiUsage(process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash");

  const all = await listHeatmapAnalysisTargets({ channel, boardSlug });
  assertRequiredHeatmapBoards(all, { channel, boardSlug });

  const byBoard = new Map<string, number>();
  for (const target of all) {
    byBoard.set(target.boardSlug, (byBoard.get(target.boardSlug) ?? 0) + 1);
  }
  const overseasCount = byBoard.get(OVERSEAS_STOCK_BOARD_SLUG) ?? 0;
  console.log(
    `[inventory] ${all.length}건 · edition=${editionDate} · force=${force}` +
      (channel ? ` · channel=${channel}` : "") +
      (boardSlug ? ` · board=${boardSlug}` : ""),
  );
  console.log(
    `[inventory] boards=${[...byBoard.entries()]
      .map(([slug, count]) => `${slug}:${count}`)
      .join(", ")}`,
  );
  if (!boardSlug && (!channel || channel === "economy")) {
    console.log(`[inventory] 해외 주식(${OVERSEAS_STOCK_BOARD_SLUG})=${overseasCount}건`);
  }

  const limit = num("limit", all.length);
  const targets = all.slice(offset, offset + limit);
  console.log(`[run] ${targets.length}건 / 전체 ${all.length}건 (offset=${offset})`);

  if (dryRun) {
    for (const [index, target] of targets.entries()) {
      console.log(
        `  ${String(index + 1).padStart(3)}. [${target.channel}/${target.boardSlug}] ${target.entity.name} → ${target.entity.slug}`,
      );
    }
    return;
  }

  const market = await getRankings();
  const doCheckpoint = checkpointEnabled();
  if (doCheckpoint) {
    console.log(
      "[checkpoint] CI mid-run push enabled (GitHub-hosted max 6h — save articles before cancel)",
    );
  }

  let latestItems: HeatmapOvernightItem[] = [];
  const onSignal = (signal: string) => {
    console.warn(`[checkpoint] received ${signal} — pushing cache before exit`);
    try {
      void writeGenerationReportArtifacts(
        buildAnalysisReport(editionDate, latestItems, [
          `signal=${signal}`,
          "partial=true",
          `API 추정 ${formatKrw(snapshotGeminiUsage().estimatedKrw)}`,
        ]),
        `heatmap-analysis-${editionDate}`,
      );
    } catch (error) {
      console.warn("[checkpoint] partial report write failed", error);
    }
    if (doCheckpoint) {
      pushAnalysisCacheCheckpoint(
        `chore: checkpoint heatmap analysis (signal ${signal}, ${latestItems.filter((i) => i.ok && !i.skipped).length} generated)`,
      );
    }
  };
  process.once("SIGTERM", () => onSignal("SIGTERM"));
  process.once("SIGINT", () => onSignal("SIGINT"));

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
    onBatchComplete: async ({
      batchIndex,
      batchCount,
      position,
      total,
      batchItems,
      itemsSoFar,
    }) => {
      latestItems = itemsSoFar;
      const batchGenerated = batchItems.filter((item) => item.ok && !item.skipped).length;
      const generatedSoFar = itemsSoFar.filter((item) => item.ok && !item.skipped).length;
      console.log(
        `[batch ${batchIndex + 1}/${batchCount}] position=${position}/${total} batchGenerated=${batchGenerated} generatedSoFar=${generatedSoFar}`,
      );

      try {
        await writeGenerationReportArtifacts(
          buildAnalysisReport(editionDate, itemsSoFar, [
            "partial=true",
            `progress=${position}/${total}`,
            `generated=${generatedSoFar}`,
            `API 추정 ${formatKrw(snapshotGeminiUsage().estimatedKrw)}`,
          ]),
          `heatmap-analysis-${editionDate}`,
        );
      } catch (error) {
        console.warn("[checkpoint] report artifact write failed", error);
      }

      if (!doCheckpoint || batchGenerated === 0) return;
      pushAnalysisCacheCheckpoint(
        `chore: checkpoint heatmap analysis (${generatedSoFar} generated, ${position}/${total})`,
      );
    },
  });

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[done] generated=${run.generated} skipped=${run.skipped} failed=${run.failed} batches=${run.batches} geminiBatch=${run.geminiBatch} ${seconds}s`,
  );

  const overseasItems = run.items.filter((item) => item.boardSlug === OVERSEAS_STOCK_BOARD_SLUG);
  if (overseasItems.length) {
    const ok = overseasItems.filter((item) => item.ok && !item.skipped).length;
    const skip = overseasItems.filter((item) => item.skipped).length;
    const fail = overseasItems.filter((item) => !item.ok).length;
    console.log(`[overseas-stock] generated=${ok} skipped=${skip} failed=${fail}`);
  }

  const delivery = await deliverGenerationReport(
    buildAnalysisReport(editionDate, run.items, [
      `generated=${run.generated}`,
      `skipped=${run.skipped}`,
      `failed=${run.failed}`,
      `geminiBatch=${run.geminiBatch}`,
      overseasItems.length
        ? `overseas-stock=${overseasItems.filter((i) => i.ok && !i.skipped).length}/${overseasItems.length}`
        : undefined,
      `${seconds}s`,
      `API 추정 ${formatKrw(snapshotGeminiUsage().estimatedKrw)}`,
    ].filter((note): note is string => Boolean(note))),
    `heatmap-analysis-${editionDate}`,
  );
  console.log(`[report] ${delivery.detail}`);

  if (run.generated === 0 && targets.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
