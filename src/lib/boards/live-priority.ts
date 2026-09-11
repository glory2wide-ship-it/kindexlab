import type { EntityType } from "@/lib/types";

/**
 * Painted heatmap tiles (desktop treemap). Live-head metrics and seed padding
 * gates use this screen cap — not the board storage limit of 30.
 */
export const HEATMAP_SCREEN_LIVE_CAP = 20;

/**
 * Boards that own a native API/crawl chart (Melon, Naver Webtoon, KOBIS,
 * Nielsen, game stores). Category-live news must never displace these heads.
 */
export const NATIVE_CHART_BOARD_SLUGS = new Set([
  "realtime-music-chart",
  "realtime-webtoon-rank",
  "boxoffice-expectation",
  "realtime-tv-ratings",
  "game-esports-ranking",
]);

/** Entity types emitted by native chart ingest (`compose.toEntity`). */
export const NATIVE_CHART_ENTITY_TYPES = new Set<EntityType>([
  "music_chart",
  "webtoon",
  "movie",
  "tv_rating",
  "tv_show",
  "mobile_game",
  "pc_game",
  "console_game",
  "kpop",
  "trot",
]);

/** Thin boards that need denser category-live queries. */
export const THIN_LIVE_BOARD_SLUGS = new Set([
  "recipe-ranking",
  "star-reputation-index",
  "overseas-travel-ranking",
  "governor-approval-index",
  "startup-franchise-index",
  "trot-kayo-fandom-power",
  "party-support-chart",
  "political-pundit-ranking",
  "housing-subscription-hotspot",
  "rates-finance-products",
  "kospi-fomo-index",
  "economy-issue-keywords",
  "health-info-ranking",
  "car-review-ranking",
  "culture-issue-keywords",
  "performance-ticket-ranking",
  "exhibition-popup-ranking",
]);

/** Economy/culture menus also crawl denser even when not in the thin set. */
export function needsDenseLiveCrawl(channel: string, slug: string): boolean {
  if (THIN_LIVE_BOARD_SLUGS.has(slug)) return true;
  if (channel === "economy" || channel === "culture") return true;
  return false;
}

export function isNativeChartBoard(slug: string): boolean {
  return NATIVE_CHART_BOARD_SLUGS.has(slug);
}

export function isNativeChartEntityType(type: string): boolean {
  return NATIVE_CHART_ENTITY_TYPES.has(type as EntityType);
}

export function isThinLiveBoard(slug: string): boolean {
  return THIN_LIVE_BOARD_SLUGS.has(slug);
}

/** True when a row should count as crawl/API live for screen-20 / preferLive. */
export function isLivePreferEntity(item: {
  type?: string;
  tags?: string[] | null;
}): boolean {
  if (item.tags?.includes("board-tape")) return false;
  if (item.tags?.includes("live-chart")) return true;
  if (item.type && isNativeChartEntityType(item.type)) return true;
  return false;
}

/** Count of live-led tiles in the painted screen head (default top 20). */
export function countScreenLiveLead(
  items: { type?: string; tags?: string[] | null }[],
  screenCap = HEATMAP_SCREEN_LIVE_CAP,
): number {
  return items.slice(0, screenCap).filter(isLivePreferEntity).length;
}
