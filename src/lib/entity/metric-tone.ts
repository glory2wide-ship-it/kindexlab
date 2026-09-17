import { isNaverStockMeasurement } from "@/lib/market/naver-finance-format";
import type { RankingEntity } from "@/lib/types";

/**
 * Detail-hero metric tone: rise = green (`text-up`), fall = red (`text-down`).
 *
 * Follows the published index direction — never rank-number deltas alone
 * (rank can worsen while the index rises). Avoids synthetic timeframe jitter
 * so hero colors stay aligned with fluctuationRate / open→current score.
 */
export function entityMetricChangeRate(entity: RankingEntity): number {
  if (isNaverStockMeasurement(entity.measurement)) {
    return entity.measurement.changeRate;
  }

  if (Number.isFinite(entity.fluctuationRate) && entity.fluctuationRate !== 0) {
    return entity.fluctuationRate;
  }

  const live5m = entity.metrics?.["5m"]?.changeRate;
  if (Number.isFinite(live5m) && (live5m as number) !== 0) {
    return live5m as number;
  }

  // Flat stored rate: fall back to open→current score gap (KinDex 시가 방향).
  if (Number.isFinite(entity.buzzScore) && Number.isFinite(entity.openScore)) {
    const delta = entity.buzzScore - entity.openScore;
    if (delta !== 0) return delta;
  }
  return 0;
}

export function entityMetricTone(entity: RankingEntity): "text-up" | "text-down" | "text-muted" {
  const rate = entityMetricChangeRate(entity);
  if (rate > 0) return "text-up";
  if (rate < 0) return "text-down";
  return "text-muted";
}
