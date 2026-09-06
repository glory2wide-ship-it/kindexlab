import {
  geminiBatchEnabled,
  briefingProvider,
} from "@/lib/analysis/chain/llm";
import type { HeatmapAnalysisTarget } from "@/lib/analysis/heatmap-inventory";
import { analysisLogger } from "@/lib/analysis/log";
import { refreshAnalysis } from "@/lib/analysis/pipeline";
import { isExpired, readAnalysis } from "@/lib/analysis/store";
import { withGeminiBatchChat } from "@/lib/gemini/batch-chat";
import { chunk, delay } from "@/lib/premium/batch";
import type { RankingsPayload } from "@/lib/types";

/** Concurrent articles per wave when Gemini Batch is on (coalesce into one job). */
export const ANALYSIS_OVERNIGHT_BATCH_SIZE = 20;
/** Live fallback: one at a time with a short pause to avoid 429s. */
export const ANALYSIS_OVERNIGHT_LIVE_SIZE = 1;
export const ANALYSIS_OVERNIGHT_LIVE_DELAY_MS = 3_000;

export interface HeatmapOvernightItem {
  slug: string;
  keyword: string;
  channel: string;
  boardSlug: string;
  ok: boolean;
  skipped?: boolean;
  kind?: string;
  chars?: number;
  newsDocs?: number;
  reason?: string;
  ms: number;
}

export interface HeatmapOvernightResult {
  total: number;
  generated: number;
  failed: number;
  skipped: number;
  batches: number;
  geminiBatch: boolean;
  items: HeatmapOvernightItem[];
}

function overnightBatchSize(): number {
  if (geminiBatchEnabled() && briefingProvider() === "gemini") {
    const parsed = Number.parseInt(
      process.env.ANALYSIS_OVERNIGHT_BATCH_SIZE ?? process.env.GEMINI_BATCH_CONCURRENCY ?? "",
      10,
    );
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return ANALYSIS_OVERNIGHT_BATCH_SIZE;
  }
  return ANALYSIS_OVERNIGHT_LIVE_SIZE;
}

/**
 * Regenerates 오늘의 분석 for heatmap inventory via Gemini Batch (−50%) when
 * GEMINI_USE_BATCH=1. Fresh TTL hits are skipped unless `force` is set.
 *
 * On-demand first-click (`getOrCreateAnalysis`) never calls this — it stays on
 * the Live chatJson path for immediate generation.
 */
export async function runHeatmapAnalysisOvernight(
  targets: HeatmapAnalysisTarget[],
  options: {
    market: RankingsPayload;
    editionDate: string;
    force?: boolean;
    batchSize?: number;
    delayMs?: number;
    onProgress?: (item: HeatmapOvernightItem, position: number, total: number) => void;
  },
): Promise<HeatmapOvernightResult> {
  const useGeminiBatch = geminiBatchEnabled() && briefingProvider() === "gemini";
  const batchSize = options.batchSize ?? overnightBatchSize();
  const delayMs = useGeminiBatch
    ? 0
    : (options.delayMs ?? ANALYSIS_OVERNIGHT_LIVE_DELAY_MS);

  const run = async (): Promise<HeatmapOvernightResult> => {
    const batches = chunk(targets, batchSize);
    const items: HeatmapOvernightItem[] = [];
    let position = 0;

    if (useGeminiBatch) {
      analysisLogger("analysis:overnight").step("gemini-batch-mode", {
        targets: targets.length,
        batchSize,
      });
    }

    for (const [batchIndex, batch] of batches.entries()) {
      const settled = await Promise.all(
        batch.map(async (target): Promise<HeatmapOvernightItem> => {
          const startedAt = Date.now();
          const base = {
            slug: target.entity.slug,
            keyword: target.entity.name,
            channel: target.channel,
            boardSlug: target.boardSlug,
          };

          if (!options.force) {
            const cached = await readAnalysis(target.entity.slug);
            // Match on-demand: never overwrite manual Gemini imports; skip warm chain hits.
            if (
              cached &&
              (cached.provenance.model?.startsWith("import:") ||
                (!isExpired(cached) && cached.provenance.kind === "chain"))
            ) {
              return {
                ...base,
                ok: true,
                skipped: true,
                kind: cached.provenance.kind,
                chars: cached.article.characterCount,
                newsDocs: cached.provenance.newsDocs,
                ms: Date.now() - startedAt,
              };
            }
          }

          try {
            const entry = await refreshAnalysis({
              entity: target.entity,
              market: options.market,
              related: target.related,
              editionDate: options.editionDate,
            });
            return {
              ...base,
              ok: true,
              kind: entry.provenance.kind,
              chars: entry.article.characterCount,
              newsDocs: entry.provenance.newsDocs,
              ms: Date.now() - startedAt,
            };
          } catch (error) {
            return {
              ...base,
              ok: false,
              reason: error instanceof Error ? error.message : "unknown",
              ms: Date.now() - startedAt,
            };
          }
        }),
      );

      for (const item of settled) {
        position += 1;
        items.push(item);
        options.onProgress?.(item, position, targets.length);
      }

      if (batchIndex < batches.length - 1 && delayMs > 0) await delay(delayMs);
    }

    return {
      total: targets.length,
      generated: items.filter((item) => item.ok && !item.skipped).length,
      failed: items.filter((item) => !item.ok).length,
      skipped: items.filter((item) => item.skipped).length,
      batches: batches.length,
      geminiBatch: useGeminiBatch,
      items,
    };
  };

  if (useGeminiBatch) return withGeminiBatchChat(run);
  return run();
}
