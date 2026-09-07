import { KOSPI_STOCK_BOARD_SLUG } from "@/lib/market/stock-codes";
import {
  fetchNaverQuotesForNames,
  formatStockPrice,
  NAVER_FINANCE_SOURCE,
} from "@/lib/market/naver-finance";
import type { RankingEntity } from "@/lib/types";

/**
 * Attach Naver Finance last price + day change to kospi board ranks 1–10.
 * FOMO buzz score stays for tile size; quote drives displayed rate/color.
 */
export async function attachKospiStockQuotes(
  entities: RankingEntity[],
  boardSlug?: string | null,
): Promise<RankingEntity[]> {
  if (boardSlug !== KOSPI_STOCK_BOARD_SLUG || !entities.length) return entities;

  const targets = entities.filter((item) => item.rank >= 1 && item.rank <= 10);
  if (!targets.length) return entities;

  const quotes = await fetchNaverQuotesForNames(targets.map((item) => item.name));
  if (!quotes.size) return entities;

  return entities.map((entity) => {
    if (entity.rank < 1 || entity.rank > 10) return entity;
    const quote = quotes.get(entity.name);
    if (!quote) return entity;

    const metrics = entity.metrics
      ? (Object.fromEntries(
          Object.entries(entity.metrics).map(([key, metric]) => [
            key,
            { ...metric, changeRate: quote.changeRate },
          ]),
        ) as RankingEntity["metrics"])
      : entity.metrics;

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
      summary: `${entity.summary} · ${formatStockPrice(quote)} (${quote.changeRate >= 0 ? "+" : ""}${quote.changeRate.toFixed(2)}%)`.trim(),
    };
  });
}
