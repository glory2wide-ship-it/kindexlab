import type { EntityType } from "@/lib/types";

const FAQ_TEMPLATES: Partial<Record<EntityType, string[]>> = {
  subsidy: [
    "{kw} 신청 자격은 누구인가",
    "{kw} 지급 일정과 방법",
    "{kw} 필요 서류와 확인 절차",
  ],
  political_search: [
    "{kw}가 검색 상위에 오른 배경",
    "{kw} 관련 최근 이슈",
    "{kw}와 연결된 정책·인물",
  ],
  music_chart: [
    "{kw} 차트 진입 배경",
    "{kw} 음원·무대 활동",
    "{kw} 팬 반응과 후속 일정",
  ],
  webtoon: [
    "{kw} 인기 요인",
    "{kw} 최신 회차·업데이트",
    "{kw} 비슷한 작품 추천",
  ],
  pc_game: [
    "{kw} 인기 급등 이유",
    "{kw} 업데이트·이벤트",
    "{kw} 입문 방법",
  ],
  mobile_game: [
    "{kw} 순위 상승 배경",
    "{kw} 신규 콘텐츠",
    "{kw} 초보 팁",
  ],
  shorts: [
    "{kw} 영상이 퍼진 경로",
    "{kw} 크리에이터·채널",
    "{kw} 관련 밈·후속 영상",
  ],
  tv_rating: [
    "{kw} 시청률 변동 이유",
    "{kw} 편성·출연진",
    "{kw} 다음 회 관전 포인트",
  ],
  kpop: [
    "{kw} 화제 배경",
    "{kw} 활동·일정",
    "{kw} 팬덤 반응",
  ],
  celebrity: [
    "{kw} 언급 급증 이유",
    "{kw} 최근 활동",
    "{kw} 관련 프로그램",
  ],
};

const DEFAULT_TEMPLATES = [
  "{kw}가 지금 화제인 이유",
  "{kw} 배경과 핵심 쟁점",
  "{kw} 관련 FAQ",
];

/**
 * Tier 3 — search-intent hints for FAQ questions and section planning.
 * These are structural scaffolds only; facts must come from Tier 0–2.
 */
export function buildIntentHints(input: {
  keyword: string;
  entityType?: EntityType;
  related?: string[];
}): string[] {
  const { keyword, entityType, related = [] } = input;
  const templates = (entityType && FAQ_TEMPLATES[entityType]) ?? DEFAULT_TEMPLATES;
  const hints = templates.map((template) => template.replace(/\{kw\}/g, keyword));

  for (const peer of related.slice(0, 2)) {
    hints.push(`${keyword}와 ${peer} 비교`);
  }

  return [...new Set(hints)].slice(0, 6);
}
