import {
  geminiBatchEnabled,
  briefingProvider,
} from "@/lib/analysis/chain/llm";
import {
  shouldRefreshAnalysis,
  type AnalysisRewriteMode,
} from "@/lib/analysis/generation-policy";
import type { HeatmapAnalysisTarget } from "@/lib/analysis/heatmap-inventory";
import { analysisLogger } from "@/lib/analysis/log";
import { refreshAnalysis } from "@/lib/analysis/pipeline";
import { readAnalysis } from "@/lib/analysis/store";
import {
  isAnalysisReentry,
  mergeTopNMembership,
  readTopNMembership,
  writeTopNMembership,
} from "@/lib/analysis/topn-membership";
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
  rewriteMode?: AnalysisRewriteMode | "full" | "incremental";
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
 * Regenerates 오늘의 분석 for Top-N heatmap inventory via Gemini Batch (−50%)
 * when GEMINI_USE_BATCH=1.
 *
 * Skip / refresh policy (not raw TTL alone):
 * - Within 2-day cycle → skip (unless force / re-entry / 7-day full rewrite)
 * - Re-entry into Top-N → refresh immediately (full)
 * - Every 7 days by lastFullRewriteAt → full rewrite
 * - Generation failure → keep previous Gemini column (no wipe)
 * - Rank drop → simply absent from inventory; detail page keeps prior column
 *
 * On-demand first-click (`getOrCreateAnalysis`) never calls this — Live path.
 */
export async function runHeatmapAnalysisOvernight(
  targets: HeatmapAnalysisTarget[],
  options: {
    market: RankingsPayload;
    editionDate: string;
    force?: boolean;
    batchSize?: number;
    delayMs?: number;
    /** When set, membership merge is scoped to this channel/board. */
    channel?: string;
    boardSlug?: string;
    onProgress?: (item: HeatmapOvernightItem, position: number, total: number) => void;
    onBatchComplete?: (info: {
      batchIndex: number;
      batchCount: number;
      position: number;
      total: number;
      batchItems: HeatmapOvernightItem[];
      itemsSoFar: HeatmapOvernightItem[];
    }) => void | Promise<void>;
  },
): Promise<HeatmapOvernightResult> {
  const useGeminiBatch = geminiBatchEnabled() && briefingProvider() === "gemini";
  const batchSize = options.batchSize ?? overnightBatchSize();
  const delayMs = useGeminiBatch
    ? 0
    : (options.delayMs ?? ANALYSIS_OVERNIGHT_LIVE_DELAY_MS);

  const previousMembership = await readTopNMembership();

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

          const cached = await readAnalysis(target.entity.slug);
          const reentry = isAnalysisReentry(previousMembership, target.entity.slug);
          const decision = shouldRefreshAnalysis(cached, {
            force: options.force,
            isReentry: reentry,
          });

          if (!decision.refresh) {
            return {
              ...base,
              ok: true,
              skipped: true,
              kind: cached?.provenance.kind,
              chars: cached?.article.characterCount,
              newsDocs: cached?.provenance.newsDocs,
              reason: decision.reason,
              rewriteMode: decision.mode,
              ms: Date.now() - startedAt,
            };
          }

          // Manual Gemini imports: never overwrite unless --force.
          if (
            !options.force &&
            cached?.provenance.model?.startsWith("import:")
          ) {
            return {
              ...base,
              ok: true,
              skipped: true,
              kind: cached.provenance.kind,
              chars: cached.article.characterCount,
              newsDocs: cached.provenance.newsDocs,
              reason: "import_locked",
              ms: Date.now() - startedAt,
            };
          }

          try {
            const entry = await refreshAnalysis({
              entity: target.entity,
              market: options.market,
              related: target.related,
              editionDate: options.editionDate,
              boardSlug: target.boardSlug,
              rewriteMode: decision.mode,
              previous: cached ?? null,
            });
            return {
              ...base,
              ok: true,
              kind: entry.provenance.kind,
              chars: entry.article.characterCount,
              newsDocs: entry.provenance.newsDocs,
              reason: decision.reason,
              rewriteMode: decision.mode,
              ms: Date.now() - startedAt,
            };
          } catch (error) {
            // Keep the previous Gemini column — never wipe on failure.
            return {
              ...base,
              ok: false,
              reason: error instanceof Error ? error.message : "unknown",
              rewriteMode: decision.mode,
              chars: cached?.article.characterCount,
              newsDocs: cached?.provenance.newsDocs,
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

      await options.onBatchComplete?.({
        batchIndex,
        batchCount: batches.length,
        position,
        total: targets.length,
        batchItems: settled,
        itemsSoFar: items.slice(),
      });

      if (batchIndex < batches.length - 1 && delayMs > 0) await delay(delayMs);
    }

    const nextMembership = mergeTopNMembership(previousMembership, targets, {
      channel: options.channel,
      boardSlug: options.boardSlug,
    });
    await writeTopNMembership(nextMembership);

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
