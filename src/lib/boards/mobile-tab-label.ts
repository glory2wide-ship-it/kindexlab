/**
 * Mobile-only short labels for board rail chips.
 * Desktop keeps `shortTitle` / "종합 랭킹" unchanged.
 */
const MOBILE_BOARD_TAB_LABEL: Record<string, string> = {
  // Entertainment shares culture grant in the rail
  "culture-leisure-grant-ranking": "정부지원금",
  // Economy
  "government-subsidy-search": "정부지원금",
  "housing-subscription-hotspot": "부동산",
  "startup-franchise-index": "창업",
  // Culture
  "exhibition-popup-ranking": "전시 팝업",
  // Politics
  "policy-controversy-index": "핫 키워드",
};

/** Fallback by exact shortTitle when slug map misses (shared/alias titles). */
const MOBILE_BY_SHORT_TITLE: Record<string, string> = {
  "문화/생활 정부 지원금": "정부지원금",
  "문화/생활 정부지원금": "정부지원금",
  "경제 정부지원금": "정부지원금",
  "여행 정부지원금": "정부지원금",
  "지역별 부동산": "부동산",
  "창업·프랜차이즈": "창업",
  "전시·팝업스토어": "전시 팝업",
};

export function mobileBoardTabLabel(slug: string, shortTitle: string): string {
  return MOBILE_BOARD_TAB_LABEL[slug] ?? MOBILE_BY_SHORT_TITLE[shortTitle] ?? shortTitle;
}

export const MOBILE_COMPOSITE_TAB_LABEL = "종합";
