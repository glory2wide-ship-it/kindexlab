/**
 * TV 시청률 board genre sub-tabs (전체 / 드라마 / 예능 / OTT 화제성).
 * Mirrors the region-filter UX, but classifies by programme genre rather than 시/도.
 */

import type { BoardRankEntry } from "@/lib/boards/types";
import { isLikelyTvProgramName } from "@/lib/boards/tv-program";

export const TV_RATINGS_BOARD_SLUG = "realtime-tv-ratings";
export const OTT_BUZZ_BOARD_SLUG = "ott-buzz-ranking";

/** Visible genre tabs — news/sports removed from the TV 시청률 submenu. */
export type TvGenreSegment = "drama" | "variety" | "ott";

export type HeatmapTvGenre = "all" | TvGenreSegment;

export const TV_GENRE_SEGMENTS: TvGenreSegment[] = ["drama", "variety", "ott"];

export const TV_GENRE_LABEL: Record<TvGenreSegment, string> = {
  drama: "드라마",
  variety: "예능",
  ott: "OTT 화제성",
};

/** Drama LIVE heatmap always paints through rank 20. */
export const TV_DRAMA_HEATMAP_LIMIT = 20;

/** Known titles → genre (compact key = whitespace-stripped lowercase). */
const KNOWN_TV_GENRE: Record<string, TvGenreSegment> = {
  // Drama
  선재업고튀어: "drama",
  눈물의여왕: "drama",
  여보미안해: "drama",
  폭싹속았수다: "drama",
  재벌x형사2: "drama",
  재벌x형사: "drama",
  사랑이온다: "drama",
  욕망의덫: "drama",
  환승연애: "drama",
  솔로지옥: "drama",
  무빙: "drama",
  더글로리: "drama",
  이상한변호사우영우: "drama",
  빈센조: "drama",
  사랑의불시착: "drama",
  호텔델루나: "drama",
  이태원클라쓰: "drama",
  // Variety
  나혼자산다: "variety",
  미운우리새끼: "variety",
  런닝맨: "variety",
  유퀴즈온더블럭: "variety",
  진격의할매: "variety",
  나는솔로: "variety",
  하트시그널: "variety",
  핑계고: "variety",
  전국노래자랑: "variety",
  열린음악회: "variety",
  불후의명곡: "variety",
  "1박2일": "variety",
  신랑수업: "variety",
  동상이몽: "variety",
  오은영리포트: "variety",
  스우파: "variety",
  무한도전: "variety",
  라디오스타: "variety",
  냉장고를부탁해: "variety",
  비긴어게인: "variety",
  아는형님: "variety",
  미스터트롯: "variety",
  미스트롯: "variety",
  골때리는그녀들: "variety",
  // OTT originals
  오징어게임: "ott",
  "d.p.": "ott",
  dp: "ott",
  사냥개들: "ott",
  마스크걸: "ott",
  킬러부대: "ott",
  경성크리처: "ott",
  중증외상센터: "ott",
  미스터플랑크톤: "ott",
  트렁크: "ott",
  굿보이: "ott",
};

const DRAMA_RE =
  /(드라마|특별편|종영|첫방|월화|수목|금토|일일연속극|미니시리즈|로맨스|사극)/i;
const VARIETY_RE =
  /(예능|퀴즈|토크|서바이벌|오디션|관찰|리얼리티|나는\s*솔로|나\s*혼자|런닝맨|유\s*퀴즈|미운\s*우리|전국노래|불후|1박\s*2일|라디오스타|아는\s*형님|골때리)/i;
const NEWS_RE =
  /(뉴스|뉴스룸|뉴스데스크|뉴스\s*\d|보도|시사|그것이\s*알고|탐사|데스크)/i;
const SPORTS_RE =
  /(스포츠|중계|경기|야구|축구|배구|농구|골프|올림픽|월드컵|KBO|MLB|NBA|프리미어리그)/i;
const OTT_RE =
  /(넷플릭스|netflix|티빙|tving|디즈니|disney|웨이브|wavve|쿠팡플레이|coupang|왓챠|watcha|라프텔|ott)/i;

/** Broadcaster / OTT platform labels — never valid OTT programme tile names. */
const BROADCASTER_OR_PLATFORM_RE =
  /^(KBS|KBS[12]|MBC|SBS|JTBC|tvN|TVN|TV조선|TV\s*조선|채널A|MBN|ENA|OCN|Mnet|EBS|YTN|넷플릭스|Netflix|티빙|Tving|웨이브|Wavve|디즈니\+?|Disney\+?|쿠팡플레이|Coupang|왓챠|Watcha|라프텔)(\s*(뉴스|드라마|예능|신작|오리지널|오리지날|시리즈|채널|방송)?)?$/i;

function compactKey(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\s+/g, "")
    .replace(/[·._\-]/g, "")
    .toLowerCase()
    .trim();
}

export function boardUsesTvGenreFilter(slug: string | undefined | null): boolean {
  return slug === TV_RATINGS_BOARD_SLUG || slug === "variety-hot-minute";
}

/** @deprecated alias */
export const boardUsesGenreFilter = boardUsesTvGenreFilter;

export function parseTvGenreQuery(raw: string | null | undefined): HeatmapTvGenre {
  const value = (raw ?? "all").trim().toLowerCase();
  if (value === "all" || !value) return "all";
  // Retired tabs map to 전체 so stale ?genre=news|sports links keep working.
  if (value === "news" || value === "sports") return "all";
  if ((TV_GENRE_SEGMENTS as string[]).includes(value)) return value as TvGenreSegment;
  return "all";
}

export function tvGenreHeatmapLimit(genre: HeatmapTvGenre, fallback: number): number {
  // Drama LIVE heatmap paints ranks 1–20.
  if (genre === "drama") return TV_DRAMA_HEATMAP_LIMIT;
  return fallback;
}

export function tvGenreChipLabel(
  genre: HeatmapTvGenre | undefined,
  name?: string,
  meta?: { tags?: string[]; subtitle?: string; nameEn?: string },
): string | undefined {
  if (genre && genre !== "all") return TV_GENRE_LABEL[genre];
  if (!name) return undefined;
  const inferred = inferTvGenre(name, meta);
  return inferred ? TV_GENRE_LABEL[inferred] : undefined;
}

/**
 * Infer a TV genre for a programme / OTT title.
 * Returns undefined when the name does not clearly match a visible genre bucket
 * (뉴스·스포츠 titles stay on "전체" only).
 */
export function inferTvGenre(
  name: string,
  meta?: { tags?: string[]; subtitle?: string; nameEn?: string },
): TvGenreSegment | undefined {
  const key = compactKey(name);
  if (!key) return undefined;

  if (KNOWN_TV_GENRE[key]) return KNOWN_TV_GENRE[key];
  for (const [known, genre] of Object.entries(KNOWN_TV_GENRE)) {
    if (known.length >= 4 && key.includes(known)) return genre;
  }

  const nameBlob = `${name} ${meta?.nameEn ?? ""} ${meta?.subtitle ?? ""}`;
  // News / sports stay off the visible genre tabs.
  if (NEWS_RE.test(nameBlob) || /YTN|연합뉴스/i.test(nameBlob)) return undefined;
  if (SPORTS_RE.test(nameBlob)) return undefined;

  if (OTT_RE.test(nameBlob)) return "ott";
  if (VARIETY_RE.test(nameBlob)) return "variety";
  if (DRAMA_RE.test(nameBlob)) return "drama";
  if (/넷플릭스|티빙|웨이브|디즈니|쿠팡/i.test(nameBlob)) return "ott";

  const tags = (meta?.tags ?? []).join(" ");
  if (OTT_RE.test(tags) || /넷플릭스|티빙|웨이브|디즈니|쿠팡/i.test(tags)) return "ott";

  return undefined;
}

export function entityMatchesTvGenre(
  entity: { name?: string; tags?: string[]; nameEn?: string; subtitle?: string },
  genre: HeatmapTvGenre,
): boolean {
  if (genre === "all") return true;
  const inferred = inferTvGenre(entity.name ?? "", entity);
  return inferred === genre;
}

export function filterRowsByTvGenre<T extends { name: string; tags?: string[]; note?: string }>(
  rows: readonly T[] | undefined,
  genre: HeatmapTvGenre,
): T[] {
  if (!rows?.length) return [];
  if (genre === "all") return [...rows];
  return rows.filter((row) =>
    entityMatchesTvGenre({ name: row.name, tags: row.tags, subtitle: row.note }, genre),
  );
}

/** True when the label is a station/platform, not a programme title. */
export function isBroadcasterOrPlatformName(name: string): boolean {
  const cleaned = name
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return true;
  if (BROADCASTER_OR_PLATFORM_RE.test(cleaned)) return true;
  // Platform + generic qualifier without a distinct title ("넷플릭스 신작").
  if (
    /^(넷플릭스|티빙|웨이브|디즈니\+?|쿠팡플레이|왓챠|라프텔)(\s|$)/i.test(cleaned) &&
    /(신작|오리지널|오리지날|시리즈|예능|드라마|화제작|인기)$/i.test(cleaned)
  ) {
    return true;
  }
  return false;
}

/** Crawl / seed meta titles that are not programme names. */
export function isOttMetaTitle(name: string): boolean {
  const raw = name.trim();
  if (!raw) return true;
  if (/^\[(웹|뉴스|유튜브|공식|블로그)/i.test(raw)) return true;
  if (/OTT\s*화제작|인기\s*시리즈|디즈니플러스\s*신작|넷플릭스\s*인기/i.test(raw)) return true;
  if (/주가|시총|영업익|실적|상장/i.test(raw)) return true;
  // Truncated crawl leftovers ("[유튜브").
  if (/^\[/.test(raw) && !/\]/.test(raw)) return true;
  return false;
}

/** Keep OTT tiles on programme titles only. */
export function sanitizeOttProgramRows<T extends { name: string }>(rows: readonly T[]): T[] {
  return rows.filter((row) => {
    const name = row.name ?? "";
    if (!name.trim()) return false;
    if (isOttMetaTitle(name)) return false;
    if (isBroadcasterOrPlatformName(name)) return false;
    if (!isLikelyTvProgramName(name)) return false;
    return true;
  });
}

/** Seed titles used to pad a thin genre tab (never cross-fill other genres). */
export const TV_GENRE_SEED_TITLES: Record<TvGenreSegment, string[]> = {
  drama: [
    "선재 업고 튀어",
    "눈물의 여왕",
    "폭싹 속았수다",
    "사랑이온다",
    "여보 미안해",
    "재벌X형사2",
    "환승연애",
    "솔로지옥",
    "무빙",
    "더 글로리",
    "이상한 변호사 우영우",
    "빈센조",
    "사랑의 불시착",
    "호텔 델루나",
    "이태원 클라쓰",
    "소년시대",
    "밤이 되었습니다",
    "견우와 선녀",
    "견원지간",
    "착한 사나이",
    "내일",
    "나의 해방일지",
    "비밀의 숲",
    "나의 아저씨",
    "도깨비",
  ],
  variety: [
    "나 혼자 산다",
    "미운 우리 새끼",
    "런닝맨",
    "유 퀴즈 온 더 블럭",
    "나는 솔로",
    "1박 2일",
    "아는 형님",
    "라디오스타",
    "전국노래자랑",
    "불후의 명곡",
    "동상이몽",
    "신랑수업",
    "하트시그널",
    "진격의 할매",
    "핑계고",
    "스우파",
    "미스터트롯",
    "오은영 리포트",
    "냉장고를 부탁해",
    "비긴어게인",
    "골때리는 그녀들",
  ],
  ott: [
    "폭싹 속았수다",
    "더 글로리",
    "오징어 게임",
    "무빙",
    "솔로지옥",
    "환승연애",
    "D.P.",
    "사냥개들",
    "마스크걸",
    "킬러 부대",
    "경성크리처",
    "중증외상센터",
    "미스터 플랑크톤",
    "트렁크",
    "굿보이",
    "오징어 게임 시즌2",
    "살인자ㅇ난감",
    "이두나!",
    "정신병동에도 아침이 와요",
    "소용없어 거짓말",
  ],
};

function seedRow(name: string, index: number, genre: TvGenreSegment): BoardRankEntry {
  const score = Math.max(12, Number((92 - index * 3.1).toFixed(2)));
  return {
    rank: index + 1,
    name,
    score,
    changeRate: 0,
    note: `${TV_GENRE_LABEL[genre]} 후보`,
  };
}

/** Pad a genre-filtered ranking so the tab still shows a full screen. */
export function padTvGenreRanking(
  rows: BoardRankEntry[],
  genre: HeatmapTvGenre,
  limit: number,
): BoardRankEntry[] {
  if (genre === "all") return rows.slice(0, limit);
  const seen = new Set(rows.map((row) => compactKey(row.name)));
  const out = [...rows];
  for (const title of TV_GENRE_SEED_TITLES[genre]) {
    if (out.length >= limit) break;
    const key = compactKey(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(seedRow(title, out.length, genre));
  }
  return out.slice(0, limit).map((row, index) => ({ ...row, rank: index + 1 }));
}
