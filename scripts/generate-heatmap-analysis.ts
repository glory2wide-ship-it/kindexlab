/**
 * Overnight 오늘의 분석 for every heatmap menu tile.
 *
 * Uses Gemini Batch (−50%) when GEMINI_USE_BATCH=1. Fresh TTL hits are skipped
 * unless --force. First-click detail pages stay on Live API (see pipeline.ts).
 *
 * Usage:
 *   npx tsx scripts/generate-heatmap-analysis.ts
 *   npx tsx scripts/generate-heatmap-analysis.ts --channel=economy --limit=10
 *   npx tsx scripts/generate-heatmap-analysis.ts --board=overseas-stock-index
 *   npx tsx scripts/generate-heatmap-analysis.ts --force --dry
 */
import {
  assertRequiredHeatmapBoards,
  listHeatmapAnalysisTargets,
} from "../src/lib/analysis/heatmap-inventory";
import {
  ANALYSIS_OVERNIGHT_BATCH_SIZE,
  runHeatmapAnalysisOvernight,
} from "../src/lib/analysis/overnight-batch";
import { kstDateString } from "../src/lib/briefing/dates";
import { getRankings } from "../src/lib/api";
import { OVERSEAS_STOCK_BOARD_SLUG } from "../src/lib/market/stock-codes";
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
  const boardSlug = flag("board");
  const editionDate = flag("date") ?? kstDateString();
  const offset = num("offset", 0);
  const force = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry");
  const batchSize = num("batch", ANALYSIS_OVERNIGHT_BATCH_SIZE) || ANALYSIS_OVERNIGHT_BATCH_SIZE;
  resetGeminiUsage(process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash");

  const focusEnabled =
    process.argv.includes("--focus") || process.env.ANALYSIS_FOCUS === "1";

  // If focus asks for 지역사랑상품권, ensure it is on the economy board first
  // (board cache is gitignored, so CI must inject at runtime).
  if (focusEnabled) {
    try {
      const { readFile } = await import("node:fs/promises");
      const path = await import("node:path");
      const { spawnSync } = await import("node:child_process");
      const focusFile = path.join(process.cwd(), "scripts", ".analysis-focus");
      const line = (await readFile(focusFile, "utf8")).trim().split("\n")[0]?.trim() ?? "";
      if (line.includes("지역사랑상품권")) {
        const viaNpx = spawnSync("npx", ["tsx", "scripts/inject-local-love-voucher-board.ts"], {
          stdio: "inherit",
          env: process.env,
        });
        if (viaNpx.status !== 0) throw new Error("inject-local-love-voucher-board failed");
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("inject-local-love")) throw error;
    }
  }

  const all = await listHeatmapAnalysisTargets({ channel, boardSlug });
  assertRequiredHeatmapBoards(all, { channel, boardSlug });

  // Optional one-off focus (safe for overnight cron — requires --focus or ANALYSIS_FOCUS=1):
  // scripts/.analysis-focus → government-subsidy-search|지역사랑상품권
  let focused = all;
  if (focusEnabled) {
    try {
      const { readFile } = await import("node:fs/promises");
      const path = await import("node:path");
      const focusFile = path.join(process.cwd(), "scripts", ".analysis-focus");
      const line = (await readFile(focusFile, "utf8")).trim().split("\n")[0]?.trim();
      if (line && !line.startsWith("#")) {
        const [focusBoard, focusName] = line.split("|").map((part) => part.trim());
        focused = all.filter((target) => {
          const boardOk = !focusBoard || target.boardSlug === focusBoard;
          const nameOk = !focusName || target.entity.name.includes(focusName);
          return boardOk && nameOk;
        });
        console.log(`[focus] ${line} → ${focused.length} target(s)`);
      }
    } catch {
      // no focus file
    }
  }

  const byBoard = new Map<string, number>();
  for (const target of focused) {
    byBoard.set(target.boardSlug, (byBoard.get(target.boardSlug) ?? 0) + 1);
  }
  const overseasCount = byBoard.get(OVERSEAS_STOCK_BOARD_SLUG) ?? 0;
  console.log(
    `[inventory] ${focused.length}건 · edition=${editionDate} · force=${force}` +
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

  const limit = num("limit", focused.length);
  const targets = focused.slice(offset, offset + limit);

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

  const overseasItems = run.items.filter((item) => item.boardSlug === OVERSEAS_STOCK_BOARD_SLUG);
  if (overseasItems.length) {
    const ok = overseasItems.filter((item) => item.ok && !item.skipped).length;
    const skip = overseasItems.filter((item) => item.skipped).length;
    const fail = overseasItems.filter((item) => !item.ok).length;
    console.log(`[overseas-stock] generated=${ok} skipped=${skip} failed=${fail}`);
  }

  const delivery = await deliverGenerationReport(
    {
      subject: `[KinDex] 오늘의 분석 생성 보고 · ${editionDate}`,
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
        overseasItems.length
          ? `overseas-stock=${overseasItems.filter((i) => i.ok && !i.skipped).length}/${overseasItems.length}`
          : undefined,
        `${seconds}s`,
        `API 추정 ${formatKrw(snapshotGeminiUsage().estimatedKrw)}`,
      ].filter((note): note is string => Boolean(note)),
    },
    `heatmap-analysis-${editionDate}`,
  );
  console.log(`[report] ${delivery.detail}`);

  // Partial misses are expected on some nights; report them by email/issue
  // without failing the whole workflow. Hard failure stays reserved for
  // zero-output / thrown runs handled by the top-level catch.
  if (run.generated === 0 && targets.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
