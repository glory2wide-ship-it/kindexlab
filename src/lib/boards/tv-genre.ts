/**
 * TV 시청률 board genre sub-tabs (전체 / 드라마 / 예능 / 뉴스·시사 / 스포츠 / OTT 화제성).
 * Mirrors the region-filter UX, but classifies by programme genre rather than 시/도.
 */

import type { BoardRankEntry } from "@/lib/boards/types";

export const TV_RATINGS_BOARD_SLUG = "realtime-tv-ratings";
export const OTT_BUZZ_BOARD_SLUG = "ott-buzz-ranking";

export type TvGenreSegment = "drama" | "variety" | "news" | "sports" | "ott";

export type HeatmapTvGenre = "all" | TvGenreSegment;

export const TV_GENRE_SEGMENTS: TvGenreSegment[] = [
  "drama",
  "variety",
  "news",
  "sports",
  "ott",
];

export const TV_GENRE_LABEL: Record<TvGenreSegment, string> = {
  drama: "드라마",
  variety: "예능",
  news: "뉴스·시사",
  sports: "스포츠",
  ott: "OTT 화제성",
};

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
  골때리는그녀들: "sports",
  // News / current affairs
  kbs뉴스9: "news",
  mbc뉴스데스크: "news",
  sbs8뉴스: "news",
  뉴스a: "news",
  jtbc뉴스룸: "news",
  tv조선뉴스: "news",
  그것이알고싶다: "news",
  뉴스데스크: "news",
  뉴스룸: "news",
  뉴스9: "news",
  "8뉴스": "news",
};

const DRAMA_RE =
  /(드라마|특별편|종영|첫방|월화|수목|금토|일일연속극|미니시리즈|로맨스|사극)/i;
const VARIETY_RE =
  /(예능|퀴즈|토크|서바이벌|오디션|관찰|리얼리티|나는\s*솔로|나\s*혼자|런닝맨|유\s*퀴즈|미운\s*우리|전국노래|불후|1박\s*2일|라디오스타|아는\s*형님)/i;
const NEWS_RE =
  /(뉴스|뉴스룸|뉴스데스크|뉴스\s*\d|보도|시사|그것이\s*알고|탐사|데스크)/i;
const SPORTS_RE =
  /(스포츠|중계|경기|야구|축구|배구|농구|골프|올림픽|월드컵|KBO|MLB|NBA|프리미어리그|골때리)/i;
const OTT_RE =
  /(넷플릭스|netflix|티빙|tving|디즈니|disney|웨이브|wavve|쿠팡플레이|coupang|왓챠|watcha|라프텔|ott)/i;

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
  if ((TV_GENRE_SEGMENTS as string[]).includes(value)) return value as TvGenreSegment;
  return "all";
}

/**
 * Infer a TV genre for a programme / OTT title.
 * Returns undefined when the name does not clearly match a genre bucket
 * (so "전체" still shows it, but genre tabs can skip it or pad from seeds).
 */
export function inferTvGenre(
  name: string,
  meta?: { tags?: string[]; subtitle?: string; nameEn?: string },
): TvGenreSegment | undefined {
  const blob = `${name} ${(meta?.tags ?? []).join(" ")} ${meta?.subtitle ?? ""} ${meta?.nameEn ?? ""}`;
  const key = compactKey(name);
  if (!key) return undefined;

  if (KNOWN_TV_GENRE[key]) return KNOWN_TV_GENRE[key];
  // Longer known keys as substring (e.g. "KBS 뉴스9 주말")
  for (const [known, genre] of Object.entries(KNOWN_TV_GENRE)) {
    if (known.length >= 4 && key.includes(known)) return genre;
  }

  if (OTT_RE.test(blob)) return "ott";
  if (NEWS_RE.test(blob)) return "news";
  if (SPORTS_RE.test(blob)) return "sports";
  if (VARIETY_RE.test(blob)) return "variety";
  if (DRAMA_RE.test(blob)) return "drama";

  // Channel cues from subtitle / tags
  if (/YTN|연합뉴스/i.test(blob)) return "news";
  if (/넷플릭스|티빙|웨이브|디즈니|쿠팡/i.test(blob)) return "ott";

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
    entityMatchesTvGenre(
      { name: row.name, tags: row.tags, subtitle: row.note },
      genre,
    ),
  );
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
  ],
  news: [
    "KBS 뉴스9",
    "MBC 뉴스데스크",
    "SBS 8뉴스",
    "JTBC 뉴스룸",
    "뉴스A",
    "TV조선 뉴스",
    "그것이 알고싶다",
    "KBS 뉴스7",
    "MBC 뉴스투데이",
    "SBS 나이트라인",
    "YTN 뉴스",
    "채널A 뉴스",
    "MBN 뉴스와이드",
    "시사기획 창",
    "PD수첩",
    "탐사보도 스트레이트",
    "뉴스특보",
    "밤 뉴스",
    "아침뉴스",
    "주말뉴스",
  ],
  sports: [
    "골때리는 그녀들",
    "KBO 중계",
    "스포츠뉴스",
    "SBS 스포츠뉴스",
    "MBC 스포츠뉴스",
    "KBS 스포츠9",
    "야구중계",
    "축구중계",
    "프리미어리그 중계",
    "NBA 중계",
    "배구중계",
    "골프 중계",
    "이강인",
    "손흥민",
    "김하성",
    "프로야구 하이라이트",
    "월드컵 예선",
    "올림픽 중계",
    "스포츠매거진",
    "화요일은 야구다",
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
    "넷플릭스 신작",
    "티빙 오리지널",
    "디즈니+ 시리즈",
    "쿠팡플레이 예능",
    "웨이브 드라마",
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
