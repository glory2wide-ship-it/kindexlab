import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import type { BoardRankEntry } from "@/lib/boards/types";
import { formatBracketLabel, parseBracketLabel } from "@/lib/politics/labeled-rank";

/** Entertainment-category grant board — mass content / 한류 / game·broadcast IP. */
export const ENT_GRANT_SLUG = "entertainment-government-grant-ranking";
export const ENT_GRANT_TITLE = "엔터 정부지원금";

/**
 * `[주관 기관] 사업명` — 엔터테인먼트·콘텐츠·한류·게임·방송·대중음악 지원만.
 * Politics `SUBSIDY_SEEDS`(근로장려금·청년도약계좌 등) and culture living grants
 * must not appear on this heatmap.
 */
export const ENT_GRANT_SEEDS = [
  "[한국콘텐츠진흥원] 방송영상콘텐츠 제작지원",
  "[한국콘텐츠진흥원] 게임콘텐츠 제작지원",
  "[한국콘텐츠진흥원] 웹툰·웹소설 사업화 지원",
  "[한국콘텐츠진흥원] OTT 콘텐츠 제작지원",
  "[한국콘텐츠진흥원] 스토리 IP 사업화",
  "[한국콘텐츠진흥원] 캐릭터·라이선싱 지원",
  "[한국콘텐츠진흥원] 한류 콘텐츠 해외진출",
  "[영화진흥위원회] 영화 제작지원",
  "[영화진흥위원회] 한국영화 해외배급 지원",
  "[문화체육관광부] 대중문화예술산업 발전",
  "[문화체육관광부] 대중음악 공연 활성화",
  "[문화체육관광부] 공연시장 티켓 활성화",
  "[문화체육관광부] 한류 관광·콘텐츠 연계",
  "[과학기술정보통신부] e스포츠 산업 육성",
  "[과학기술정보통신부] 메타버스 콘텐츠 지원",
  "[한국방송통신전파진흥원] 방송콘텐츠 해외진출",
  "[한국저작권위원회] 콘텐츠 저작권 보호·유통",
  "[한국음악콘텐츠협회] 음원·음반 산업 지원",
  "[서울특별시] 영상·미디어 콘텐츠 지원",
  "[부산광역시] 영상콘텐츠 제작 지원",
] as const;

/** Politics / general welfare subsidy subjects that must never sit on 엔터 보드. */
const POLITICS_SUBSIDY_SUBJECT_NOISE =
  /청년도약|소상공인|부모급여|기초연금|근로장려|자녀장려|국민취업|디딤돌|에너지바우처|내일저축|전세보증|국가장학|아이돌봄|민생회복|영농정착|안심전환|버팀목|정책자금|내일배움|긴급복지|온누리상품권|디지털배움터|지역사랑상품권|스마트상점|전기요금/i;

/** Culture/living grant subjects (문화누리 등) — keep on culture board, not 엔터. */
const CULTURE_LIVING_SUBJECT_NOISE =
  /문화누리|문화패스|통합문화|스포츠강좌|문학창작|문학\s*번역|독립영화|예술인\s*생활|국민체육|전통공예|국민체력|문화공감|문화데이터|박물관|미술관|작은도서관|생활문화|청년예술|체육센터|방방곡곡/i;

const ENT_SUBJECT_ALLOW =
  /방송|영상|OTT|웹툰|웹소설|게임|e스포츠|이스포츠|한류|대중문화|대중음악|음원|음반|콘텐츠|캐릭터|라이선스|라이선싱|스토리\s*IP|영화\s*제작|해외배급|공연시장|티켓|메타버스|저작권|미디어/i;

export function isEntertainmentGrantBoard(slug?: string): boolean {
  return slug === ENT_GRANT_SLUG;
}

function subjectKey(name: string): string {
  return normalizeName(parseBracketLabel(name)?.subject ?? name);
}

function grantSubject(name: string): string {
  return (parseBracketLabel(name)?.subject ?? name).trim();
}

function findSeed(name: string, seeds: readonly string[]): string | undefined {
  const key = subjectKey(name);
  return seeds.find((seed) => {
    if (namesOverlap(seed, name)) return true;
    return subjectKey(seed) === key && key.length >= 2;
  });
}

export function isEntertainmentGrant(name: string): boolean {
  if (!name?.trim()) return false;
  const subject = grantSubject(name);
  if (POLITICS_SUBSIDY_SUBJECT_NOISE.test(subject) || POLITICS_SUBSIDY_SUBJECT_NOISE.test(name)) {
    return false;
  }
  if (CULTURE_LIVING_SUBJECT_NOISE.test(subject) || CULTURE_LIVING_SUBJECT_NOISE.test(name)) {
    return false;
  }
  if (findSeed(name, ENT_GRANT_SEEDS)) return true;
  return ENT_SUBJECT_ALLOW.test(subject);
}

/**
 * Entertainment heatmap ranking: keep only 엔터/콘텐츠 지원사업.
 * Politics welfare rows and culture living grants are dropped; seeds backfill.
 */
export function ensureEntertainmentGrantRanking(rows: BoardRankEntry[]): BoardRankEntry[] {
  const remapped = rows
    .filter((row) => isEntertainmentGrant(row.name))
    .map((row) => {
      const seed = findSeed(row.name, ENT_GRANT_SEEDS);
      if (seed) return { ...row, name: seed };
      const labeled = parseBracketLabel(row.name);
      if (labeled) return { ...row, name: formatBracketLabel(labeled.org, labeled.subject) };
      return row;
    })
    .filter((row) => isEntertainmentGrant(row.name));

  const unique: BoardRankEntry[] = [];
  const seen = new Set<string>();
  for (const row of remapped.filter((item) => parseBracketLabel(item.name))) {
    const key = subjectKey(row.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  for (const seed of ENT_GRANT_SEEDS) {
    const key = subjectKey(seed);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      rank: unique.length + 1,
      name: seed,
      score: Number((88 - unique.length * 1.1).toFixed(2)),
      changeRate: Number((((unique.length % 5) - 2) * 1.15).toFixed(2)),
      note: "씨드 보완 · 엔터 정부지원금 유지",
    });
  }
  return unique
    .sort((left, right) => right.score - left.score || left.rank - right.rank)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
