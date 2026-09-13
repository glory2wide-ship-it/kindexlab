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
  // 주식: keep full cell width so +20% inset padding can clear the border.
]);

/** Economy mobile channel chips that should render 15% wider columns. */
export const ECONOMY_MOBILE_WIDE_TAB_SLUGS: ReadonlySet<string> = new Set([
  "overseas-stock-index", // 해외 주식
]);

/**
 * Economy mobile chips that need extra column width so long labels keep
 * inset padding inside the box (base wide ×1.15, then +15%, then +20%, then ×2 pad room).
 */
export const ECONOMY_MOBILE_EXTRA_WIDE_TAB_SLUGS: ReadonlySet<string> = new Set([
  "commodities-fx-index", // 원자재·환율
  "inflation-sentiment-index", // 소비자 물가
  "startup-franchise-index", // 창업/소상공
]);

/** Long economy labels that get boosted mobile inner padding (incl. 해외 주식). */
export const ECONOMY_MOBILE_PADDED_TAB_SLUGS: ReadonlySet<string> = new Set([
  ...ECONOMY_MOBILE_WIDE_TAB_SLUGS,
  ...ECONOMY_MOBILE_EXTRA_WIDE_TAB_SLUGS,
]);

/**
 * Mobile horizontal padding for long economy labels (해외 주식 등).
 * 21.6px (=17.28+25%) so 해/식 clear the chip border.
 * Column weights below must leave room inside the 2-row grid.
 */
export const ECONOMY_MOBILE_PADDED_TAB_PX = "economy-chip-pad-wide max-md:!px-[21.6px]";

/**
 * Mobile horizontal padding for short stock chip (주식).
 * Prior 7.2px +20% → 8.64px.
 * Also tagged with a globals.css class so the inset survives Tailwind purge.
 */
export const ECONOMY_MOBILE_STOCK_TAB_SLUG = "kospi-fomo-index";
export const ECONOMY_MOBILE_STOCK_TAB_PX = "economy-chip-pad-stock max-md:!px-[8.64px]";

export function mobileBoardTabWidth(slug: string, channel?: string): number {
  let base = MOBILE_BOARD_TAB_WIDTH[slug] ?? 1.1;
  if (channel !== "economy") return base;
  base *= ECONOMY_MOBILE_TAB_WIDTH_SCALE;
  // 해외 주식: widen enough for +25% inner padding inside the 2-row grid cell.
  if (ECONOMY_MOBILE_WIDE_TAB_SLUGS.has(slug)) base *= 1.15 * 1.2 * 1.2 * 1.25 * 1.25;
  // 원자재·환율 / 소비자 물가 / 창업/소상공: prior boosts + room for padding.
  if (ECONOMY_MOBILE_EXTRA_WIDE_TAB_SLUGS.has(slug)) base *= 1.15 * 1.15 * 1.2 * 1.2 * 1.2 * 1.15;
  // 주식: give the chip more column so +20% pad does not clip.
  if (slug === ECONOMY_MOBILE_STOCK_TAB_SLUG) base *= 1.25 * 1.2;
  return base;
}

export function isEconomyMobileNarrowTab(slug: string, channel?: string): boolean {
  return channel === "economy" && ECONOMY_MOBILE_NARROW_TAB_SLUGS.has(slug);
}

export function isEconomyMobilePaddedTab(slug: string, channel?: string): boolean {
  return channel === "economy" && ECONOMY_MOBILE_PADDED_TAB_SLUGS.has(slug);
}

export function isEconomyMobileStockTab(slug: string, channel?: string): boolean {
  return channel === "economy" && slug === ECONOMY_MOBILE_STOCK_TAB_SLUG;
}
