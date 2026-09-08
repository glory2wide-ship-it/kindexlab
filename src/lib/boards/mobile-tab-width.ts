/**
 * Relative column weights for mobile board-rail chips (first-row column template).
 * Values >1 widen the column; <1 narrow it. Desktop layout ignores this.
 */
export const MOBILE_BOARD_TAB_WIDTH: Record<string, number> = {
  // Entertainment
  "culture-leisure-grant-ranking": 1.22, // 정부지원금 ↑
  "trot-kayo-fandom-power": 1.18, // 트로트·가요 ↑
  "realtime-music-chart": 0.78, // 음원 ↓
  // Culture
  "performance-ticket-ranking": 0.82, // 공연 ↓
  "exhibition-popup-ranking": 0.82, // 전시 팝업 ↓
  "bestseller-surge-index": 1.4, // 도서·베스트셀러 ↑
};

export function mobileBoardTabWidth(slug: string): number {
  return MOBILE_BOARD_TAB_WIDTH[slug] ?? 1;
}
