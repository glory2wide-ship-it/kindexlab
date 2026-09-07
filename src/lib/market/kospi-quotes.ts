import { KOSPI_STOCK_BOARD_SLUG } from "@/lib/market/stock-codes";
import {
  fetchNaverQuotesForNames,
  formatStockPrice,
  NAVER_FINANCE_SOURCE,
} from "@/lib/market/naver-finance";
import type { RankingEntity } from "@/lib/types";

export function isKospiStockBoardSlug(slug?: string | null): boolean {
  return slug === KOSPI_STOCK_BOARD_SLUG;
}

export function isKospiStockEntity(entity: Pick<RankingEntity, "slug" | "heatmapGroup">): boolean {
  return (
    entity.slug.startsWith(`${KOSPI_STOCK_BOARD_SLUG}--`) ||
    entity.heatmapGroup === "주식" ||
    entity.heatmapGroup === "증시·주요 종목"
  );
}

function withQuote(entity: RankingEntity, quote: {
  price: number;
  changeRate: number;
  currency: "KRW" | "USD";
  observedAt: string;
}): RankingEntity {
  const metrics = entity.metrics
    ? (Object.fromEntries(
        Object.entries(entity.metrics).map(([key, metric]) => [
          key,
          { ...metric, changeRate: quote.changeRate },
        ]),
      ) as RankingEntity["metrics"])
    : entity.metrics;

  const signed = `${quote.changeRate >= 0 ? "+" : ""}${quote.changeRate.toFixed(2)}%`;
  const priceText = formatStockPrice(quote);
  const baseSummary = entity.summary.replace(/\s*·\s*[\d,.]+원(?:\s*\([+-]?[\d.]+%\))?/g, "").trim();

  return {
    ...entity,
    fluctuationRate: quote.changeRate,
    metrics,
    measurement: {
      value: quote.price,
      unit: quote.currency === "USD" ? "USD" : "원",
      label: "현재가",
      source: NAVER_FINANCE_SOURCE,
      changeRate: quote.changeRate,
      observedAt: quote.observedAt,
    },
    summary: `${baseSummary || entity.summary} · ${priceText} (${signed})`.trim(),
  };
}

/**
 * Attach Naver Finance last price + day change to every mapped kospi-board tile.
 * FOMO buzz score stays for tile size; quote drives displayed rate/color.
 */
export async function attachKospiStockQuotes(
  entities: RankingEntity[],
  boardSlug?: string | null,
): Promise<RankingEntity[]> {
  if (!entities.length) return entities;
  if (boardSlug && !isKospiStockBoardSlug(boardSlug)) return entities;

  const targets = isKospiStockBoardSlug(boardSlug)
    ? entities
    : entities.filter(isKospiStockEntity);
  if (!targets.length) return entities;

  const quotes = await fetchNaverQuotesForNames(targets.map((item) => item.name));
  if (!quotes.size) return entities;

  return entities.map((entity) => {
    const quote = quotes.get(entity.name);
    if (!quote) return entity;
    if (!isKospiStockBoardSlug(boardSlug) && !isKospiStockEntity(entity)) return entity;
    return withQuote(entity, quote);
  });
}

/** Detail-page helper: refresh quote for one kospi-board entity. */
export async function enrichEntityWithKospiQuote(entity: RankingEntity): Promise<RankingEntity> {
  if (!isKospiStockEntity(entity)) return entity;
  const [enriched] = await attachKospiStockQuotes([entity], KOSPI_STOCK_BOARD_SLUG);
  return enriched ?? entity;
}
