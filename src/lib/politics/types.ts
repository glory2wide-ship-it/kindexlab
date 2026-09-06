import type { CategoryId, EntityType, MarketIndex } from "@/lib/types";

export const POLITICS_TYPE_ORDER = [
  "headline_news",
  "party_support",
  "politician_support",
  "political_pundit",
  "political_influencer",
  "political_ratings",
  "political_search",
  "local_policy",
  "subsidy",
] as const satisfies readonly EntityType[];

export type PoliticsEntityType = (typeof POLITICS_TYPE_ORDER)[number];

export const POLITICS_TYPE_SET = new Set<EntityType>(POLITICS_TYPE_ORDER);

export function isPoliticsEntityType(type: EntityType): type is PoliticsEntityType {
  return POLITICS_TYPE_SET.has(type);
}

export const POLITICS_TYPE_LABEL: Record<PoliticsEntityType, string> = {
  headline_news: "헤드라인 뉴스",
  party_support: "정당 지지도",
  politician_support: "정치인 지지도",
  political_pundit: "정치평론가",
  political_influencer: "정치 유튜브",
  political_ratings: "정치뉴스 시청률",
  political_search: "실시간 검색어",
  local_policy: "지자체 정책",
  subsidy: "정부 지원금",
};

export const POLITICS_CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "all", label: "종합" },
  ...POLITICS_TYPE_ORDER.filter((id) => id !== "headline_news").map((id) => ({
    id,
    label: POLITICS_TYPE_LABEL[id],
  })),
];

export const POLITICS_INDEX_META: { id: string; label: string; type?: EntityType; note: string }[] = [
  { id: "pol-buzz", label: "정치종합", note: "지표 합산" },
  { id: "pol-approval", label: "대통령지지도", note: "여론조사 기관 TOP 10 공표" },
  { id: "pol-party", label: "정당지수", type: "party_support", note: "정당 언급·지지도" },
  { id: "pol-politician", label: "정치인지수", type: "politician_support", note: "인물 검색·보도" },
  { id: "pol-pundit", label: "평론가지수", type: "political_pundit", note: "평론·시사 버즈" },
  { id: "pol-influencer", label: "정치유튜브지수", type: "political_influencer", note: "시사 유튜브 채널" },
  { id: "pol-ratings", label: "정치시청지수", type: "political_ratings", note: "뉴스 프로그램 시청" },
  { id: "pol-search", label: "정치검색지수", type: "political_search", note: "실시간 검색어" },
  { id: "pol-policy", label: "지자체정책지수", type: "local_policy", note: "지역 정책 화제" },
  { id: "pol-subsidy", label: "지원금지수", type: "subsidy", note: "정부 지원금 관심" },
];

export const POLITICS_INDEX_IDS = new Set(POLITICS_INDEX_META.map((item) => item.id));

export function isPoliticsIndex(index: Pick<MarketIndex, "id">): boolean {
  return POLITICS_INDEX_IDS.has(index.id);
}

export function govSupportSearchUrl(query: string): string {
  return `https://www.gov.kr/search.es?mid=a20101000000&query=${encodeURIComponent(query)}`;
}

export function bokjiroSearchUrl(query: string): string {
  return `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52005M.do?searchTerm=${encodeURIComponent(query)}`;
}
