/**
 * Relative column weights for mobile board-rail chips (first-row column template).
 * Values >1 widen the column; <1 narrow it. Desktop layout ignores this.
 * Baseline bumped ~10% with the mobile 11px tab type so labels stay inside chips.
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
};

export function mobileBoardTabWidth(slug: string): number {
  return MOBILE_BOARD_TAB_WIDTH[slug] ?? 1.1;
}
