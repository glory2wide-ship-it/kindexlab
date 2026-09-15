import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity, Timeframe } from "@/lib/types";

/**
 * Landing heatmap defaults — safe for client + server imports (no node:fs).
 * Match MarketWorkspace desktop options: 5분봉 · 성별 전체 · 연령 전체.
 */
export const LANDING_HEATMAP_TIMEFRAME: Timeframe = "5m";
/** Top N per category under those defaults (5 channels × 4 = 20 tiles). */
export const LANDING_PER_CHANNEL_TOP = 4;
/**
 * Rows on each landing desk card — must match heatmap per-channel top
 * (methodology: 카테고리별 1~4위). Do not set lower than LANDING_PER_CHANNEL_TOP.
 */
export const DESK_TOP_N = LANDING_PER_CHANNEL_TOP;

/** Desk card on the landing category grid (client-safe type). */
export interface ChannelDesk {
  channel: PostChannel;
  label: string;
  href: string;
  eyebrow: string;
  top: RankingEntity[];
}

export interface UnifiedMarket {
  /** Cross-category tiles for the landing heatmap, already capped and re-ranked. */
  items: RankingEntity[];
  desks: ChannelDesk[];
}
