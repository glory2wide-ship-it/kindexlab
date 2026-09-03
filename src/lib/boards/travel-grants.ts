import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import type { BoardRankEntry } from "@/lib/boards/types";
import { formatBracketLabel, parseBracketLabel } from "@/lib/politics/labeled-rank";
import { isTravelNoiseGrant } from "@/lib/boards/culture-grants";

export const TRAVEL_GRANT_SLUG = "travel-government-grant-ranking";
export const TRAVEL_GRANT_TITLE = "여행 정부지원금";

/** `[주관 기관] 사업명` — 여행·관광·휴양 공공 지원사업. */
export const TRAVEL_GRANT_SEEDS = [
  "[한국관광공사] 근로자 휴가지원사업",
  "[한국관광공사] 관광두레",
  "[한국관광공사] 웰니스관광 클러스터",
  "[문화체육관광부] 야간관광 특화도시",
  "[한국관광공사] 관광벤처 공모전",
  "[해양수산부] 어촌체험휴양마을",
  "[산림청] 자연휴양림 이용권",
  "[문화체육관광부] 지역특화 관광개발",
  "[한국관광공사] 국내여행 활성화 캠페인",
  "[문화체육관광부] 관광숙박 지원",
  "[한국관광공사] 지역관광 기념품 공모",
  "[해양수산부] 바다여행 활성화",
  "[산림청] 숲길·숲체험 지원",
  "[한국관광공사] 관광약자 여행지원",
  "[문화체육관광부] 전통숙박 체험 지원",
] as const;

export function isTravelGrantBoard(slug?: string): boolean {
  return slug === TRAVEL_GRANT_SLUG;
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

/** Keep travel/tourism grants; drop pure culture-life welfare rows. */
function isCultureOnlyGrant(name: string): boolean {
  if (isTravelNoiseGrant(name)) return false;
  return /문화누리|문화패스|통합문화|스포츠강좌|문학창작|스토리창작|독립영화|예술인|국민체육|공연예술|전통공예|국민체력|문화공감|문학\s*번역|문화데이터|박물관|미술관|작은도서관|생활문화/i.test(
    name,
  );
}

export function ensureTravelGrantRanking(rows: BoardRankEntry[]): BoardRankEntry[] {
  const remapped = rows
    .filter((row) => !isCultureOnlyGrant(row.name))
    .map((row) => {
      const seed = findSeed(row.name, TRAVEL_GRANT_SEEDS);
      if (seed) return { ...row, name: seed };
      const labeled = parseBracketLabel(row.name);
      if (labeled) return { ...row, name: formatBracketLabel(labeled.org, labeled.subject) };
      return row;
    })
    .filter((row) => isTravelNoiseGrant(row.name) || findSeed(row.name, TRAVEL_GRANT_SEEDS));

  const unique: BoardRankEntry[] = [];
  const seen = new Set<string>();
  for (const row of remapped.filter((item) => parseBracketLabel(item.name))) {
    const key = subjectKey(row.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  for (const seed of TRAVEL_GRANT_SEEDS) {
    const key = subjectKey(seed);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      rank: unique.length + 1,
      name: seed,
      score: Number((88 - unique.length * 1.1).toFixed(2)),
      changeRate: Number((((unique.length % 5) - 2) * 1.15).toFixed(2)),
      note: "씨드 보완 · 여행 정부지원금 유지",
    });
  }
  return unique
    .sort((left, right) => right.score - left.score || left.rank - right.rank)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
