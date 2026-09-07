import {
  COMMODITIES_FX_BOARD_SLUG,
} from "@/lib/market/market-index-codes";
import {
  formatMarketIndexPrice,
  fetchNaverMarketIndexQuotesForNames,
  peekNaverMarketIndexQuoteForName,
} from "@/lib/market/naver-market-index";
import {
  fetchNaverQuotesForNames,
  formatStockPrice,
  NAVER_FINANCE_SOURCE,
  peekNaverQuoteForName,
} from "@/lib/market/naver-finance";
import {
  KOSPI_STOCK_BOARD_SLUG,
  OVERSEAS_STOCK_BOARD_SLUG,
} from "@/lib/market/stock-codes";
import type { RankingEntity } from "@/lib/types";

export function isKospiStockBoardSlug(slug?: string | null): boolean {
  return slug === KOSPI_STOCK_BOARD_SLUG;
}

export function isOverseasStockBoardSlug(slug?: string | null): boolean {
  return slug === OVERSEAS_STOCK_BOARD_SLUG;
}

export function isCommoditiesFxBoardSlug(slug?: string | null): boolean {
  return slug === COMMODITIES_FX_BOARD_SLUG;
}

export function isStockQuoteBoardSlug(slug?: string | null): boolean {
  return isKospiStockBoardSlug(slug) || isOverseasStockBoardSlug(slug);
}

/** 주식 / 해외 주식 / 원자재·환율 — heatmap must show Naver quotes, not KinDex scores. */
export function isMarketQuoteBoardSlug(slug?: string | null): boolean {
  return isStockQuoteBoardSlug(slug) || isCommoditiesFxBoardSlug(slug);
}

export function isKospiStockEntity(entity: Pick<RankingEntity, "slug" | "heatmapGroup">): boolean {
  return (
    entity.slug.startsWith(`${KOSPI_STOCK_BOARD_SLUG}--`) ||
    entity.heatmapGroup === "주식" ||
    entity.heatmapGroup === "증시·주요 종목"
  );
}

export function isOverseasStockEntity(
  entity: Pick<RankingEntity, "slug" | "heatmapGroup">,
): boolean {
  return (
    entity.slug.startsWith(`${OVERSEAS_STOCK_BOARD_SLUG}--`) ||
    entity.heatmapGroup === "해외 주식"
  );
}

export function isCommoditiesFxEntity(
  entity: Pick<RankingEntity, "slug" | "heatmapGroup">,
): boolean {
  return (
    entity.slug.startsWith(`${COMMODITIES_FX_BOARD_SLUG}--`) ||
    entity.heatmapGroup === "원자재·환율"
  );
}

type LiveQuote = {
  price: number;
  changeRate: number;
  unit: string;
  observedAt: string;
  priceText: string;
};

function stripQuoteSuffix(summary: string): string {
  return summary
    .replace(/\s*·\s*\$?[\d,.]+(?:원(?:\/g)?|¢)?(?:\s*\([+-]?[\d.]+%\))?/g, "")
    .replace(/\s*·\s*[\d,.]+\s+[A-Za-z/%]+(?:\s*\([+-]?[\d.]+%\))?/g, "")
    .trim();
}

/** Approximate intraday path ending at the live quote (heatmap hover / sparkline). */
function priceSparkline(price: number, changeRate: number): number[] {
  const open =
    changeRate <= -99.9 ? price : Number((price / (1 + changeRate / 100)).toFixed(6));
  const delta = price - open;
  return Array.from({ length: 12 }, (_, step) => {
    const t = step / 11;
    const wobble = Math.sin(step * 1.15) * Math.abs(delta) * 0.06;
    return Number((open + delta * t + wobble).toFixed(4));
  });
}

function withQuote(entity: RankingEntity, quote: LiveQuote): RankingEntity {
  const metrics = entity.metrics
    ? (Object.fromEntries(
        Object.entries(entity.metrics).map(([key, metric]) => [
          key,
          { ...metric, changeRate: quote.changeRate },
        ]),
      ) as RankingEntity["metrics"])
    : entity.metrics;

  const signed = `${quote.changeRate >= 0 ? "+" : ""}${quote.changeRate.toFixed(2)}%`;
  const baseSummary = stripQuoteSuffix(entity.summary);
  const spark = priceSparkline(quote.price, quote.changeRate);

  return {
    ...entity,
    fluctuationRate: quote.changeRate,
    metrics,
    sparkline: spark,
    history: spark.map((v, step) => ({ t: String(step), v })),
    measurement: {
      value: quote.price,
      unit: quote.unit,
      label: "현재가",
      source: NAVER_FINANCE_SOURCE,
      changeRate: quote.changeRate,
      observedAt: quote.observedAt,
    },
    summary: `${baseSummary || entity.summary} · ${quote.priceText} (${signed})`.trim(),
  };
}

async function attachStockQuotes(entities: RankingEntity[]): Promise<RankingEntity[]> {
  const quotes = await fetchNaverQuotesForNames(entities.map((item) => item.name));
  if (!quotes.size) return entities;

  return entities.map((entity) => {
    const quote = quotes.get(entity.name);
    if (!quote) return entity;
    return withQuote(entity, {
      price: quote.price,
      changeRate: quote.changeRate,
      unit: quote.currency === "USD" ? "USD" : "원",
      observedAt: quote.observedAt,
      priceText: formatStockPrice(quote),
    });
  });
}

async function attachMarketIndexQuotes(entities: RankingEntity[]): Promise<RankingEntity[]> {
  const quotes = await fetchNaverMarketIndexQuotesForNames(entities.map((item) => item.name));
  if (!quotes.size) return entities;

  return entities.map((entity) => {
    const quote = quotes.get(entity.name);
    if (!quote) return entity;
    return withQuote(entity, {
      price: quote.price,
      changeRate: quote.changeRate,
      unit: quote.unit === "KRW" ? "원" : quote.unit,
      observedAt: quote.observedAt,
      priceText: formatMarketIndexPrice(quote),
    });
  });
}

/**
 * Attach Naver Finance live quotes for 주식 / 해외 주식 / 원자재·환율 boards.
 * Buzz score stays for tile size; quote drives displayed rate/color.
 */
export async function attachKospiStockQuotes(
  entities: RankingEntity[],
  boardSlug?: string | null,
): Promise<RankingEntity[]> {
  if (!entities.length) return entities;

  if (isStockQuoteBoardSlug(boardSlug)) {
    return attachStockQuotes(entities);
  }
  if (isCommoditiesFxBoardSlug(boardSlug)) {
    return attachMarketIndexQuotes(entities);
  }

  // Detail / mixed payloads without an explicit board filter.
  if (boardSlug) return entities;

  const stockTargets = entities.filter(
    (entity) => isKospiStockEntity(entity) || isOverseasStockEntity(entity),
  );
  const fxTargets = entities.filter(isCommoditiesFxEntity);

  let next = entities;
  if (stockTargets.length) {
    const quoted = await attachStockQuotes(stockTargets);
    const byId = new Map(quoted.map((item) => [item.id, item]));
    next = next.map((item) => byId.get(item.id) ?? item);
  }
  if (fxTargets.length) {
    const quoted = await attachMarketIndexQuotes(fxTargets);
    const byId = new Map(quoted.map((item) => [item.id, item]));
    next = next.map((item) => byId.get(item.id) ?? item);
  }
  return next;
}

/** Detail-page helper: refresh quote for stock / FX board entities. */
export async function enrichEntityWithKospiQuote(entity: RankingEntity): Promise<RankingEntity> {
  if (isKospiStockEntity(entity)) {
    const [enriched] = await attachKospiStockQuotes([entity], KOSPI_STOCK_BOARD_SLUG);
    return enriched ?? entity;
  }
  if (isOverseasStockEntity(entity)) {
    const [enriched] = await attachKospiStockQuotes([entity], OVERSEAS_STOCK_BOARD_SLUG);
    return enriched ?? entity;
  }
  if (isCommoditiesFxEntity(entity)) {
    const [enriched] = await attachKospiStockQuotes([entity], COMMODITIES_FX_BOARD_SLUG);
    return enriched ?? entity;
  }
  return entity;
}

/**
 * Soft-nav critical path: reuse the in-process quote cache warmed by the
 * heatmap without waiting on Naver. Misses return the entity unchanged so the
 * detail shell can paint; the client hydrates the live quote afterward.
 */
export function enrichEntityWithCachedKospiQuote(entity: RankingEntity): RankingEntity {
  if (isKospiStockEntity(entity) || isOverseasStockEntity(entity)) {
    const quote = peekNaverQuoteForName(entity.name);
    if (!quote) return entity;
    return withQuote(entity, {
      price: quote.price,
      changeRate: quote.changeRate,
      unit: quote.currency === "USD" ? "USD" : "원",
      observedAt: quote.observedAt,
      priceText: formatStockPrice(quote),
    });
  }
  if (isCommoditiesFxEntity(entity)) {
    const quote = peekNaverMarketIndexQuoteForName(entity.name);
    if (!quote) return entity;
    return withQuote(entity, {
      price: quote.price,
      changeRate: quote.changeRate,
      unit: quote.unit === "KRW" ? "원" : quote.unit,
      observedAt: quote.observedAt,
      priceText: formatMarketIndexPrice(quote),
    });
  }
  return entity;
}

export function entityNeedsLiveMarketQuote(entity: RankingEntity): boolean {
  return (
    isKospiStockEntity(entity) ||
    isOverseasStockEntity(entity) ||
    isCommoditiesFxEntity(entity)
  );
}
