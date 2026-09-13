/**
 * Relative column weights for mobile board-rail chips (first-row column template).
 * Values >1 widen the column; <1 narrow it. Desktop layout ignores this.
 * Baseline bumped ~10% with the mobile 12.1px tab type so labels stay inside chips.
 */
export const MOBILE_BOARD_TAB_WIDTH: Record<string, number> = {
  // Entertainment
  "culture-leisure-grant-ranking": 1.34, // 정부지원금
  "kpop-fandom-power": 1.12, // K POP
  "trot-kayo-fandom-power": 1.3, // 트로트·가요
  "realtime-music-chart": 0.9, // 음원
  "star-reputation-index": 0.95, // 스타
  "boxoffice-expectation": 0.95, // 영화
  "realtime-tv-ratings": 1.15, // TV 시청률
  "game-esports-ranking": 0.95, // 게임
  "entertain-youtuber-ranking": 1.0, // 유튜버
  "realtime-webtoon-rank": 0.95, // 웹툰
  // Culture
  "performance-ticket-ranking": 0.9, // 공연
  "exhibition-popup-ranking": 0.9, // 전시 팝업
  "bestseller-surge-index": 1.54, // 도서·베스트셀러
  // Economy — startup chip +10% vs default 1.1; all economy weights ×1.1 via caller scale
  "startup-franchise-index": 1.21, // 창업/소상공
};

/** Economy rail chips are 10% wider on mobile (column weights ×1.1). */
export const ECONOMY_MOBILE_TAB_WIDTH_SCALE = 1.1;

/** Economy mobile channel chips that should render 10% narrower boxes. */
export const ECONOMY_MOBILE_NARROW_TAB_SLUGS: ReadonlySet<string> = new Set([
  "composite", // 종합
  "rates-finance-products", // 금융
  "kospi-fomo-index", // 주식
]);

/** Economy mobile channel chips that should render 15% wider columns. */
export const ECONOMY_MOBILE_WIDE_TAB_SLUGS: ReadonlySet<string> = new Set([
  "overseas-stock-index", // 해외 주식
]);

/**
 * Economy mobile chips that need another +15% on top of the wide scale
 * so long labels keep a little padding inside the box.
 */
export const ECONOMY_MOBILE_EXTRA_WIDE_TAB_SLUGS: ReadonlySet<string> = new Set([
  "commodities-fx-index", // 원자재·환율
  "inflation-sentiment-index", // 소비자 물가
  "startup-franchise-index", // 창업/소상공
]);

export function mobileBoardTabWidth(slug: string, channel?: string): number {
  let base = MOBILE_BOARD_TAB_WIDTH[slug] ?? 1.1;
  if (channel !== "economy") return base;
  base *= ECONOMY_MOBILE_TAB_WIDTH_SCALE;
  if (ECONOMY_MOBILE_WIDE_TAB_SLUGS.has(slug)) base *= 1.15;
  if (ECONOMY_MOBILE_EXTRA_WIDE_TAB_SLUGS.has(slug)) base *= 1.15 * 1.15;
  return base;
}

export function isEconomyMobileNarrowTab(slug: string, channel?: string): boolean {
  return channel === "economy" && ECONOMY_MOBILE_NARROW_TAB_SLUGS.has(slug);
}
