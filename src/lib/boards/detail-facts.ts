/**
 * Unified detail facts for EntityHero (rank / 시가 box).
 *
 * - Weekly pack: KPOP / 음원 / 스타 / 영화 / 웹툰 / 공연 / 전시팝업
 *   (delegates to entertainment-facts.ts)
 * - Daily pack: 유튜브(엔터·정치), 이슈·뉴스 링크(정치 키워드·주식·물가 등),
 *   도서, 맛집, 주말 나들이
 *
 * Daily catalogues are reviewed once per day; bump DETAIL_FACTS_DAILY_CHECKED_AT
 * when editors refresh rows.
 */

import { entityNarrativeSummary } from "@/lib/entity/index-blurb";
import {
  entertainmentFactsAreStale,
  listStaleEntertainmentProfiles,
  resolveEntertainmentFacts,
  type EntertainmentFacts,
} from "@/lib/boards/entertainment-facts";
import { FOOD_RESTAURANT_SLUG, WEEKEND_OUTING_SLUG } from "@/lib/boards/region-catalogs";
import { parseBracketLabel } from "@/lib/politics/labeled-rank";
import { matchPoliticsYoutubeSeed } from "@/lib/politics/youtube-seeds";
import type { EntityType, RankingEntity } from "@/lib/types";

export type DetailFactRow = { label: string; value: string; href?: string };

export type DetailFacts = {
  domain:
    | EntertainmentFacts["domain"]
    | "youtube"
    | "issue_news"
    | "book"
    | "food"
    | "outing";
  /** daily=1d · every3days=웹툰·도서·유튜브 · weekly=연예 큐레이션 */
  refresh: "daily" | "every3days" | "weekly";
  rows: DetailFactRow[];
  chips?: Array<{ label: string; items: string[] }>;
  links?: Array<{ title: string; href: string }>;
  synopsis?: string;
  notice?: string;
  checkedAt: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const THREE_DAY_MS = 3 * DAY_MS;

/** Bump when editors refresh the daily / 3-day catalogue. */
export const DETAIL_FACTS_DAILY_CHECKED_AT = "2026-09-14T09:00:00+09:00";

export function detailFactsAreStale(
  facts: Pick<DetailFacts, "checkedAt" | "refresh">,
  now = Date.now(),
): boolean {
  if (facts.refresh === "weekly") {
    return entertainmentFactsAreStale(facts.checkedAt, now);
  }
  const ts = Date.parse(facts.checkedAt);
  if (!Number.isFinite(ts)) return true;
  const window = facts.refresh === "every3days" ? THREE_DAY_MS : DAY_MS;
  return now - ts > window;
}

function compact(value: string): string {
  return value.replace(/\s+/g, "").replace(/[·._\-'"‘’“”]/g, "").toLowerCase();
}

function scoreName(name: string, title: string): number {
  const a = compact(name);
  const b = compact(title);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  return 0;
}

function naverNewsUrl(query: string): string {
  return `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
}

function newsLinks(name: string, extras: string[] = []): Array<{ title: string; href: string }> {
  const queries = [`${name}`, ...extras.map((x) => `${name} ${x}`)].slice(0, 5);
  return queries.map((q, i) => ({
    title: i === 0 ? `${name} 관련 최신 뉴스` : `${name} · ${extras[i - 1] ?? "관련"}`,
    href: naverNewsUrl(q),
  }));
}

type DailyEntry = {
  title: string;
  aliases?: string[];
  domain: "youtube" | "issue_news" | "book" | "food" | "outing";
  rows: DetailFactRow[];
  chips?: Array<{ label: string; items: string[] }>;
  links?: Array<{ title: string; href: string }>;
  synopsis?: string;
  notice?: string;
  checkedAt?: string;
};

function youtubeSearchUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name)}`;
}

const DAILY_CATALOG: DailyEntry[] = [
  {
    title: "침착맨",
    aliases: ["침투부"],
    domain: "youtube",
    rows: [
      { label: "채널 URL", value: "유튜브에서 채널 확인", href: youtubeSearchUrl("침착맨") },
      { label: "최근 이슈 영상", value: "침착맨 최신 업로드 (채널에서 확인)" },
    ],
    links: [
      { title: "침착맨 유튜브 검색", href: youtubeSearchUrl("침착맨") },
      { title: "침착맨 관련 뉴스", href: naverNewsUrl("침착맨") },
      { title: "침착맨 화제 영상", href: naverNewsUrl("침착맨 유튜브") },
    ],
  },
  {
    title: "피식대학",
    domain: "youtube",
    rows: [
      { label: "채널 URL", value: "유튜브에서 채널 확인", href: youtubeSearchUrl("피식대학") },
      { label: "최근 이슈 영상", value: "피식대학 최신 스케치 (채널에서 확인)" },
    ],
    links: newsLinks("피식대학", ["유튜브", "스케치"]),
  },
  {
    title: "문명특급",
    domain: "youtube",
    rows: [
      { label: "채널 URL", value: "유튜브에서 채널 확인", href: youtubeSearchUrl("문명특급") },
      { label: "최근 이슈 영상", value: "문명특급 최신 인터뷰 (채널에서 확인)" },
    ],
    links: newsLinks("문명특급", ["유튜브", "인터뷰"]),
  },
  {
    title: "워크맨",
    domain: "youtube",
    rows: [
      { label: "채널 URL", value: "유튜브에서 채널 확인", href: youtubeSearchUrl("워크맨") },
      { label: "최근 이슈 영상", value: "워크맨 직업체험 최신화 (채널에서 확인)" },
    ],
    links: newsLinks("워크맨", ["유튜브", "직장"]),
  },
  {
    title: "보겸",
    domain: "youtube",
    rows: [
      { label: "채널 URL", value: "유튜브에서 채널 확인", href: youtubeSearchUrl("보겸") },
      { label: "최근 이슈 영상", value: "보겸 TV 최신 업로드 (채널에서 확인)" },
    ],
    links: newsLinks("보겸", ["유튜브", "이슈"]),
  },
  {
    title: "쯔양",
    domain: "youtube",
    rows: [
      { label: "채널 URL", value: "유튜브에서 채널 확인", href: youtubeSearchUrl("쯔양") },
      { label: "최근 이슈 영상", value: "쯔양 먹방 최신화 (채널에서 확인)" },
    ],
    links: newsLinks("쯔양", ["먹방", "유튜브"]),
  },
  {
    title: "김어준의 겸손은 힘들다 뉴스공장",
    aliases: ["김어준", "뉴스공장", "김어준TV"],
    domain: "youtube",
    rows: [
      {
        label: "채널 URL",
        value: "youtube.com/channel/UCAAvO0ehWox1bbym3rXKBZw",
        href: "https://www.youtube.com/channel/UCAAvO0ehWox1bbym3rXKBZw",
      },
      { label: "최근 이슈 영상", value: "뉴스공장 최신 방송분 (채널에서 확인)" },
    ],
    links: newsLinks("김어준 뉴스공장", ["유튜브", "시사"]),
  },
  {
    title: "매불쇼",
    domain: "youtube",
    rows: [
      {
        label: "채널 URL",
        value: "유튜브 검색 · 매불쇼",
        href: "https://www.youtube.com/results?search_query=%EB%A7%A4%EB%B6%88%EC%87%BC",
      },
      { label: "최근 이슈 영상", value: "매불쇼 최신 회차 (채널에서 확인)" },
    ],
    links: newsLinks("매불쇼", ["유튜브", "시사"]),
  },
  {
    title: "신의한수",
    domain: "youtube",
    rows: [
      {
        label: "채널 URL",
        value: "유튜브 검색 · 신의한수",
        href: "https://www.youtube.com/results?search_query=%EC%8B%A0%EC%9D%98%ED%95%9C%EC%88%98",
      },
      { label: "최근 이슈 영상", value: "신의한수 최신 이슈 영상 (채널에서 확인)" },
    ],
    links: newsLinks("신의한수", ["유튜브", "시사"]),
  },
  {
    title: "마흔에 읽는 쇼펜하우어",
    domain: "book",
    rows: [
    ],
    chips: [{ label: "작가 필모그래피", items: ["마흔에 읽는 니체", "철학 에세이 시리즈"] }],
    links: newsLinks("마흔에 읽는 쇼펜하우어", ["베스트셀러", "서평", "인터뷰"]),
    synopsis: "쇼펜하우어 철학을 중년의 시선으로 풀어낸 교양 에세이.",
  },
  {
    title: "세이노의 가르침",
    aliases: ["세이노의-가르침"],
    domain: "book",
    rows: [
    ],
    chips: [{ label: "작가 필모그래피", items: ["세이노 칼럼", "경제·자기계발 에세이"] }],
    links: newsLinks("세이노의 가르침", ["베스트셀러", "서평", "추천"]),
    synopsis: "일과 돈, 태도를 직설적으로 다룬 장기 베스트셀러.",
  },
  {
    title: "역행자",
    domain: "book",
    rows: [
    ],
    chips: [{ label: "작가 필모그래피", items: ["역행자 확장판", "자기계발 강의"] }],
    links: newsLinks("역행자", ["자청", "베스트셀러", "서평"]),
    synopsis: "부의 습관과 시스템을 강조한 자기계발서.",
  },
  {
    title: "도둑맞은 집중력",
    domain: "book",
    rows: [
    ],
    chips: [{ label: "작가 필모그래피", items: ["죽은 경찰들의 사회", "치유"] }],
    links: newsLinks("도둑맞은 집중력", ["서평", "집중력", "디지털"]),
    synopsis: "디지털 환경이 집중력을 잠식하는 구조를 취재한 논픽션.",
  },
  {
    title: "[서울] 광장시장 마약김밥",
    aliases: ["광장시장 마약김밥", "서울-광장시장-마약김밥"],
    domain: "food",
    rows: [
      { label: "추천 맛집", value: "광장시장 마약김밥 골목 대표 노포" },
      { label: "추천 메뉴", value: "마약김밥, 빈대떡, 육회" },
      { label: "주소", value: "서울 종로구 창경궁로 88 광장시장 일대" },
      { label: "영업시간", value: "보통 09:00–21:00 (가게별 상이)" },
    ],
    notice: "영업시간·메뉴·주소는 매장 사정에 따라 변경될 수 있습니다. 방문 전 공식 채널·지도 앱을 확인하세요.",
  },
  {
    title: "[서울] 성수동",
    aliases: ["성수동 맛집", "성수 맛집"],
    domain: "food",
    rows: [
      { label: "추천 맛집", value: "성수다락 · 어니언 성수 · 소문난성수감자탕" },
      { label: "추천 메뉴", value: "수제버거, 소금빵, 감자탕" },
      { label: "주소", value: "서울 성동구 성수동 일대" },
      { label: "영업시간", value: "매장별 상이 (보통 11:00–21:00)" },
    ],
    notice: "영업시간·메뉴·주소는 매장 사정에 따라 변경될 수 있습니다. 방문 전 공식 채널을 확인하세요.",
  },
  {
    title: "[부산] 해운대",
    aliases: ["해운대 맛집"],
    domain: "food",
    rows: [
      { label: "추천 맛집", value: "해운대암소갈비집 · 금수복국 · 해운대 소문난 돼지국밥" },
      { label: "추천 메뉴", value: "갈비, 복국, 돼지국밥" },
      { label: "주소", value: "부산 해운대구 해운대해변로 일대" },
      { label: "영업시간", value: "매장별 상이 (보통 10:00–22:00)" },
    ],
    notice: "성수기·주말에는 웨이팅이 길 수 있습니다. 영업시간과 주차 정보를 사전 확인하세요.",
  },
  {
    title: "[서울] 한강공원",
    aliases: ["한강공원", "여의도한강공원", "서울-한강공원"],
    domain: "outing",
    rows: [
      { label: "주소", value: "서울 영등포구 여의동로 일대 (여의도한강공원 등)" },
      { label: "운영시간", value: "상시 개방 (일부 시설 09:00–21:00)" },
      { label: "입장료", value: "공원 무료 / 자전거·매점 유료" },
      { label: "교통", value: "여의나루역·여의도역 도보" },
    ],
    notice: "기상·행사에 따라 일부 구역이 통제될 수 있습니다. 야간 음주·취사는 규정을 확인하세요.",
  },
  {
    title: "[경기] 에버랜드",
    aliases: ["에버랜드", "경기-에버랜드"],
    domain: "outing",
    rows: [
      { label: "주소", value: "경기 용인시 처인구 포곡읍 에버랜드로 199" },
      { label: "운영시간", value: "시즌별 상이 (보통 10:00–21:00)" },
      { label: "입장료", value: "종일권 기준 공식 홈페이지 요금" },
      { label: "주차", value: "단지 내 유료 주차장" },
    ],
    notice: "운영시간·어트랙션 점검은 공식 앱/홈페이지 공지를 우선하세요.",
  },
  {
    title: "[강원] 남이섬",
    aliases: ["남이섬", "강원-남이섬"],
    domain: "outing",
    rows: [
      { label: "주소", value: "강원 춘천시 남산면 남이섬길 1" },
      { label: "운영시간", value: "선박 운항 07:30–21:40대 (계절별 상이)" },
      { label: "입장료", value: "섬 입장+선박 패키지 (공식 요금)" },
      { label: "교통", value: "가평역·남이섬 선착장 연계" },
    ],
    notice: "선박 운항은 기상·계절에 따라 변경됩니다. 공식 예매·운항 정보를 확인하세요.",
  },
];

const DAILY_TYPE_DOMAIN: Partial<Record<EntityType, DetailFacts["domain"]>> = {
  influencer: "youtube",
  political_influencer: "youtube",
  political_search: "issue_news",
  stock_market: "issue_news",
  overseas_stock: "issue_news",
  startup_franchise: "issue_news",
  inflation: "issue_news",
  book: "book",
  restaurant: "food",
  outing: "outing",
};

const DAILY_SLUG_DOMAIN: Array<{ test: (slug: string) => boolean; domain: DetailFacts["domain"] }> = [
  { test: (s) => s.startsWith("entertain-youtuber-ranking"), domain: "youtube" },
  { test: (s) => s.startsWith("political-influencer-power"), domain: "youtube" },
  { test: (s) => s.startsWith("policy-controversy-index"), domain: "issue_news" },
  { test: (s) => s.startsWith("kospi-fomo-index"), domain: "issue_news" },
  { test: (s) => s.startsWith("overseas-stock-index"), domain: "issue_news" },
  { test: (s) => s.startsWith("startup-franchise-index"), domain: "issue_news" },
  { test: (s) => s.startsWith("inflation-sentiment-index"), domain: "issue_news" },
  { test: (s) => s.startsWith("bestseller-surge-index"), domain: "book" },
  { test: (s) => s.startsWith(FOOD_RESTAURANT_SLUG), domain: "food" },
  { test: (s) => s.startsWith(WEEKEND_OUTING_SLUG), domain: "outing" },
];

/** Prefer board slug over entity type — keyword placeholders often default to celebrity. */
function dailyDomainOf(
  entity: Pick<RankingEntity, "type" | "slug" | "heatmapGroup">,
): DetailFacts["domain"] | undefined {
  const slug = entity.slug ?? "";
  for (const row of DAILY_SLUG_DOMAIN) {
    if (row.test(slug)) return row.domain;
  }
  const fromType = DAILY_TYPE_DOMAIN[entity.type];
  if (fromType) return fromType;
  const group = entity.heatmapGroup ?? "";
  if (/유튜브|유튜버/.test(group)) return "youtube";
  if (/이슈\s*키워드|핫\s*키워드/.test(group)) return "issue_news";
  if (/주식|물가|창업|소상공/.test(group)) return "issue_news";
  if (/도서|베스트셀러/.test(group)) return "book";
  if (/맛집|음식/.test(group)) return "food";
  if (/나들이|주말/.test(group)) return "outing";
  return undefined;
}

function lookupDaily(name: string, domain: DetailFacts["domain"]): DailyEntry | undefined {
  let best: DailyEntry | undefined;
  let bestScore = 0;
  for (const entry of DAILY_CATALOG) {
    if (entry.domain !== domain) continue;
    let score = scoreName(name, entry.title);
    for (const alias of entry.aliases ?? []) {
      score = Math.max(score, scoreName(name, alias));
    }
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return bestScore >= 80 ? best : undefined;
}

function youtubeFallback(name: string): DetailFacts {
  const seed = matchPoliticsYoutubeSeed(name);
  const hasId = Boolean(seed?.channelId && /^UC[\w-]{20,}$/.test(seed.channelId));
  const href = hasId
    ? `https://www.youtube.com/channel/${seed!.channelId}`
    : youtubeSearchUrl(name);
  return {
    domain: "youtube",
    refresh: "every3days",
    checkedAt: DETAIL_FACTS_DAILY_CHECKED_AT,
    rows: [
      {
        label: "채널 URL",
        value: hasId ? `youtube.com/channel/${seed!.channelId}` : "유튜브에서 채널 확인",
        href,
      },
      { label: "최근 이슈 영상", value: `${name} 최신 업로드·화제 영상 (채널에서 확인)` },
    ],
    links: [
      { title: `${name} 채널/검색`, href },
      { title: `${name} 관련 뉴스`, href: naverNewsUrl(name) },
      { title: `${name} 화제 영상 이슈`, href: naverNewsUrl(`${name} 유튜브`) },
      { title: `${name} 최신 클립`, href: naverNewsUrl(`${name} 영상`) },
    ],
    synopsis: `${name} 채널 URL과 최근 이슈 영상 정보는 관련 채널에서 확인하세요.`,
  };
}

function issueNewsFallback(name: string): DetailFacts {
  const links = newsLinks(name, ["속보", "해설", "여론", "시장"]);
  return {
    domain: "issue_news",
    refresh: "daily",
    checkedAt: DETAIL_FACTS_DAILY_CHECKED_AT,
    rows: [
      { label: "관련 뉴스", value: `최신 기사 ${links.length}건 링크` },
      { label: "검색 키워드", value: name },
    ],
    links,
    synopsis: `${name} 관련 최근 뉴스 링크를 함께 모았습니다.`,
  };
}

function bookFallback(name: string): DetailFacts {
  return {
    domain: "book",
    refresh: "every3days",
    checkedAt: DETAIL_FACTS_DAILY_CHECKED_AT,
    // Rows live in 맞춤 정보 table — keep hero to synopsis + links to avoid duplication.
    rows: [],
    chips: [],
    links: newsLinks(name, ["서평", "베스트셀러", "인터뷰"]),
    synopsis: `${name}의 작가·출판사·서점 정보는 아래 맞춤 정보 표에서 확인하세요.`,
  };
}

function foodFallback(name: string): DetailFacts {
  const bracket = parseBracketLabel(name);
  const place = bracket?.subject ?? name;
  const region = bracket?.org;
  return {
    domain: "food",
    refresh: "daily",
    checkedAt: DETAIL_FACTS_DAILY_CHECKED_AT,
    rows: [
      { label: "추천 맛집", value: `${place} 인기 맛집 (로컬 랭킹 기준)` },
      { label: "추천 메뉴", value: "대표 메뉴는 매장 공지 기준" },
      { label: "주소", value: region ? `${region} ${place} 일대` : `${place} 일대` },
      { label: "영업시간", value: "매장별 상이 — 방문 전 확인" },
    ],
    notice:
      "맛집 정보(주소·영업시간·메뉴)는 사정에 따라 변경될 수 있습니다. 반드시 공식 채널·지도 앱으로 재확인하세요.",
    synopsis: `${place} 맛집 추천 포인트입니다. 방문 전 영업시간을 확인해 주세요.`,
  };
}

function outingFallback(name: string): DetailFacts {
  const bracket = parseBracketLabel(name);
  const place = bracket?.subject ?? name;
  const region = bracket?.org;
  return {
    domain: "outing",
    refresh: "daily",
    checkedAt: DETAIL_FACTS_DAILY_CHECKED_AT,
    rows: [
      { label: "주소", value: region ? `${region} ${place}` : place },
      { label: "운영시간", value: "시설·계절별 상이 (공식 공지 확인)" },
      { label: "입장료", value: "무료~유료 (시설별)" },
      { label: "참고", value: "주차·혼잡·기상 영향 가능" },
    ],
    notice:
      "행사장 운영시간·입장료·통제 구간은 수시로 바뀔 수 있습니다. 방문 전 공식 홈페이지·안내 센터를 확인하세요.",
    synopsis: `${place} 나들이 포인트입니다. 운영시간·주차는 현장 공지를 확인해 주세요.`,
  };
}

function fromEntertainment(facts: EntertainmentFacts): DetailFacts {
  return {
    domain: facts.domain,
    refresh: "weekly",
    rows: facts.rows,
    chips: facts.chips,
    synopsis: facts.synopsis,
    checkedAt: facts.checkedAt,
  };
}

function resolveDailyFacts(
  entity: Pick<RankingEntity, "name" | "type" | "slug" | "tags" | "summary" | "heatmapGroup">,
): DetailFacts | undefined {
  const domain = dailyDomainOf(entity);
  if (
    !domain ||
    (domain !== "youtube" &&
      domain !== "issue_news" &&
      domain !== "book" &&
      domain !== "food" &&
      domain !== "outing")
  ) {
    return undefined;
  }

  const hit = lookupDaily(entity.name, domain);
  if (hit) {
    const refresh =
      domain === "book" || domain === "youtube" ? "every3days" : "daily";
    return {
      domain,
      refresh,
      rows: hit.rows,
      chips: hit.chips?.map((c) => ({ ...c, items: c.items.filter(Boolean) })),
      links: hit.links?.slice(0, 5),
      synopsis: hit.synopsis ?? entityNarrativeSummary(entity),
      notice: hit.notice,
      checkedAt: hit.checkedAt ?? DETAIL_FACTS_DAILY_CHECKED_AT,
    };
  }

  switch (domain) {
    case "youtube":
      return youtubeFallback(entity.name);
    case "issue_news":
      return issueNewsFallback(entity.name);
    case "book":
      return bookFallback(entity.name);
    case "food":
      return foodFallback(entity.name);
    case "outing":
      return outingFallback(entity.name);
  }
}

/** EntityHero entry — daily board packs win over weekly entertainment when both match. */
export function resolveDetailFacts(
  entity: Pick<RankingEntity, "name" | "type" | "slug" | "tags" | "summary" | "heatmapGroup">,
): DetailFacts | undefined {
  const daily = resolveDailyFacts(entity);
  if (daily) return daily;
  const entertainment = resolveEntertainmentFacts(entity);
  if (entertainment) return fromEntertainment(entertainment);
  return undefined;
}

export function listStaleDailyDetailProfiles(now = Date.now()): string[] {
  const stale: string[] = [];
  if (detailFactsAreStale({ checkedAt: DETAIL_FACTS_DAILY_CHECKED_AT, refresh: "daily" }, now)) {
    stale.push(`catalogue:${DETAIL_FACTS_DAILY_CHECKED_AT}`);
  }
  for (const entry of DAILY_CATALOG) {
    const checkedAt = entry.checkedAt ?? DETAIL_FACTS_DAILY_CHECKED_AT;
    const refresh =
      entry.domain === "book" || entry.domain === "youtube" ? "every3days" : "daily";
    if (detailFactsAreStale({ checkedAt, refresh }, now)) {
      stale.push(`${entry.domain}:${entry.title}`);
    }
  }
  return stale;
}

export { listStaleEntertainmentProfiles };
