import { TYPE_LABEL } from "@/lib/format";
import type { EntityType } from "@/lib/types";

/** Fallback menu name when a 종합 tile has no board heatmapGroup. */
const MENU_BY_TYPE: Partial<Record<EntityType, string>> = {
  subsidy: "정부 지원금",
  local_policy: "지자체 정책",
  political_influencer: "정치 유튜브",
  political_pundit: "정치평론가",
  headline_news: "헤드라인 뉴스랭킹",
  party_support: "정당 지지도",
  politician_support: "정치인 지지도",
  political_search: "이슈 키워드",
  political_ratings: "정치뉴스 시청률",
  music_chart: "음원",
  kpop: "K POP",
  tv_rating: "TV 시청률",
  celebrity: "스타",
  pc_game: "게임",
  influencer: "유튜버",
  shorts: "숏폼",
  webtoon: "웹툰",
  movie: "영화",
  housing: "지역별 부동산",
  finance_product: "금융",
  stock_market: "주식",
  overseas_stock: "해외 주식",
  commodities_fx: "원자재·환율",
  inflation: "소비자 물가",
  startup_franchise: "창업·프랜차이즈",
  economy_issue: "이슈 키워드",
  performance: "공연",
  exhibition: "전시·팝업스토어",
  book: "도서·베스트셀러",
  health_info: "건강정보",
  recipe: "요리 레시피",
  car_review: "자동차",
  culture_issue: "이슈 키워드",
  travel_spot: "국내 여행",
  overseas_travel: "해외 여행",
  outing: "지역별 주말 나들이",
  restaurant: "지역별 음식/맛집",
};

/** Keyword-first headline for treemap tiles (about two Korean lines). */
export function summarizeHeadlineTitle(title: string, maxChars = 36): string {
  const cleaned = title.replace(/\s+/g, " ").trim();
  if (!cleaned) return title;

  const quoted = cleaned.match(/[“"'「『]([^”"'」』]{2,32})[”"'」』]/);
  if (quoted?.[1]) {
    const inner = quoted[1].trim();
    if (inner.length <= maxChars) return inner;
  }

  const clause =
    cleaned
      .split(/\s*[-–—|:…&]\s*|[?？]|,\s+/)
      .map((part) => part.trim())
      .find((part) => part.length >= 6) ?? cleaned;

  if (clause.length <= maxChars) return clause;

  const cut = clause.slice(0, maxChars);
  const breakAt = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("·"));
  return `${(breakAt >= 12 ? cut.slice(0, breakAt) : cut).trim()}`;
}

/** Compact menu label shown under #01–#10 on the 종합 treemap. */
export function formatHeatmapSourceLabel(raw?: string, fallback?: string): string | undefined {
  const label = (raw || fallback || "").trim();
  if (!label) return undefined;
  const compact = label.replace(/\s*랭킹$/, "").trim();
  return compact ? `[${compact}]` : undefined;
}

export function heatmapSourceCaption(
  entity: { heatmapGroup?: string; type: EntityType },
): string | undefined {
  return formatHeatmapSourceLabel(
    entity.heatmapGroup,
    MENU_BY_TYPE[entity.type] ?? TYPE_LABEL[entity.type],
  );
}
