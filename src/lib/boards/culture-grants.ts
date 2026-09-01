import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import type { BoardRankEntry } from "@/lib/boards/types";
import { formatBracketLabel, parseBracketLabel } from "@/lib/politics/labeled-rank";

export const CULTURE_GRANT_SLUG = "culture-leisure-grant-ranking";
export const CULTURE_GRANT_TITLE = "문화,여행,레져 정부 지원금";

/** `[주관 기관] 사업명` — 문화·여행·레저 분야 정부·공공 지원사업. */
export const CULTURE_GRANT_SEEDS = [
  "[문화체육관광부 / 한국문화예술위원회] 문화누리카드",
  "[한국관광공사] 근로자 휴가지원사업",
  "[문화체육관광부] 청춘문화패스",
  "[문화체육관광부] 통합문화이용권",
  "[문화체육관광부] 스포츠강좌이용권",
  "[문화체육관광부] 장애인 스포츠강좌이용권",
  "[한국관광공사] 관광두레",
  "[한국관광공사] 웰니스관광 클러스터",
  "[한국문화예술위원회] 아르코 문학창작기금",
  "[한국콘텐츠진흥원] 스토리창작 지원",
  "[영화진흥위원회] 독립영화 제작지원",
  "[한국예술인복지재단] 예술인 생활안정자금",
  "[문화체육관광부] 생활밀착형 국민체육센터",
  "[문화체육관광부] 야간관광 특화도시",
  "[한국관광공사] 관광벤처 공모전",
  "[해양수산부] 어촌체험휴양마을",
  "[산림청] 자연휴양림 이용권",
  "[문화체육관광부] 공연예술 창작산실",
  "[한국공예디자인문화진흥원] 전통공예 활성화",
  "[국민체육진흥공단] 국민체력100",
  "[문화체육관광부] 방방곡곡 문화공감",
  "[한국문학번역원] 한국문학 번역지원",
  "[문화체육관광부] 지역특화 관광개발",
  "[한국문화정보원] 문화데이터 활용 지원",
  "[문화체육관광부] 박물관·미술관 길 위의 인문학",
] as const;

export function isCultureGrantBoard(slug?: string): boolean {
  return slug === CULTURE_GRANT_SLUG;
}

export function isTwoLineBracketHeatmap(heatmapGroup?: string): boolean {
  return (
    heatmapGroup === "경제 정부지원금" ||
    heatmapGroup === "음식/맛집 랭킹" ||
    heatmapGroup === "부동산 관심 랭킹" ||
    heatmapGroup === "부동산 지수" ||
    heatmapGroup === "공연 랭킹" ||
    heatmapGroup === "전시·팝업스토어" ||
    heatmapGroup === CULTURE_GRANT_TITLE
  );
}

function subjectKey(name: string): string {
  return normalizeName(parseBracketLabel(name)?.subject ?? name);
}

function findSeed(name: string, seeds: readonly string[]): string | undefined {
  const key = subjectKey(name);
  return seeds.find((seed) => {
    if (namesOverlap(seed, name)) return true;
    return subjectKey(seed) === key && key.length >= 2;
  });
}

export function ensureCultureGrantRanking(rows: BoardRankEntry[]): BoardRankEntry[] {
  const remapped = rows.map((row) => {
    const seed = findSeed(row.name, CULTURE_GRANT_SEEDS);
    if (seed) return { ...row, name: seed };
    const labeled = parseBracketLabel(row.name);
    if (labeled) return { ...row, name: formatBracketLabel(labeled.org, labeled.subject) };
    return row;
  });
  const unique: BoardRankEntry[] = [];
  const seen = new Set<string>();
  for (const row of remapped.filter((item) => parseBracketLabel(item.name))) {
    const key = subjectKey(row.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  for (const seed of CULTURE_GRANT_SEEDS) {
    const key = subjectKey(seed);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      rank: unique.length + 1,
      name: seed,
      score: Number((88 - unique.length * 1.1).toFixed(2)),
      changeRate: Number((((unique.length % 5) - 2) * 1.15).toFixed(2)),
      note: "씨드 보완 · 문화·여행·레져 지원사업 유지",
    });
  }
  return unique
    .sort((left, right) => right.score - left.score || left.rank - right.rank)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
