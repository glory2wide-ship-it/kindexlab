import type { BoardRankEntry, RegionSegment } from "@/lib/boards/types";
import { EXHIBITION_BOARD_SLUG, PERFORMANCE_BOARD_SLUG } from "@/lib/boards/region-catalogs";
import {
  catalogRowsForRegion,
  filterRowsByRegion,
  padRankEntries,
  REGION_LABEL,
  tagRegionOnRow,
} from "@/lib/boards/regions";
import { namesOverlap, normalizeName } from "@/lib/ingestion/names";

/** 공연·전시 보드만 아동/유치원 연령 탭·필터를 쓴다. (age-tabs와 순환 import 금지) */
export function boardUsesKidsAgeTab(slug?: string): boolean {
  return slug === PERFORMANCE_BOARD_SLUG || slug === EXHIBITION_BOARD_SLUG;
}

/**
 * 아동/유치원 탭 허용 — 명시적 키즈·가족 표기 또는 어린이 친화 프랜차이즈만.
 * 뮤지컬 위키드 등 일반·성인 관객 타깃 작품은 여기서 걸러진다.
 */
const KIDS_FRIENDLY_ALLOW =
  /어린이|유아|키즈|유치원|인형극|가족\s*(뮤지컬|연극|공연|음악회|콘서트|발레)|아기돼지|겨울왕국|라이온\s*킹|라이온킹|알라딘|호두까기|뽀로로|타요|핑크퐁|상어\s*가족|디즈니|카카오프렌즈|캐릭터\s*(팝업|전시|스토어)|체험전|키즈\s*클래식|유아\s*(음악|연극|발레|뮤지컬)|어린이\s*(발레|음악극|뮤지컬|연극|인형|체험)|몰입형\s*체험|가족\s*몰입/i;

/** 아동/유치원 관람에 부적합한 일반·청장년 타깃 공연·전시. */
const KIDS_FRIENDLY_BLOCK =
  /위키드|wicked|데스노트|시카고|팬텀|지킬|&\s*하이드|레\s*미제라블|헤드윅|렌트|맘마미아|캣츠(?!\s*(어린이|키즈|가족))|오페라의\s*유령|영웅(?!\s*어린이)|성인|19\s*세|호러|스릴러|피카소|모네|호크니|무라카미|나이키|젠틀몬스터|디올|애플\s*팝업|이건희/i;

export function isKidsFriendlyCultureEvent(name: string): boolean {
  const trimmed = name?.trim() ?? "";
  if (trimmed.length < 2) return false;
  if (KIDS_FRIENDLY_BLOCK.test(trimmed)) return false;
  return KIDS_FRIENDLY_ALLOW.test(trimmed);
}

const PERFORMANCE_KIDS_SUBJECTS = [
  "어린이 뮤지컬",
  "가족 뮤지컬",
  "어린이 인형극",
  "키즈 클래식 콘서트",
  "유아 음악회",
  "어린이 발레",
  "가족 연극",
  "어린이 음악극",
  "가족 뮤지컬 겨울왕국",
  "어린이 뮤지컬 알라딘",
  "어린이 발레 호두까기인형",
  "가족 뮤지컬 아기돼지 삼형제",
] as const;

const EXHIBITION_KIDS_SUBJECTS = [
  "디즈니 팝업",
  "카카오프렌즈 팝업",
  "어린이 체험전",
  "가족 몰입형 체험전",
  "캐릭터 팝업스토어",
  "키즈 미디어아트 체험전",
  "어린이 과학체험전",
  "디즈니 100주년 팝업",
  "가족 체험 전시",
  "캐릭터 어린이 팝업",
  "키즈 인터랙티브 전시",
  "유아 감각 체험전",
] as const;

function syntheticKidsRowsForRegion(region: RegionSegment, slug?: string): BoardRankEntry[] {
  const label = REGION_LABEL[region];
  const subjects =
    slug === EXHIBITION_BOARD_SLUG ? EXHIBITION_KIDS_SUBJECTS : PERFORMANCE_KIDS_SUBJECTS;
  return subjects.map((subject, index) => ({
    rank: index + 1,
    name: `[${label}] ${subject}`,
    score: Number((88 - index * 1.1).toFixed(2)),
    changeRate: Number((((index % 5) - 2) * 1.05).toFixed(2)),
    note: `${label} 아동/유치원 관람 가능`,
    region,
  }));
}

function lookupOrMint(
  name: string,
  total: BoardRankEntry[],
  rank: number,
  note: string,
): BoardRankEntry {
  const match = total.find(
    (row) => namesOverlap(row.name, name) || normalizeName(row.name) === normalizeName(name),
  );
  if (match) return { ...match, rank };
  return {
    rank,
    name,
    score: Number((92 - rank * 1.8).toFixed(2)),
    changeRate: Number((((rank % 5) - 2) * 1.1).toFixed(2)),
    note,
  };
}

/**
 * 아동/유치원 세그먼트: 관람 가능한 종목만 유지하고, 부족분은 키즈 씨드로만 채운다.
 * 전체 랭킹(위키드 등)으로 패딩하지 않는다.
 */
export function ensureKidsCultureSegment(
  seeds: string[] | undefined,
  llmRows: BoardRankEntry[] | undefined,
  total: BoardRankEntry[],
  limit: number,
  note: string,
): BoardRankEntry[] {
  const seen = new Set<string>();
  const out: BoardRankEntry[] = [];

  const push = (row: BoardRankEntry) => {
    if (!isKidsFriendlyCultureEvent(row.name)) return;
    const key = normalizeName(row.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ ...row, rank: out.length + 1 });
  };

  for (const seed of seeds ?? []) {
    push(lookupOrMint(seed, total, out.length + 1, note));
  }
  for (const row of llmRows ?? []) push(row);
  for (const row of total) push(row);

  return out.slice(0, Math.max(1, limit)).map((row, index) => ({
    ...row,
    rank: index + 1,
    score: Number((Math.max(12, row.score) * (1 - index * 0.016)).toFixed(2)),
    note: /아동|유치원|어린이|키즈|관람 가능/.test(row.note)
      ? row.note.slice(0, 60)
      : `${row.note} · 아동/유치원 관람 가능`.slice(0, 60),
  }));
}

/** 아동/유치원 + 지역 탭: 해당 시/도의 관람 가능 종목만 채운다. */
export function selectKidsCultureRegionRanking(
  kidsRows: BoardRankEntry[],
  total: BoardRankEntry[],
  region: RegionSegment,
  limit: number,
  slug?: string,
): BoardRankEntry[] {
  const preferred = filterRowsByRegion(kidsRows, region)
    .filter((row) => isKidsFriendlyCultureEvent(row.name))
    .map((row) => tagRegionOnRow({ ...row, region }));
  const fromTotal = filterRowsByRegion(total, region)
    .filter((row) => isKidsFriendlyCultureEvent(row.name))
    .map((row) => tagRegionOnRow({ ...row, region }));
  const fromCatalog = catalogRowsForRegion(region, slug).filter((row) =>
    isKidsFriendlyCultureEvent(row.name),
  );
  const synthetic = syntheticKidsRowsForRegion(region, slug);
  return padRankEntries(
    preferred.length ? preferred : fromTotal,
    [...fromCatalog, ...synthetic],
    limit,
  ).filter(
    (row) => isKidsFriendlyCultureEvent(row.name) && filterRowsByRegion([row], region).length > 0,
  );
}

/** 아동/유치원 + 전체: 성인 차트 패딩 없이 키즈 종목만. */
export function selectKidsCultureAllRanking(
  kidsRows: BoardRankEntry[],
  total: BoardRankEntry[],
  limit: number,
  slug?: string,
): BoardRankEntry[] {
  const preferred = kidsRows.filter((row) => isKidsFriendlyCultureEvent(row.name));
  const fromTotal = total.filter((row) => isKidsFriendlyCultureEvent(row.name));
  const synthetic = (["seoul", "gyeonggi", "busan", "daegu", "incheon"] as RegionSegment[]).flatMap(
    (region) => syntheticKidsRowsForRegion(region, slug),
  );
  return padRankEntries(preferred.length ? preferred : fromTotal, synthetic, limit).filter((row) =>
    isKidsFriendlyCultureEvent(row.name),
  );
}

export function shouldFilterKidsCultureSegment(slug?: string): boolean {
  return boardUsesKidsAgeTab(slug);
}
