import { isNaverStockMeasurement, formatNaverMeasurement } from "@/lib/market/naver-finance-format";
import { KOSPI_STOCK_BOARD_SLUG, OVERSEAS_STOCK_BOARD_SLUG, stockSymbolForName } from "@/lib/market/stock-codes";
import { COMMODITIES_FX_BOARD_SLUG } from "@/lib/market/market-index-codes";
import type { RankingEntity, Timeframe } from "@/lib/types";
import { changeForEntity } from "@/lib/timeframes";

function isMarketQuoteEntity(entity: RankingEntity): boolean {
  if (isNaverStockMeasurement(entity.measurement)) return true;
  if (stockSymbolForName(entity.name)) return true;
  const slug = entity.slug ?? "";
  return (
    slug.startsWith(KOSPI_STOCK_BOARD_SLUG) ||
    slug.startsWith(OVERSEAS_STOCK_BOARD_SLUG) ||
    slug.startsWith(COMMODITIES_FX_BOARD_SLUG) ||
    entity.heatmapGroup === "주식" ||
    entity.heatmapGroup === "해외 주식" ||
    entity.heatmapGroup === "원자재·환율"
  );
}

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

/** Show Naver ±% beside rank for quoted market tiles through desktop top-20. */
export function heatmapShowHeaderRate(
  entity: RankingEntity,
  rank: number,
  width: number,
  height: number,
): boolean {
  if (width < 56 || height < 28) return false;
  if (isNaverStockMeasurement(entity.measurement) || isMarketQuoteEntity(entity)) {
    return rank <= 20;
  }
  return rank < 10;
}
