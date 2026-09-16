/**
 * Rebuild heatmap-analysis ops digest for /admin from:
 * 1) artifacts/generation-reports/heatmap-analysis-<date>.json (preferred)
 * 2) src/data/analysis/cache.json entries with matching editionDate
 *
 * Used after CI cancel/timeout when HTML/Issue report existed but ops/daily
 * was never written (2026-09-16 admin blackout).
 *
 *   npx tsx scripts/backfill-heatmap-ops-digest.ts --date=2026-09-16 --partial
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getBoard } from "../src/lib/boards/registry";
import { kstDateString } from "../src/lib/briefing/dates";
import type { GenerationReport } from "../src/lib/ops/generation-report";
import {
  digestFromGenerationReport,
  persistOpsDigest,
} from "../src/lib/ops/ops-digest";

function flag(name: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match?.slice(name.length + 3);
}

function boardSlugFromEntitySlug(slug: string): string {
  const idx = slug.indexOf("--");
  return idx > 0 ? slug.slice(0, idx) : slug;
}

async function main() {
  const editionDate = flag("date") ?? kstDateString();
  const partial = process.argv.includes("--partial");
  const artifactPath = path.join(
    process.cwd(),
    "artifacts",
    "generation-reports",
    `heatmap-analysis-${editionDate}.json`,
  );

  let report: GenerationReport;

  if (existsSync(artifactPath)) {
    report = JSON.parse(readFileSync(artifactPath, "utf8")) as GenerationReport;
    console.log(`[backfill] using artifact ${artifactPath}`);
  } else {
    const cachePath = path.join(process.cwd(), "src/data/analysis/cache.json");
    const cache = JSON.parse(readFileSync(cachePath, "utf8")) as {
      entries: Array<{
        slug: string;
        keyword: string;
        editionDate: string;
        generatedAt: string;
        article?: { characterCount?: number };
      }>;
    };
    const entries = (cache.entries ?? []).filter((row) => row.editionDate === editionDate);
    if (!entries.length) {
      console.error(`[backfill] no cache entries for edition=${editionDate}`);
      process.exitCode = 1;
      return;
    }
    const latest = entries
      .map((row) => row.generatedAt)
      .sort()
      .at(-1)!;
    report = {
      subject: `[KinDex] 오늘의 분석 생성 보고 · ${editionDate}`,
      editionDate,
      pipeline: "heatmap-analysis",
      generatedAt: latest,
      sections: [
        {
          title: "오늘의 분석",
          rows: entries.map((row) => {
            const boardSlug = boardSlugFromEntitySlug(row.slug);
            const channel = getBoard(boardSlug)?.channel ?? "unknown";
            const chars = row.article?.characterCount;
            return {
              name: row.keyword,
              status: "ok" as const,
              meta: `${channel}/${boardSlug}`,
              reason: chars ? `${chars}자` : undefined,
            };
          }),
        },
      ],
      notes: [
        partial ? "partial=true" : "backfill=true",
        `progress=${entries.length}/?`,
        `generated=${entries.length}`,
        "source=analysis-cache",
      ],
      cost: {
        model: "gemini-3.6-flash",
        live: {
          model: "gemini-3.6-flash",
          mode: "live",
          promptTokens: 0,
          completionTokens: 0,
          calls: 0,
        },
        batch: {
          model: "gemini-3.6-flash",
          mode: "batch",
          promptTokens: 0,
          completionTokens: 0,
          calls: entries.length,
        },
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        calls: entries.length,
        estimatedUsd: 0,
        liveUsd: 0,
        batchUsd: 0,
        estimatedKrw: 0,
        liveKrw: 0,
        batchKrw: 0,
        usdKrwRate: 1400,
        pricingNote: "Backfill from cache — token/cost unknown; admin success/fail counts are authoritative.",
      },
    };
    console.log(`[backfill] rebuilt ${entries.length} rows from cache edition=${editionDate}`);
  }

  if (partial && !(report.notes ?? []).some((note) => note.includes("partial="))) {
    report = {
      ...report,
      notes: [...(report.notes ?? []), "partial=true", "backfill=true"],
    };
  }

  const digest = digestFromGenerationReport(report, "heatmap-analysis");
  const digestPath = await persistOpsDigest(digest);
  console.log(
    `[backfill] wrote ${digestPath} ok=${digest.ok} fail=${digest.fail} skip=${digest.skip} total=${digest.total}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
