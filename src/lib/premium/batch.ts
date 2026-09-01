import { analysisLogger } from "@/lib/analysis/log";
import { generatePremiumArticle, type PremiumFailure } from "@/lib/premium/generate";
import type { PremiumTarget } from "@/lib/premium/keywords";
import { persistPremiumArticle } from "@/lib/premium/persist";
import { getRankings } from "@/lib/providers/trends";

/** Five per batch, per the rebuild contract: small enough to stay inside a
 *  serverless invocation and gentle enough on the OpenAI rate limit. */
export const PREMIUM_BATCH_SIZE = 5;
/** Cooldown between batches. Rate limits are per-minute, so a short pause
 *  between bursts is far cheaper than a 429 retry storm. */
export const PREMIUM_BATCH_DELAY_MS = 2_000;

export interface PremiumRunItem {
  keyword: string;
  slug: string;
  channel: string;
  ok: boolean;
  chars?: number;
  sources?: number;
  reason?: PremiumFailure;
  detail?: string;
  ms: number;
}

export interface PremiumRunResult {
  total: number;
  generated: number;
  failed: number;
  batches: number;
  items: PremiumRunItem[];
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

/**
 * Runs the premium generator across every target, five at a time.
 *
 * Batches run sequentially and the members of a batch run concurrently: the
 * bottleneck is OpenAI latency, not local work, so serialising inside a batch
 * would multiply wall clock without reducing request rate.
 */
export async function runPremiumRebuild(
  targets: PremiumTarget[],
  options: {
    editionDate?: string;
    batchSize?: number;
    delayMs?: number;
    timeoutMs?: number;
    onProgress?: (item: PremiumRunItem, position: number, total: number) => void;
  } = {},
): Promise<PremiumRunResult> {
  const batchSize = options.batchSize ?? PREMIUM_BATCH_SIZE;
  const delayMs = options.delayMs ?? PREMIUM_BATCH_DELAY_MS;
  const batches = chunk(targets, batchSize);
  const items: PremiumRunItem[] = [];
  let position = 0;
  const market = await getRankings();

  for (const [batchIndex, batch] of batches.entries()) {
    const settled = await Promise.all(
      batch.map(async (target): Promise<PremiumRunItem> => {
        const startedAt = Date.now();
        const logger = analysisLogger(`premium:${target.keyword}`);
        const entity = market.items.find((item) => item.slug === target.slug);
        const relatedEntities = entity
          ? market.items.filter((item) => item.type === entity.type && item.slug !== entity.slug).slice(0, 4)
          : [];
        try {
          const result = await generatePremiumArticle({
            keyword: target.keyword,
            slug: target.slug,
            category: target.category,
            related: target.related,
            entity,
            relatedEntities,
            logger,
            timeoutMs: options.timeoutMs,
          });

          if (!result.ok) {
            return {
              keyword: target.keyword,
              slug: target.slug,
              channel: target.channel,
              ok: false,
              reason: result.reason,
              detail: result.detail,
              ms: Date.now() - startedAt,
            };
          }

          await persistPremiumArticle(result.article, {
            channel: target.channel,
            editionDate: options.editionDate,
          });

          return {
            keyword: target.keyword,
            slug: target.slug,
            channel: target.channel,
            ok: true,
            chars: result.article.characterCount,
            sources: result.article.sources.length,
            ms: Date.now() - startedAt,
          };
        } catch (error) {
          return {
            keyword: target.keyword,
            slug: target.slug,
            channel: target.channel,
            ok: false,
            reason: "malformed",
            detail: error instanceof Error ? error.message : "unknown",
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
    generated: items.filter((item) => item.ok).length,
    failed: items.filter((item) => !item.ok).length,
    batches: batches.length,
    items,
  };
}
