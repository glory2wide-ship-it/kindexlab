import { TYPE_LABEL } from "@/lib/format";
import type { EntityType } from "@/lib/types";

/** Fallback menu name when a 종합 tile has no board heatmapGroup. */
const MENU_BY_TYPE: Partial<Record<EntityType, string>> = {
  subsidy: "정부 지원금",
  local_policy: "지자체 정책지수",
  political_influencer: "정치 인기 유튜브",
  political_pundit: "정치평론가",
  headline_news: "헤드라인 뉴스랭킹",
  party_support: "정당 지지도 랭킹",
  politician_support: "정치인 지지도 랭킹",
  political_search: "이슈 키워드",
  political_ratings: "정치뉴스 시청률",
  music_chart: "실시간 음원 차트",
  kpop: "아이돌 팬덤 화력",
  tv_rating: "실시간 시청률 순위",
  celebrity: "스타 브랜드 평판",
  pc_game: "게임 e스포츠",
  influencer: "엔터 유튜버 랭킹",
  shorts: "숏폼 밈",
  webtoon: "실시간 웹툰 순위",
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
