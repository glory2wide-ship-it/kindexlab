import type {
  CategoryInfoChannel,
  CategoryInfoLink,
} from "@/lib/entity/category-info/types";

export function naverNewsUrl(query: string): string {
  return `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
}

export function naverWebUrl(query: string): string {
  return `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`;
}

export function naverBlogUrl(query: string): string {
  return `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(query)}`;
}

/** True for aggregator / in-site search URLs — not press article permalinks. */
export function isNewsSearchFallbackUrl(href: string): boolean {
  try {
    const host = new URL(href).hostname.toLowerCase();
    const path = new URL(href).pathname.toLowerCase();
    if (host.includes("search.naver.com")) return true;
    if (host.includes("news.google.com") && path.includes("/search")) return true;
    if (host.includes("google.com") && path.includes("/search")) return true;
    if (host.includes("search.daum.net")) return true;
    return false;
  } catch {
    return true;
  }
}

/**
 * Channel-scoped sense for related-news retrieval.
 * Homonyms (나이트런=웹툰 vs 야간러닝, 반도체=테마주 vs 일반 산업 잡보) need
 * on-sense markers; bare entity-name overlap is not enough.
 */
type ChannelNewsSense = {
  /** Appended to crawl/search queries. */
  queryHint: string;
  /** Title/snippet must look on-topic when present. */
  onSense: RegExp;
  /** Hard reject when present without onSense. */
  offSense?: RegExp;
  /** When true, entity-name hit alone is not enough — need onSense (or score→0). */
  requireOnSense?: boolean;
};

const CHANNEL_NEWS_SENSE: Partial<Record<CategoryInfoChannel, ChannelNewsSense>> = {
  webtoon: {
    queryHint: "웹툰",
    onSense: /웹툰|웹소설|만화|연재|회차|작가|네이버\s*웹툰|카카오(페이지|웹툰)?|컷툰|원작/,
    offSense:
      /야간\s*(러닝|조깅|런)|나이트\s*런(?!\s*웹툰)|마라톤|조깅|축구|야구|야간\s*훈련|군사\s*훈련|나이트클럽|클럽\s*나이트|야간\s*영업|심야\s*영업/,
    requireOnSense: true,
  },
  movie: {
    queryHint: "영화",
    onSense: /영화|개봉|박스오피스|관객|감독|배우|극장|스크린|OTT/,
    offSense: /구독자\s*(이탈|탈주)|구독\s*취소/,
    requireOnSense: true,
  },
  book: {
    queryHint: "도서",
    onSense: /책|도서|베스트셀러|저자|출판|소설|에세이|서점/,
    requireOnSense: true,
  },
  game: {
    queryHint: "게임",
    onSense:
      /게임|모바일\s*게임|앱게임|스팀|Steam|닌텐도|플레이스테이션|Xbox|출시|업데이트|패치|쿠폰|뽑기|가챠|랭킹|매출|플레이/i,
    offSense:
      /아이돌|뉴진스|빌보드|트로트|웹툰|드라마\s*PDF|영어\s*문법|지식인\s*답변|교회|설교|연예\s*뉴스/,
    requireOnSense: true,
  },
  kpop: {
    queryHint: "아이돌",
    onSense: /아이돌|그룹|컴백|팬덤|앨범|뮤직|가수|케이팝|K-?POP/i,
  },
  trot: {
    queryHint: "트로트",
    onSense: /트로트|가수|음원|콘서트|앨범/,
  },
  star: {
    queryHint: "연예",
    onSense: /배우|가수|연예|배우|드라마|영화|예능|화보/,
  },
  music: {
    queryHint: "음원",
    onSense: /음원|차트|멜론|스트리밍|앨범|노래|가수/,
  },
  tv_ratings: {
    queryHint: "시청률",
    onSense: /시청률|방송|드라마|예능|편성|닐슨/,
  },
  stock: {
    queryHint: "주식",
    onSense: /주식|주가|시총|증시|증권|코스피|코스닥|실적|ETF|테마주|관련주/,
    requireOnSense: true,
  },
  overseas_stock: {
    queryHint: "주식",
    onSense: /주식|주가|시총|나스닥|S&P|실적|ADR|관련주|테마주/,
    requireOnSense: true,
  },
  finance: {
    queryHint: "금융",
    onSense: /금리|예금|대출|금융|은행|적금|펀드/,
  },
  gov_subsidy: {
    queryHint: "지원금",
    onSense: /지원금|지원사업|공고|신청|바우처|자격|보조금/,
  },
  travel_grant: {
    queryHint: "지원금",
    onSense: /지원금|지원사업|공고|신청|바우처|여행/,
  },
  performance: {
    queryHint: "공연",
    onSense: /공연|뮤지컬|연극|티켓|예매|콘서트/,
  },
  exhibition: {
    queryHint: "전시",
    onSense: /전시|팝업|미술관|갤러리|입장/,
  },
  food: {
    queryHint: "맛집",
    onSense: /맛집|음식|메뉴|식당|리뷰|미쉐린/,
  },
  youtuber: {
    queryHint: "유튜브",
    onSense: /유튜브|유튜버|구독자|채널|영상/,
  },
  politics_youtube: {
    queryHint: "유튜브",
    onSense: /유튜브|유튜버|구독자|채널|영상|시사/,
  },
  political_pundit: {
    queryHint: "평론",
    onSense: /평론|칼럼|시사|토론|방송|출연/,
  },
  housing: {
    queryHint: "부동산",
    onSense: /아파트|부동산|분양|전세|실거래|청약/,
  },
};

/** Latin tokens too short/common to prove entity overlap (e.g. GO in MONOPOLY GO!). */
const WEAK_ENTITY_TOKENS = new Set([
  "go",
  "the",
  "and",
  "for",
  "app",
  "inc",
  "ltd",
  "co",
  "of",
  "to",
  "in",
  "on",
  "vs",
  "pdf",
  "new",
  "pro",
]);

function entityNameTokens(entityName: string): string[] {
  const needle = entityName.replace(/\s+/g, "").replace(/^\[[^\]]+\]/, "");
  const raw = needle.match(/[가-힣A-Za-z0-9]{2,}/g) ?? [];
  return raw.filter((token) => {
    if (/^[A-Za-z]+$/.test(token)) {
      if (token.length < 3) return false;
      if (WEAK_ENTITY_TOKENS.has(token.toLowerCase())) return false;
    }
    return token.length >= 2;
  });
}

/** Search / crawl query with channel sense suffix (e.g. "나이트런 웹툰"). */
export function newsQueryForChannel(
  name: string,
  channel?: CategoryInfoChannel,
): string {
  const cleaned = name.replace(/^\[[^\]]+\]\s*/, "").trim() || name.trim();
  const sense = channel ? CHANNEL_NEWS_SENSE[channel] : undefined;
  if (!sense?.queryHint) return cleaned;
  if (cleaned.includes(sense.queryHint)) return cleaned;
  return `${cleaned} ${sense.queryHint}`;
}

/**
 * Score a candidate news link for title · entity · domain trust · channel sense.
 * Used across all channels (same spirit as 보조금24 host/title checks).
 */
export function scoreNewsLinkQuality(
  link: CategoryInfoLink,
  entityName: string,
  channel?: CategoryInfoChannel,
): number {
  if (!link.href || isNewsSearchFallbackUrl(link.href)) return 0;
  let host = "";
  let path = "";
  try {
    const url = new URL(link.href);
    host = url.hostname.toLowerCase().replace(/^www\./, "");
    path = url.pathname.toLowerCase();
  } catch {
    return 0;
  }
  // Off-topic Naver product landings (메이트·페이·파파고 등)
  if (
    host === "mate.naver.com" ||
    host.endsWith(".mate.naver.com") ||
    /mate\.naver\.com|네이버\s*메이트|Naver\s*Mate/i.test(
      `${link.title} ${link.source ?? ""} ${link.href}`,
    )
  ) {
    return 0;
  }
  // Knowledge-in profiles, random PDF dumps, translator landings — not entity news.
  if (/kin\.naver\.com/i.test(host) && /\/profile\//.test(path)) return 0;
  if (/papago\.naver\.com|dict\.naver\.com|mail\.naver\.com|pay\.naver\.com/i.test(host)) {
    return 0;
  }
  const title = `${link.title} ${link.source ?? ""}`;
  const compactTitle = title.replace(/\s+/g, "");
  const needle = entityName.replace(/\s+/g, "").replace(/^\[[^\]]+\]/, "");
  const tokens = entityNameTokens(entityName);
  let score = 1;

  // Entity overlap in title (ignore weak tokens like "GO")
  const hasEntity =
    (needle.length >= 3 && compactTitle.toLowerCase().includes(needle.toLowerCase())) ||
    tokens.some((t) => t.length >= 2 && compactTitle.toLowerCase().includes(t.toLowerCase()));
  if (needle.length >= 3 && compactTitle.toLowerCase().includes(needle.toLowerCase())) score += 4;
  else if (tokens.some((t) => compactTitle.toLowerCase().includes(t.toLowerCase()))) score += 2;

  // Without entity proof, unrelated press/blog links must not fill the slot.
  if (!hasEntity) {
    // Allow only strong official hosts that still need channel sense below.
    score = Math.min(score, 1);
  }

  // Channel sense — reject homonym / off-topic hits
  const sense = channel ? CHANNEL_NEWS_SENSE[channel] : undefined;
  if (sense) {
    const on = sense.onSense.test(title);
    const off = sense.offSense?.test(title) ?? false;
    if (off && !on) return 0;
    if (sense.requireOnSense && !on) return 0;
    if (on) score += 3;
  }

  // Known press / official domains
  if (
    /\.(co\.kr|com|net|org)$/i.test(host) &&
    !/blog\.|tistory\.|cafe\.|instagram\.|facebook\.|kin\.naver/i.test(host)
  ) {
    score += 1;
  }
  if (/\.go\.kr$|\.gov\.kr$/i.test(host)) score += 2;
  if (
    /yna\.co\.kr|chosun\.|joongang\.|donga\.|hani\.|khan\.|mt\.co\.kr|hankyung\.|mk\.co\.kr|sedaily\.|seoul\.co\.kr|ytn\.|sbs\.|kbs\.|mbc\./i.test(
      host,
    )
  ) {
    score += 2;
  }
  // Platform hosts that prove on-sense for webtoon / book / game
  if (channel === "webtoon" && /comic\.naver\.|webtoon\.|page\.kakao\./i.test(host)) {
    score += 4;
  }
  if (channel === "book" && /kyobobook\.|yes24\.|aladin\.|npage\./i.test(host)) {
    score += 3;
  }
  if (
    channel === "game" &&
    /steampowered\.|store\.steampowered\.|playstation\.|xbox\.|nintendo\.|apps\.apple\.|play\.google\./i.test(
      host,
    )
  ) {
    score += 4;
  }

  // Claimed source vs host disagreement (보조금24-style)
  const claimsGov = /보조금\s*24|정부24|gov\.kr/i.test(title);
  const claimsWelfare = /복지로|bokjiro/i.test(title);
  if (claimsGov && !/(^|\.)gov\.kr$/i.test(host) && !host.endsWith(".go.kr")) return 0;
  if (claimsWelfare && !/bokjiro\.go\.kr$/i.test(host) && !host.endsWith(".go.kr")) return 0;

  // Thin / generic titles / URL chrome used as titles
  if (link.title.length < 8) score -= 1;
  if (/관련 뉴스|검색 결과|네이버 뉴스/.test(link.title)) score -= 2;
  if (/\.go\.kr|\.co\.kr|\.com|\.org|›|PDF$/i.test(link.title) && !hasEntity) return 0;

  // Final gate: real article slots need entity overlap (search fallbacks scored 0 already).
  if (!hasEntity && score < 5) return 0;

  return Math.max(0, score);
}

/**
 * Related-news placeholders. Prefer empty here — enrich fills real article URLs.
 * At most one Naver search fallback is attached later via ensureQualityNewsLinks.
 */
export function buildRelatedNewsLinks(
  name: string,
  extras: string[] = ["속보", "이슈", "해설"],
  options?: { includeWeb?: boolean; includeBlog?: boolean },
): CategoryInfoLink[] {
  void name;
  void extras;
  void options;
  return [];
}

/**
 * Keep real article links; allow at most one search fallback.
 * Prefer 1–2 quality press URLs over padding to 3 with search pages.
 * When under-filled, label the fallback as “추가 수집 중”.
 */
export function ensureQualityNewsLinks(
  name: string,
  links: CategoryInfoLink[],
  options?: {
    maxSearchFallbacks?: number;
    minPreferred?: number;
    channel?: CategoryInfoChannel;
  },
): CategoryInfoLink[] {
  const maxSearch = options?.maxSearchFallbacks ?? 1;
  const minPreferred = options?.minPreferred ?? 1;
  const channel = options?.channel;
  const scored = links
    .filter((link) => link.href)
    .map((link) => ({ link, score: scoreNewsLinkQuality(link, name, channel) }))
    .sort((a, b) => b.score - a.score);

  const real: CategoryInfoLink[] = [];
  const search: CategoryInfoLink[] = [];
  const seen = new Set<string>();
  for (const { link, score } of scored) {
    if (seen.has(link.href)) continue;
    seen.add(link.href);
    if (isNewsSearchFallbackUrl(link.href) || score === 0) {
      if (isNewsSearchFallbackUrl(link.href)) search.push(link);
      continue;
    }
    if (score >= 2) real.push(link);
  }
  // Also keep lower-score real permalinks if we are thin
  if (real.length < 2) {
    for (const { link, score } of scored) {
      if (seen.has(`kept:${link.href}`)) continue;
      if (isNewsSearchFallbackUrl(link.href) || score === 0) continue;
      if (real.some((r) => r.href === link.href)) continue;
      real.push(link);
      if (real.length >= 2) break;
    }
  }

  const out = [...real.slice(0, 5)];
  // Title fingerprint dedupe — same headline via different hosts must appear once.
  const deduped: CategoryInfoLink[] = [];
  const seenTitles = new Set<string>();
  for (const link of out) {
    const key = link.title
      .replace(/\s+/g, "")
      .replace(/[^\w가-힣]/g, "")
      .toLowerCase();
    if (key.length >= 8 && seenTitles.has(key)) continue;
    if (key.length >= 8) seenTitles.add(key);
    deduped.push(link);
  }
  const needFallback = deduped.length < minPreferred && maxSearch > 0;
  if (needFallback || (deduped.length === 0 && maxSearch > 0)) {
    const searchQuery = newsQueryForChannel(name, channel);
    const fallback =
      search[0] ??
      ({
        title:
          deduped.length > 0
            ? `${name} 추가 수집 중 · 뉴스 검색`
            : `${name} 관련 뉴스 추가 수집 중`,
        href: naverNewsUrl(searchQuery),
        source: "뉴스 검색",
      } satisfies CategoryInfoLink);
    if (!deduped.some((l) => l.href === fallback.href)) {
      deduped.push({
        ...fallback,
        title: fallback.title.includes("추가 수집")
          ? fallback.title
          : `${name} 추가 수집 중 · 뉴스 검색`,
        href: isNewsSearchFallbackUrl(fallback.href)
          ? naverNewsUrl(searchQuery)
          : fallback.href,
      });
    }
  }
  // Prefer quality 2 over forced 3 — cap soft at 5, do not pad.
  return deduped.map((link) => ({
    ...link,
    source: link.source
      ?.replace(/네이버\s*뉴스\s*검색/g, "뉴스 검색")
      .replace(/네이버/g, "")
      .replace(/\s{2,}/g, " ")
      .trim() || undefined,
  }));
}

/** @deprecated Prefer ensureQualityNewsLinks — kept for call-site compatibility. */
export function ensureMinNewsLinks(
  name: string,
  links: CategoryInfoLink[],
  min = 2,
): CategoryInfoLink[] {
  return ensureQualityNewsLinks(name, links, {
    maxSearchFallbacks: 1,
    minPreferred: Math.min(min, 2),
  });
}
