import { isHeadlineFeed, rankHeadlineFeed } from "@/lib/news/headline-rank";
import { isNaverStockMeasurement } from "@/lib/market/naver-finance-format";
import { changeForEntity, rankItemsForTimeframe, scoreForTimeframe } from "@/lib/timeframes";
import type { RankingEntity, Timeframe } from "@/lib/types";

/** Matches the heatmap default in MarketWorkspace. */
export const TICKER_TIMEFRAME: Timeframe = "5m";

export function rankForTicker(items: RankingEntity[]): RankingEntity[] {
  const safe = (items ?? []).filter((item) => item?.id && item?.name);
  if (!safe.length) return [];
  if (isHeadlineFeed(safe)) {
    return rankHeadlineFeed(safe, { timeframe: TICKER_TIMEFRAME, gender: "all", age: "all" });
  }
  return rankItemsForTimeframe(safe, TICKER_TIMEFRAME);
}

export function tickerChangeRate(entity: RankingEntity): number {
  if (isNaverStockMeasurement(entity.measurement)) {
    return entity.measurement.changeRate;
  }
  return changeForEntity(entity, TICKER_TIMEFRAME);
}

export function tickerBuzzScore(entity: RankingEntity): number {
  return scoreForTimeframe(entity, TICKER_TIMEFRAME);
}
