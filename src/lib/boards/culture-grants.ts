import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import type { BoardRankEntry } from "@/lib/boards/types";
import { formatBracketLabel, parseBracketLabel } from "@/lib/politics/labeled-rank";

/** Culture/living grants only — travel·관광 사업은 여행 카테고리 보드로 분리. */
export const CULTURE_GRANT_SLUG = "culture-leisure-grant-ranking";
export const CULTURE_GRANT_TITLE = "문화/생활 정부 지원금";

/**
 * Travel-grant subjects (and orgs) that must never appear on the culture board.
 * Kept here (not imported from travel-grants) to avoid a circular module edge.
 */
const TRAVEL_GRANT_BLOCKLIST = [
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

/** Subject-only tokens — never match the org name 문화체육관광부. */
const TRAVEL_SUBJECT_NOISE =
  /관광두레|웰니스\s*관광|야간\s*관광|관광벤처|관광숙박|지역특화\s*관광|국내\s*여행|바다\s*여행|관광약자|근로자\s*휴가|휴가\s*지원|자연휴양림|어촌체험|휴양마을|전통숙박|숲길|숲체험|나들이|항공권|호텔|리조트|캠핑|글램핑|(?<![문화체육])관광(?!부)/i;

/** Culture/living subject allowlist. */
const CULTURE_SUBJECT_ALLOW =
  /문화누리|문화패스|통합문화|스포츠강좌|문학창작|문학\s*번역|스토리창작|독립영화|예술인|국민체육|공연예술|전통공예|국민체력|문화공감|문화데이터|박물관|미술관|작은도서관|생활문화|청년예술|체육센터|방방곡곡/i;

/** `[주관 기관] 사업명` — 문화·생활·체육·예술 복지·지원사업만. */
export const CULTURE_GRANT_SEEDS = [
  "[문화체육관광부 / 한국문화예술위원회] 문화누리카드",
  "[문화체육관광부] 청춘문화패스",
  "[문화체육관광부] 통합문화이용권",
  "[문화체육관광부] 스포츠강좌이용권",
  "[문화체육관광부] 장애인 스포츠강좌이용권",
  "[한국문화예술위원회] 아르코 문학창작기금",
  "[한국콘텐츠진흥원] 스토리창작 지원",
  "[영화진흥위원회] 독립영화 제작지원",
  "[한국예술인복지재단] 예술인 생활안정자금",
  "[문화체육관광부] 생활밀착형 국민체육센터",
  "[문화체육관광부] 공연예술 창작산실",
  "[한국공예디자인문화진흥원] 전통공예 활성화",
  "[국민체육진흥공단] 국민체력100",
  "[문화체육관광부] 방방곡곡 문화공감",
  "[한국문학번역원] 한국문학 번역지원",
  "[한국문화정보원] 문화데이터 활용 지원",
  "[문화체육관광부] 박물관·미술관 길 위의 인문학",
  "[문화체육관광부] 생활문화센터 활성화",
  "[한국문화예술위원회] 청년예술인 자립지원",
  "[문화체육관광부] 작은도서관 조성",
] as const;

export function isCultureGrantBoard(slug?: string): boolean {
  return slug === CULTURE_GRANT_SLUG;
}

function subjectKey(name: string): string {
  return normalizeName(parseBracketLabel(name)?.subject ?? name);
}

function grantSubject(name: string): string {
  return (parseBracketLabel(name)?.subject ?? name).trim();
}

function grantOrg(name: string): string {
  return (parseBracketLabel(name)?.org ?? "").trim();
}

function findSeed(name: string, seeds: readonly string[]): string | undefined {
  const key = subjectKey(name);
  return seeds.find((seed) => {
    if (namesOverlap(seed, name)) return true;
    return subjectKey(seed) === key && key.length >= 2;
  });
}

/** True when the row belongs on 여행 정부지원금, not 문화/생활. */
export function isTravelNoiseGrant(name: string): boolean {
  const subject = grantSubject(name);
  const org = grantOrg(name);
  if (/한국관광공사/.test(org) || /한국관광공사/.test(name)) return true;
  if (
    TRAVEL_GRANT_BLOCKLIST.some(
      (seed) => namesOverlap(seed, name) || subjectKey(seed) === subjectKey(name),
    )
  ) {
    return true;
  }
  return TRAVEL_SUBJECT_NOISE.test(subject);
}

/** Allowlist: culture seeds or clear culture/living subject tokens, never travel. */
export function isCultureLivingGrant(name: string): boolean {
  if (!name?.trim()) return false;
  if (isTravelNoiseGrant(name)) return false;
  if (findSeed(name, CULTURE_GRANT_SEEDS)) return true;
  return CULTURE_SUBJECT_ALLOW.test(grantSubject(name));
}

export function isTwoLineBracketHeatmap(heatmapGroup?: string): boolean {
  return (
    heatmapGroup === "경제 정부지원금" ||
    heatmapGroup === "음식/맛집 랭킹" ||
    heatmapGroup === "부동산 관심 랭킹" ||
    heatmapGroup === "부동산 지수" ||
    heatmapGroup === "공연 랭킹" ||
    heatmapGroup === "전시·팝업스토어" ||
    heatmapGroup === CULTURE_GRANT_TITLE ||
    heatmapGroup === "문화/생활 정부 지원금" ||
    heatmapGroup === "여행 정부지원금" ||
    heatmapGroup === "문화,여행,레져 정부 지원금"
  );
}

/**
 * Culture heatmap ranking: keep only culture/living grants.
 * Unknown or travel rows are dropped; missing seeds are backfilled.
 */
export function ensureCultureGrantRanking(rows: BoardRankEntry[]): BoardRankEntry[] {
  const remapped = rows
    .filter((row) => isCultureLivingGrant(row.name))
    .map((row) => {
      const seed = findSeed(row.name, CULTURE_GRANT_SEEDS);
      if (seed) return { ...row, name: seed };
      const labeled = parseBracketLabel(row.name);
      if (labeled) return { ...row, name: formatBracketLabel(labeled.org, labeled.subject) };
      return row;
    })
    .filter((row) => isCultureLivingGrant(row.name));

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
      note: "씨드 보완 · 문화/생활 지원사업 유지",
    });
  }
  return unique
    .sort((left, right) => right.score - left.score || left.rank - right.rank)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
