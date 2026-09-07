import { isNaverStockMeasurement, formatNaverMeasurement } from "@/lib/market/naver-finance-format";
import type { RankingEntity, Timeframe } from "@/lib/types";
import { changeForEntity } from "@/lib/timeframes";

/** Prefer Naver day-change when a live finance quote is attached. */
export function heatmapChangeRate(entity: RankingEntity, timeframe: Timeframe): number {
  if (isNaverStockMeasurement(entity.measurement)) {
    return entity.measurement.changeRate;
  }
  return changeForEntity(entity, timeframe);
}

export function heatmapPriceLabel(entity: RankingEntity): string | undefined {
  if (!isNaverStockMeasurement(entity.measurement)) return undefined;
  return formatNaverMeasurement(entity.measurement);
}
