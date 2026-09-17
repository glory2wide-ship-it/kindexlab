import { crawlKeywordNewsRss } from "@/lib/context/crawl-news-rss";
import { fetchNaverWebFallback } from "@/lib/context/fallback-naver";
import { fetchYoutubeFallback } from "@/lib/context/fallback-youtube";
import type { ContextSource } from "@/lib/context/types";
import { lookupBookFacts } from "@/lib/entity/category-info/lookup-book";
import { lookupFoodFacts } from "@/lib/entity/category-info/lookup-food";
import { lookupTicketFacts } from "@/lib/entity/category-info/lookup-tickets";
import { lookupWebtoonFacts } from "@/lib/entity/category-info/lookup-webtoon";
import {
  crawlMelonSongsForArtist,
  lookupMelonSong,
  type MelonSongHit,
} from "@/lib/entity/category-info/melon";
import {
  ensureQualityNewsLinks,
  isNewsSearchFallbackUrl,
  isNonArticleMediaUrl,
  newsQueryForChannel,
  scoreNewsLinkQuality,
} from "@/lib/entity/category-info/news";
import {
  requiredLabelsForChannel,
} from "@/lib/entity/category-info/refresh-status";
import { extractMissingCategoryFields } from "@/lib/entity/category-info/llm-extract";
import {
  isUpdatingValue,
  meetsNewsSla,
  NEWS_SLA_MIN_REAL,
  realNewsLinks,
} from "@/lib/entity/category-info/trust";
import { isNewsPrimaryChannel } from "@/lib/entity/category-info/channel";
import type { CategoryInfoChannel } from "@/lib/entity/category-info/types";
import type {
  CategoryInfoLink,
  CategoryInfoPayload,
  CategoryInfoRow,
} from "@/lib/entity/category-info/types";
import type { RankingEntity } from "@/lib/types";
import { fetchText } from "@/lib/ingestion/http";
import { decodeHtml, stripTags } from "@/lib/ingestion/parse";
import { retrieveNewsForKeyword } from "@/lib/news/retrieve";
import {
  isGoogleNewsUrl,
  publisherFromUrl,
  resolvePublisherUrl,
} from "@/lib/news/unwrap";
import { matchPunditProfileSeed } from "@/lib/politics/pundit-profiles";
import {
  clearPublicDataRetry,
  recordPublicDataFailure,
} from "@/lib/public-data/fail-ledger";
import {
  isGrantServicePortalUrl,
  resolveGrantOrgHomepage,
} from "@/lib/context/official-url-seeds";
import { matchPublicGrant } from "@/lib/public-data/grants";
import { summarizeHousingPublicData } from "@/lib/public-data/housing";
import { hasDataGoKrKey } from "@/lib/public-data/key";
import type { PublicGrantRecord } from "@/lib/public-data/types";
import { lookupYoutubeChannelProfile } from "@/lib/public-data/youtube-channel";
import { entityNarrativeSummary } from "@/lib/entity/index-blurb";
import {
  extractHitSongs,
  hitSongsFromMusicChartPeers,
  pickHitSongs,
  sanitizeHitSongTitles,
} from "@/lib/entity/category-info/hit-songs";
import { readAnalysis } from "@/lib/analysis/store";
import { getRankings } from "@/lib/providers/trends";

const UPDATING = "실시간 정보 업데이트 중";

type CrawlDoc = {
  title: string;
  url: string;
  publisher?: string;
  snippet?: string;
  publishedAt?: string;
};

function plain(raw?: string): string | undefined {
  if (!raw) return undefined;
  const text = decodeHtml(stripTags(raw)).replace(/\s+/g, " ").trim();
  return text || undefined;
}

function isUpdating(value: string): boolean {
  return isUpdatingValue(value);
}

/** Reject misparsed ticket times (dates, booking %, UI chrome). */
function looksLikeBadTicketTime(value?: string): boolean {
  if (!value?.trim()) return true;
  const text = value.trim();
  if (/예매율|퍼센트|%|가격 전체|로그인|쿠키|javascript/i.test(text)) return true;
  // Date-only ranges belong in 일정, not 시간
  if (
    /\d{2,4}\s*[.년/-]\s*\d{1,2}\s*[.월/-]\s*\d{1,2}/.test(text) &&
    !/\d{1,2}\s*:\s*\d{2}/.test(text) &&
    !/[오전후]\s*\d/.test(text)
  ) {
    return true;
  }
  return false;
}

function looksLikeTicketPrice(value?: string): boolean {
  if (!value?.trim()) return false;
  const text = value.trim();
  if (/예매율|퍼센트|%/.test(text)) return false;
  if (/가격 전체|확인해 주세요|로그인/i.test(text)) return false;
  return /\d/.test(text) && /(원|석|전석|VIP|R석|S석|A석|무료|초대)/i.test(text);
}

function corpusOf(docs: CrawlDoc[]): string {
  return docs
    .map((doc) => `${doc.title} ${doc.snippet ?? ""}`)
    .join(" \n ")
    .slice(0, 12_000);
}

/** Infer ISO publish time from absolute/relative Korean or English date text. */
function inferPublishedAt(...blobs: Array<string | undefined>): string | undefined {
  for (const blob of blobs) {
    if (!blob?.trim()) continue;
    const absolute = new Date(blob);
    if (!Number.isNaN(absolute.getTime()) && absolute.getFullYear() >= 2000) {
      return absolute.toISOString();
    }
    if (/방금|조금\s*전/.test(blob)) return new Date().toISOString();
    const ko = blob.match(/(\d+)\s*(초|분|시간|일|주|개월|달)\s*전/);
    if (ko?.[1] && ko[2]) {
      const amount = Number.parseInt(ko[1], 10);
      const unitMs: Record<string, number> = {
        초: 1_000,
        분: 60_000,
        시간: 3_600_000,
        일: 86_400_000,
        주: 604_800_000,
        개월: 2_592_000_000,
        달: 2_592_000_000,
      };
      const step = unitMs[ko[2]];
      if (step) return new Date(Date.now() - amount * step).toISOString();
    }
    const en = blob.match(/(\d+)\s*(minute|hour|day|week|month)s?\s*ago/i);
    if (en?.[1] && en[2]) {
      const amount = Number.parseInt(en[1], 10);
      const unitMs: Record<string, number> = {
        minute: 60_000,
        hour: 3_600_000,
        day: 86_400_000,
        week: 604_800_000,
        month: 2_592_000_000,
      };
      const step = unitMs[en[2].toLowerCase()];
      if (step) return new Date(Date.now() - amount * step).toISOString();
    }
    const compact = blob.match(
      /(\d{4})\s*[.년/-]\s*(\d{1,2})\s*[.월/-]\s*(\d{1,2})/,
    );
    if (compact) {
      const y = Number(compact[1]);
      const m = Number(compact[2]);
      const d = Number(compact[3]);
      const date = new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  return undefined;
}

/** Drop “네이버” branding from link sources; keep destination host when possible. */
function cleanLinkSource(source: string | undefined, href: string): string | undefined {
  const host = publisherFromUrl(href);
  if (!source?.trim()) return host || undefined;
  let cleaned = source
    .replace(/네이버\s*뉴스\s*검색/g, "뉴스 검색")
    .replace(/네이버\s*웹문서/g, host || "웹문서")
    .replace(/네이버\s*블로그/g, "블로그")
    .replace(/네이버/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned || cleaned === "웹" || cleaned === "웹문서") {
    return host || cleaned || undefined;
  }
  return cleaned;
}

function displayLinkTitle(title: string, href: string): string {
  const trimmed = title.replace(/\s+/g, " ").trim();
  const looksLikeUrl =
    !trimmed ||
    /^https?:\/\//i.test(trimmed) ||
    trimmed === href ||
    /^www\./i.test(trimmed);
  if (!looksLikeUrl && trimmed.length >= 4) return trimmed.slice(0, 90);
  const host = publisherFromUrl(href);
  return host ? `${host} 문서` : "관련 웹문서";
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const hit = text.match(pattern);
    const value = hit?.[1]?.replace(/\s+/g, " ").trim();
    if (value && value.length >= 2 && value.length <= 280) return value;
  }
  return undefined;
}

function extractAgency(text: string): string | undefined {
  return firstMatch(text, [
    /소속사[:\s]*([가-힣A-Za-z0-9&.()\s]{2,40}?(?:엔터테인먼트|엔터|뮤직|Music|레이블|기획|아티스트)?)/,
    /(?:소속|계약)\s*([가-힣A-Za-z0-9&.]{2,30}(?:엔터테인먼트|엔터|뮤직))/,
  ]);
}

function extractSynopsis(docs: CrawlDoc[], name: string): string | undefined {
  for (const doc of docs) {
    const snippet = doc.snippet?.trim();
    if (!snippet || snippet.length < 40) continue;
    if (!snippet.includes(name) && !doc.title.includes(name)) continue;
    if (/등락|순위|시세|거래량/.test(snippet)) continue;
    return snippet.slice(0, 220);
  }
  return undefined;
}

function extractCast(text: string): string[] {
  const cast = new Set<string>();
  const block = firstMatch(text, [
    /(?:출연|캐스팅|출연진|등장인물)\s*[:\s]*([가-힣A-Za-z,\s·/]{4,120})/,
  ]);
  if (block) {
    for (const part of block.split(/[,·/]| 및 |와 |과 /)) {
      const name = part.trim();
      if (name.length >= 2 && name.length <= 20) cast.add(name);
      if (cast.size >= 6) break;
    }
  }
  return [...cast];
}

function extractHousingSnippet(text: string): string | undefined {
  return firstMatch(text, [
    /((?:매매|전세|월세|분양)[^\n]{0,20}?(?:\d[\d,.]*)\s*(?:억|만원|만)[^\n]{0,30})/,
    /(실거래[^\n]{0,40}?(?:\d[\d,.]*)\s*(?:억|만원)[^\n]{0,20})/,
  ]);
}

function extractPlatform(text: string): string | undefined {
  return firstMatch(text, [
    /(?:연재|공개)\s*(?:플랫폼|처)?\s*[:\s]*(네이버웹툰|카카오웹툰|카카오페이지|레진코믹스|리디|다음웹툰)/,
    /(네이버웹툰|카카오웹툰|카카오페이지|레진코믹스)/,
  ]);
}

function extractAuthor(text: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return firstMatch(text, [
    new RegExp(`${escaped}\\s*(?:작가|저자)?\\s*[:\\s]*([가-힣A-Za-z.\\s]{2,30})`),
    /(?:작가|저자|지은이)\s*[:\s]*([가-힣A-Za-z.\s]{2,30})/,
  ]);
}

function extractVenue(text: string): string | undefined {
  return firstMatch(text, [
    /(?:장소|개최\s*장소|전시장|공연장)\s*[:\s]*([가-힣A-Za-z0-9\s()]{2,40})/,
    /([가-힣A-Za-z0-9]{2,20}(?:미술관|박물관|갤러리|아트센터|공연장|체육관|돔))/,
  ]);
}

function extractFoodMeta(text: string): { address?: string; hours?: string; menu?: string } {
  return {
    address: firstMatch(text, [
      /(?:주소|위치)\s*[:\s]*([가-힣A-Za-z0-9\s\-.]{6,60})/,
      /(서울|경기|부산|대구|인천|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{4,50}/,
    ]),
    hours: firstMatch(text, [
      /(?:영업\s*시간|운영\s*시간)\s*[:\s]*([^\n.]{4,40})/,
      /(\d{1,2}\s*:\s*\d{2}\s*[~～-]\s*\d{1,2}\s*:\s*\d{2})/,
    ]),
    menu: firstMatch(text, [
      /(?:대표\s*메뉴|추천\s*메뉴|시그니처)\s*[:\s]*([가-힣A-Za-z0-9\s,/·]{2,40})/,
    ]),
  };
}

function upsertRow(rows: CategoryInfoRow[], label: string, value: string, emphasize?: boolean): CategoryInfoRow[] {
  let replaced = false;
  const next = rows.map((row) => {
    if (row.label !== label) return row;
    replaced = true;
    if (!isUpdating(row.value)) return row;
    return { ...row, value, emphasize: emphasize ?? row.emphasize };
  });
  if (!replaced) next.unshift({ label, value, emphasize });
  return next;
}

function dedupeRows(rows: CategoryInfoRow[]): CategoryInfoRow[] {
  const seen = new Set<string>();
  const out: CategoryInfoRow[] = [];
  for (const row of rows) {
    if (seen.has(row.label)) continue;
    seen.add(row.label);
    out.push(row);
  }
  return out;
}

function dedupeChips(
  chips: CategoryInfoPayload["chips"],
): CategoryInfoPayload["chips"] {
  const seen = new Set<string>();
  const out: CategoryInfoPayload["chips"] = [];
  for (const chip of chips) {
    if (!chip.items.length || seen.has(chip.label)) continue;
    seen.add(chip.label);
    out.push(chip);
  }
  return out;
}

function fillUpdatingRows(
  rows: CategoryInfoRow[],
  fillers: Array<{ label: string | RegExp; value?: string; emphasize?: boolean }>,
): CategoryInfoRow[] {
  let next = [...rows];
  for (const filler of fillers) {
    if (!filler.value) continue;
    if (typeof filler.label === "string") {
      next = upsertRow(next, filler.label, filler.value, filler.emphasize);
      continue;
    }
    const pattern = filler.label;
    next = next.map((row) =>
      pattern.test(row.label) && isUpdating(row.value)
        ? { ...row, value: filler.value!, emphasize: filler.emphasize ?? row.emphasize }
        : row,
    );
  }
  return next;
}

function forceRow(
  rows: CategoryInfoRow[],
  label: string,
  value: string,
  extra?: Partial<CategoryInfoRow>,
): CategoryInfoRow[] {
  let replaced = false;
  const next = rows.map((row) => {
    if (row.label !== label) return row;
    replaced = true;
    return { ...row, value, ...extra, label };
  });
  if (!replaced) next.push({ label, value, ...extra });
  return next;
}

function applyMelonSongRows(
  rows: CategoryInfoRow[],
  links: CategoryInfoLink[],
  hit: MelonSongHit,
  songTitle: string,
): { rows: CategoryInfoRow[]; links: CategoryInfoLink[] } {
  let next = [...rows];
  next = forceRow(next, "아티스트", hit.artistName || songTitle, { emphasize: true });
  if (hit.albumName) {
    next = forceRow(next, "앨범", hit.albumName);
  }
  const chartValue = hit.chartRank
    ? `멜론 TOP100 ${hit.chartRank}위 · ${hit.songName}`
    : `멜론 검색 확인 · ${hit.songName}${hit.artistName ? ` · ${hit.artistName}` : ""}`;
  next = forceRow(next, "멜론 차트", chartValue, {
    emphasize: true,
    href: hit.href,
  });
  next = forceRow(next, "출처", `멜론 ${hit.source === "chart" ? "공개 차트" : "곡 검색"} 수집`, {
    href: hit.href,
  });

  const melonLink: CategoryInfoLink = {
    title: `${hit.songName} · 멜론 곡 정보`,
    href: hit.href,
    source: "멜론",
  };
  const withoutMelonSearch = links.filter(
    (link) => !/melon\.com\/search/i.test(link.href) && !/melon\.com\/song\/detail/i.test(link.href),
  );
  return {
    rows: next,
    links: [melonLink, ...withoutMelonSearch].slice(0, 5),
  };
}

/** Related-news lookback: evergreen topics (지원금·정책) go quiet for weeks. */
const RELATED_NEWS_LOOKBACK_HOURS = 2160; // 90 days
const RELATED_NEWS_RETRY_LOOKBACK_HOURS = 8760; // 1 year

/**
 * Fetch real press permalinks for 관련 참고 링크.
 * Prefer Google News RSS → publisher unwrap; widen lookback / skip alias when thin.
 * Never invent Naver search placeholders here — that is the visitor-facing bug.
 */
async function crawlNews(
  name: string,
  channel?: CategoryInfoChannel,
): Promise<CrawlDoc[]> {
  const newsPrimary = isNewsPrimaryChannel(channel ?? "generic");
  const limit = newsPrimary ? 10 : 6;
  const cap = newsPrimary ? 8 : 5;
  const query = newsQueryForChannel(name, channel);
  const bare = name.replace(/^\[[^\]]+\]\s*/, "").trim() || name.trim();
  const seen = new Set<string>();
  const out: CrawlDoc[] = [];

  const push = (doc: CrawlDoc) => {
    if (!doc.url || !doc.title || seen.has(doc.url)) return;
    if (isNonArticleMediaUrl(doc.url) || isNewsSearchFallbackUrl(doc.url)) return;
    if (isGoogleNewsUrl(doc.url)) return;
    seen.add(doc.url);
    out.push(doc);
  };

  try {
    // 1) Unwrapped publisher URLs — most reliable visitor-facing permalinks.
    const rss = await crawlKeywordNewsRss(query, limit).catch(() => []);
    for (const source of rss) {
      push({
        title: source.title,
        url: source.url,
        publisher: source.publisher,
        snippet: source.snippet,
        publishedAt: source.publishedAt,
      });
    }

    // 2) Provider retrieval with a wide lookback (240h was dropping almost everything).
    const retrieval = await retrieveNewsForKeyword(query, {
      limit: limit * 2,
      lookbackHours: RELATED_NEWS_LOOKBACK_HOURS,
      trustedOnly: false,
      allowMarketTape: true,
    });
    for (const doc of retrieval.docs) {
      if (!doc.link || !doc.title) continue;
      const resolved = (await resolvePublisherUrl(doc.link).catch(() => doc.link)) ?? doc.link;
      push({
        title: doc.title,
        url: resolved,
        publisher: doc.publisher || publisherFromUrl(resolved),
        snippet: doc.snippet,
        publishedAt: doc.publishedAt,
      });
      if (out.length >= cap) break;
    }

    // 3) Still thin → bare name + year lookback + soft alias filter.
    if (out.length < 2) {
      const retry = await retrieveNewsForKeyword(bare, {
        limit: limit * 2,
        lookbackHours: RELATED_NEWS_RETRY_LOOKBACK_HOURS,
        trustedOnly: false,
        skipAliasFilter: true,
        allowMarketTape: true,
      });
      for (const doc of retry.docs) {
        if (!doc.link || !doc.title) continue;
        const resolved =
          (await resolvePublisherUrl(doc.link).catch(() => doc.link)) ?? doc.link;
        push({
          title: doc.title,
          url: resolved,
          publisher: doc.publisher || publisherFromUrl(resolved),
          snippet: doc.snippet,
          publishedAt: doc.publishedAt,
        });
        if (out.length >= cap) break;
      }
    }

    // 4) Last resort: bare-name RSS unwrap (no date gate).
    if (out.length < 2 && bare !== query) {
      const rssBare = await crawlKeywordNewsRss(bare, limit).catch(() => []);
      for (const source of rssBare) {
        push({
          title: source.title,
          url: source.url,
          publisher: source.publisher,
          snippet: source.snippet,
          publishedAt: source.publishedAt,
        });
      }
    }
  } catch {
    /* soft — return whatever we collected */
  }

  return out.slice(0, cap);
}

async function crawlWeb(name: string, channel: CategoryInfoChannel): Promise<CrawlDoc[]> {
  const preferBlog =
    channel === "recipe" ||
    channel === "food" ||
    channel === "domestic_travel" ||
    channel === "overseas_travel" ||
    channel === "weekend_outing";
  const preferOfficial =
    channel === "gov_subsidy" || channel === "travel_grant" || channel === "local_policy";
  try {
    const sources = await fetchNaverWebFallback(`${name} ${queryHint(channel)}`.trim(), 6, {
      preferBlog,
      preferOfficial,
    });
    return sources.map((source) => ({
      title: source.title,
      url: source.url,
      publisher: source.publisher,
      snippet: source.snippet,
    }));
  } catch {
    return [];
  }
}

function queryHint(channel: CategoryInfoChannel): string {
  switch (channel) {
    case "kpop":
    case "trot":
    case "star":
      return "소속사 히트곡";
    case "music":
      return "음원 차트 순위";
    case "movie":
      return "출연 시놉시스";
    case "tv_ratings":
      return "시청률 출연";
    case "webtoon":
      return "웹툰 줄거리 작가";
    case "youtuber":
    case "politics_youtube":
      return "유튜브 채널 구독자";
    case "political_pundit":
      return "출연 토론 방송 유튜브";
    case "gov_subsidy":
    case "travel_grant":
      return "지원금 신청 자격 기간";
    case "housing":
      return "실거래가 분양가";
    case "performance":
      return "공연 티켓 출연";
    case "exhibition":
      return "전시 입장료";
    case "book":
      return "작가 출판사 서평";
    case "food":
      return "맛집 주소 영업시간";
    default:
      return "최신 이슈";
  }
}

async function crawlYoutube(name: string): Promise<ContextSource[]> {
  try {
    return await fetchYoutubeFallback(name, 5);
  } catch {
    return [];
  }
}

/** Melon chart + artist search — fill song chips when the artist appears. */
function linksFromDocs(docs: CrawlDoc[], sourceLabel: string): CategoryInfoLink[] {
  return docs
    .filter((doc) => isSafeOutboundUrl(doc.url))
    .filter(
      (doc) =>
        !isIrrelevantNaverServiceLink({
          title: doc.title,
          href: doc.url,
          source: doc.publisher,
        }),
    )
    .slice(0, 5)
    .map((doc) => ({
      title: displayLinkTitle(doc.title, doc.url),
      href: doc.url,
      source: cleanLinkSource(doc.publisher?.trim() || sourceLabel, doc.url),
      publishedAt:
        doc.publishedAt ||
        inferPublishedAt(doc.snippet, doc.title, doc.publisher),
    }))
    .filter((link) => link.title.trim().length >= 4);
}

function isSafeOutboundUrl(href: string): boolean {
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!url.hostname.includes(".")) return false;
    if (isNonArticleMediaUrl(href)) return false;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    // Naver product/tool landing pages — never entity-related outbound links.
    if (
      host === "mate.naver.com" ||
      host.endsWith(".mate.naver.com") ||
      host === "shopping.naver.com" ||
      host === "pay.naver.com" ||
      host === "mail.naver.com" ||
      host === "dict.naver.com" ||
      host === "papago.naver.com" ||
      host === "map.naver.com" ||
      host === "nid.naver.com" ||
      host === "landing.naver.com" ||
      host === "tv.naver.com" ||
      host === "clip.naver.com" ||
      host === "tvcast.naver.com"
    ) {
      return false;
    }
    if (/네이버\s*메이트|Naver\s*Mate/i.test(`${url.pathname}${url.search}`)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Drop off-topic Naver service titles even if the URL slipped through. */
function isIrrelevantNaverServiceLink(link: { title?: string; href?: string; source?: string }): boolean {
  if (link.href && isNonArticleMediaUrl(link.href)) return true;
  const blob = `${link.title ?? ""} ${link.source ?? ""} ${link.href ?? ""}`;
  if (/네이버\s*메이트|Naver\s*Mate|mate\.naver\.com/i.test(blob)) return true;
  if (/papago\.naver\.com|dict\.naver\.com|pay\.naver\.com|mail\.naver\.com/i.test(blob)) {
    return true;
  }
  if (/kin\.naver\.com\/profile/i.test(blob)) return true;
  if (/네이버\s*클립|네이버\s*쇼츠|tv\.naver|clip\.naver|MOMENT|mediaType=VOD/i.test(blob)) {
    return true;
  }
  // URL-chrome titles ("host › path PDF") with no readable headline
  if (/\.go\.kr|\.co\.kr|\.com|\.org/i.test(link.title ?? "") && /›|PDF/i.test(link.title ?? "")) {
    return true;
  }
  return false;
}

/**
 * Drop links whose claimed source/title disagrees with the destination host,
 * and prefer title·entity·domain quality (보조금24 rules expanded to all channels).
 */
function sanitizeRelatedLinks(
  links: CategoryInfoLink[],
  entityName: string,
  channel?: CategoryInfoChannel,
): CategoryInfoLink[] {
  const scored = links
    .filter((link) => link.href && isSafeOutboundUrl(link.href))
    .filter((link) => !isIrrelevantNaverServiceLink(link))
    .map((link) => ({ link, score: scoreNewsLinkQuality(link, entityName, channel) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const out: CategoryInfoLink[] = [];
  const seen = new Set<string>();
  for (const { link, score } of scored) {
    if (seen.has(link.href)) continue;
    // Never keep search URLs — visitor slots are press permalinks only.
    if (isNewsSearchFallbackUrl(link.href)) continue;
    if (score < 2 && out.length >= 2) continue;
    seen.add(link.href);
    out.push(link);
    if (out.length >= 5) break;
  }
  return out;
}

function mergeLinks(primary: CategoryInfoLink[], secondary: CategoryInfoLink[]): CategoryInfoLink[] {
  const seenHref = new Set<string>();
  const seenTitle = new Set<string>();
  const out: CategoryInfoLink[] = [];
  for (const link of [...primary, ...secondary]) {
    if (!link.href || !isSafeOutboundUrl(link.href)) continue;
    if (isIrrelevantNaverServiceLink(link)) continue;
    if (seenHref.has(link.href)) continue;
    const titleKey = link.title
      .replace(/\s+/g, "")
      .replace(/[^\w가-힣]/g, "")
      .toLowerCase();
    if (titleKey.length >= 8 && seenTitle.has(titleKey)) continue;
    seenHref.add(link.href);
    if (titleKey.length >= 8) seenTitle.add(titleKey);
    out.push(link);
    if (out.length >= 5) break;
  }
  return out;
}

/** Reject SEO hashtag / keyword-stuffed crawl noise for grant cells. */
function isGrantSpamValue(value?: string): boolean {
  if (!value?.trim()) return true;
  const text = value.trim();
  const hashCount = (text.match(/#/g) ?? []).length;
  if (hashCount >= 2) return true;
  if (/^#/.test(text) && text.length < 80) return true;
  // "신청 기간 #태그 #태그" style mis-captures
  if (/신청\s*기간\s*#/.test(text) || /자격[^\n]{0,20}#/.test(text)) return true;
  // Mostly hashtags / short tag tokens
  const tags = text.match(/#[^\s#]+/g) ?? [];
  if (tags.length >= 2 && tags.join("").length / Math.max(text.replace(/\s/g, "").length, 1) > 0.45) {
    return true;
  }
  return false;
}

function sanitizeGrantField(value?: string): string | undefined {
  if (!value?.trim() || isGrantSpamValue(value)) return undefined;
  const cleaned = value
    .replace(/(?:^|\s)#[^\s#]{1,40}/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned || isGrantSpamValue(cleaned) || cleaned.length < 4) return undefined;
  return cleaned;
}

/** Split grant eligibility/prep into numbered lines; drop mid-clause truncations. */
function formatGrantList(...parts: Array<string | undefined>): string | undefined {
  const chunks = parts
    .map((part) => sanitizeGrantField(plain(part)))
    .filter((part): part is string => Boolean(part));
  if (!chunks.length) return undefined;

  const items: string[] = [];
  for (const chunk of chunks) {
    // Prefer author-provided numbered / bulleted lines as atomic items.
    const explicitLines = chunk
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const looksNumbered =
      explicitLines.length > 1 &&
      explicitLines.filter((line) => /^(?:[0-9]+[.)]|[①-⑮]|[-•·◦○●])\s*/.test(line)).length >=
        Math.ceil(explicitLines.length * 0.6);

    if (looksNumbered) {
      for (const line of explicitLines) {
        const cleaned = line
          .replace(/^(?:[0-9]+[.)]|[①-⑮]|[-•·◦○●])\s*/, "")
          .replace(/\s+/g, " ")
          .trim();
        if (cleaned.length >= 2 && !isGrantSpamValue(cleaned)) items.push(cleaned);
      }
      continue;
    }

    const pieces = chunk
      .split(
        // Never split on calendar fragments like "2020.12. 이전" — only list markers
        // after a break, circled numbers, or hollow bullets.
        /(?:\r?\n+|;\s*|·\s*|(?<=[가-힣A-Za-z)）])\s*(?=\d{1,2}[.)]\s)|(?=[①-⑮])|(?=\s*[○●◦]\s*))/,
      )
      .map((piece) =>
        piece
          .replace(/^[\s\-•·\*◦○●①-⑮]+/, "")
          .replace(/^\d{1,2}[.)]\s*/, "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter((piece) => piece.length >= 2 && !isGrantSpamValue(piece));
    if (pieces.length > 1) {
      items.push(...pieces);
    } else if (!isGrantSpamValue(chunk)) {
      // Keep a single clause intact — never soft-split mid-sentence with
      // "(?<=다)\s+" which renumbered eligibility vs prep out of order.
      items.push(chunk);
    }
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const cleaned = item
      .replace(/\s+/g, " ")
      .replace(/(?:및|와|과|또는|등)\s*$/u, "")
      .trim();
    // Numbered doc labels can be short (신분증, 통장사본).
    if (cleaned.length < 2 || isGrantSpamValue(cleaned)) continue;
    if (cleaned.length < 12 && !/[.。!?)]$/.test(cleaned) && /(?:의|을|를|이|가|은|는)$/u.test(cleaned)) {
      continue;
    }
    // Reject mis-captured "신청 기간 …" blobs in eligibility/prep.
    if (/^신청\s*기간/.test(cleaned) && cleaned.length < 60) continue;
    // Keep support-benefit copy out of eligibility lists.
    if (/^지원\s*내용/.test(cleaned)) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(cleaned);
    if (unique.length >= 10) break;
  }
  if (!unique.length) return undefined;
  if (unique.length === 1) return `· ${unique[0]}`;
  return unique.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

/** Soft cap so table cells never push past the card on narrow viewports. */
function clampCellValue(value: string, multiline = false): string {
  const trimmed = value.replace(/\u00a0/g, " ").trim();
  if (!trimmed) return trimmed;
  const max = multiline ? 720 : 320;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function containRows(rows: CategoryInfoRow[]): CategoryInfoRow[] {
  return rows.map((row) => {
    const multiline = Boolean(row.multiline || row.value.includes("\n"));
    const href =
      row.href &&
      isSafeOutboundUrl(row.href) &&
      !isIrrelevantNaverServiceLink({ title: row.value, href: row.href })
        ? row.href
        : undefined;
    // Drop cells whose only content is an off-topic Naver service URL/title.
    if (
      isIrrelevantNaverServiceLink({ title: row.value, href: row.href }) &&
      /mate\.naver|네이버\s*메이트|바로가기/i.test(row.value)
    ) {
      return {
        ...row,
        href: undefined,
        value: "추가 수집 중",
        multiline: multiline || undefined,
      };
    }
    return {
      ...row,
      href,
      multiline: multiline || undefined,
      value: clampCellValue(row.value, multiline),
    };
  });
}

function applyGrantRecord(
  rows: CategoryInfoRow[],
  grant: PublicGrantRecord,
  entityName: string,
): CategoryInfoRow[] {
  let next = rows;
  if (grant.agency) {
    next = fillUpdatingRows(next, [
      { label: /주관 기관/, value: grant.agency, emphasize: true },
    ]);
  }
  const deadline = sanitizeGrantField(grant.deadline);
  if (deadline) {
    next = fillUpdatingRows(next, [{ label: "신청 기간", value: deadline }]);
  }
  const eligibility = formatGrantList(grant.target, grant.criteria);
  if (eligibility) {
    next = next.map((row) =>
      /신청 자격|자격·조건/.test(row.label) && isUpdating(row.value)
        ? { ...row, value: eligibility, multiline: true }
        : row,
    );
    if (!next.some((row) => /신청 자격|자격·조건/.test(row.label))) {
      next = [{ label: "신청 자격·조건", value: eligibility, multiline: true }, ...next];
    }
  }
  // 구비서류 → 준비사항. 신청방법은 labelled suffix so numbers stay document-aligned.
  const prepDocs = formatGrantList(grant.documents);
  const applyHow = sanitizeGrantField(plain(grant.howToApply));
  let prepValue = prepDocs;
  if (prepDocs && applyHow) {
    const methodLine = applyHow.replace(/\s+/g, " ").trim();
    if (methodLine && !prepDocs.includes(methodLine)) {
      prepValue = `${prepDocs}\n· 신청 방법: ${methodLine}`;
    }
  } else if (!prepDocs && applyHow) {
    prepValue = formatGrantList(applyHow);
  }
  if (prepValue) {
    next = next.map((row) =>
      row.label === "준비사항" && isUpdating(row.value)
        ? { ...row, value: prepValue!, multiline: true }
        : row,
    );
    if (!next.some((row) => row.label === "준비사항")) {
      next = [...next, { label: "준비사항", value: prepValue, multiline: true }];
    }
  }

  // 주관 기관 홈페이지 must be the agency site (fsc.go.kr 등) — never 보조금24/복지로.
  const agencyHome =
    resolveGrantOrgHomepage(grant.agency) ||
    resolveGrantOrgHomepage(entityName) ||
    resolveGrantOrgHomepage(grant.title);
  next = next.map((row) => {
    if (!/주관 기관/.test(row.label)) return row;
    if (agencyHome) {
      return {
        ...row,
        href: agencyHome.href,
        value: isUpdating(row.value)
          ? agencyHome.label
          : grant.agency || row.value,
        emphasize: true,
      };
    }
    // Strip mis-attached programme portal URLs left by older packs / detail facts.
    if (row.href && isGrantServicePortalUrl(row.href)) {
      return { ...row, href: undefined };
    }
    return row;
  });
  return next;
}

/**
 * Reuse article-generation collected sources/facts so sparse category packs
 * can fill without a second full crawl when overnight analysis already ran.
 */
async function loadAnalysisContextDocs(entitySlug: string): Promise<CrawlDoc[]> {
  if (!entitySlug) return [];
  try {
    const entry = await readAnalysis(entitySlug);
    if (!entry) return [];
    const out: CrawlDoc[] = [];
    for (const source of entry.article?.sources ?? []) {
      if (!source.url || !source.title) continue;
      out.push({
        title: source.title,
        url: source.url,
        publisher: source.publisher,
        publishedAt: source.publishedAt,
        snippet: source.title,
      });
    }
    for (const fact of entry.provenance?.facts ?? []) {
      const text = plain(fact);
      if (!text || text.length < 24) continue;
      out.push({
        title: `${entry.keyword || entitySlug} 분석 수집 사실`,
        url: `analysis://${entitySlug}`,
        publisher: "분석 수집",
        snippet: text.slice(0, 400),
      });
    }
    return out.slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * Live crawl enrichment for ItemDetailCategoryInfo.
 * Uses news retrieval + Naver web/blog crawl→Open API fallback (+ Melon / YouTube / ticket·bookstore crawls)
 * and data.go.kr (보조금24·복지로·국토부 실거래) when DATA_GO_KR_SERVICE_KEY is set.
 * Never throws — returns the base payload on soft failures.
 */
export async function enrichCategoryInfoPayload(
  base: CategoryInfoPayload,
): Promise<CategoryInfoPayload> {
  const name = base.entityName;
  const wantsGrant =
    base.channel === "gov_subsidy" ||
    base.channel === "travel_grant" ||
    base.channel === "local_policy" ||
    base.channel === "startup";
  const wantsHousing = base.channel === "housing";
  const wantsYoutube =
    base.channel === "youtuber" ||
    base.channel === "politics_youtube" ||
    base.channel === "political_pundit";
  const wantsWebtoon = base.channel === "webtoon";
  const wantsBook = base.channel === "book";
  const wantsTickets =
    base.channel === "performance" || base.channel === "exhibition";
  const wantsFood = base.channel === "food";
  const wantsMelonArtist =
    base.channel === "kpop" || base.channel === "trot" || base.channel === "star";
  const wantsMelonSong = base.channel === "music";
  const wantsMelon = wantsMelonArtist || wantsMelonSong;
  // Skip expensive web crawl when specialized lookups cover the channel, unless grant/housing need snippets.
  const wantsWebCrawl =
    wantsGrant ||
    wantsHousing ||
    wantsFood ||
    base.channel === "recipe" ||
    base.channel === "domestic_travel" ||
    base.channel === "overseas_travel" ||
    base.channel === "weekend_outing" ||
    base.channel === "health" ||
    base.channel === "car" ||
    base.channel === "star" ||
    base.channel === "kpop" ||
    base.channel === "movie" ||
    base.channel === "tv_ratings" ||
    base.channel === "performance" ||
    base.channel === "exhibition" ||
    base.channel === "webtoon" ||
    base.channel === "book" ||
    base.sparse;
  const punditSeed =
    base.channel === "political_pundit" ? matchPunditProfileSeed(name) : undefined;
  const artistHint = base.entityNameEn?.trim() || undefined;

  const [
    newsDocs,
    webDocs,
    publicGrant,
    housingPublic,
    youtubeProfile,
    webtoonFacts,
    bookFacts,
    ticketFacts,
    foodFacts,
    melonHits,
    melonSong,
    analysisDocs,
    rankingPeers,
  ] = await Promise.all([
    crawlNews(name, base.channel),
    wantsWebCrawl
      ? crawlWeb(name, base.channel)
      : Promise.resolve([] as CrawlDoc[]),
    wantsGrant ? matchPublicGrant(name).catch(() => undefined) : Promise.resolve(undefined),
    wantsHousing
      ? summarizeHousingPublicData(name).catch(() => undefined)
      : Promise.resolve(undefined),
    wantsYoutube
      ? lookupYoutubeChannelProfile(punditSeed?.name || name).catch(() => undefined)
      : Promise.resolve(undefined),
    wantsWebtoon
      ? lookupWebtoonFacts(name).catch(() => undefined)
      : Promise.resolve(undefined),
    wantsBook ? lookupBookFacts(name).catch(() => undefined) : Promise.resolve(undefined),
    wantsTickets
      ? lookupTicketFacts(
          name,
          base.channel === "exhibition" ? "exhibition" : "performance",
        ).catch(() => undefined)
      : Promise.resolve(undefined),
    wantsFood ? lookupFoodFacts(name).catch(() => undefined) : Promise.resolve(undefined),
    wantsMelonArtist
      ? crawlMelonSongsForArtist(name).catch(() => [] as string[])
      : Promise.resolve([] as string[]),
    wantsMelonSong
      ? lookupMelonSong(name, artistHint).catch(() => undefined)
      : Promise.resolve(undefined),
    loadAnalysisContextDocs(base.entitySlug),
    wantsMelon
      ? getRankings()
          .then((payload) => payload.items)
          .catch(() => [] as RankingEntity[])
      : Promise.resolve([] as RankingEntity[]),
  ]);

  // Music songs: if payload lacked nameEn, retry Melon with peer artist from rankings.
  let resolvedMelonSong = melonSong;
  if (wantsMelonSong && !resolvedMelonSong) {
    const peer = rankingPeers.find((item) => item.slug === base.entitySlug);
    const peerArtist = peer?.nameEn?.trim();
    if (peerArtist && peerArtist !== artistHint) {
      resolvedMelonSong = await lookupMelonSong(name, peerArtist).catch(() => undefined);
    }
  }
  // Ticket / food lookup miss → Admin ledger (same soft retry path as grants).
  if (wantsTickets) {
    const ticketOk = Boolean(
      ticketFacts?.venue || ticketFacts?.schedule || ticketFacts?.price || ticketFacts?.time,
    );
    if (!ticketOk) {
      recordPublicDataFailure({
        channel: base.channel,
        entityName: name,
        kind: "no_match",
        reason: "놀티켓·티켓링크·인터파크·예스24에서 공연/전시 매칭 실패",
      });
    } else {
      clearPublicDataRetry(name, base.channel);
    }
  }
  if (wantsFood) {
    const foodOk = Boolean(foodFacts?.address || foodFacts?.hours || foodFacts?.menu);
    if (!foodOk) {
      recordPublicDataFailure({
        channel: base.channel,
        entityName: name,
        kind: "no_match",
        reason: "네이버·카카오 장소 정보 매칭 실패",
      });
    } else {
      clearPublicDataRetry(name, base.channel);
    }
  }

  // Public API miss → Admin ledger + retry queue
  if (wantsGrant) {
    if (!hasDataGoKrKey()) {
      recordPublicDataFailure({
        channel: base.channel,
        entityName: name,
        kind: "missing_key",
        reason: "DATA_GO_KR_SERVICE_KEY 미설정 — 보조금24·복지로 조회 불가",
      });
    } else if (!publicGrant) {
      recordPublicDataFailure({
        channel: base.channel,
        entityName: name,
        kind: "no_match",
        reason: "보조금24·복지로·기업마당에서 매칭 결과 없음",
      });
    } else {
      clearPublicDataRetry(name, base.channel);
    }
  }
  if (wantsHousing) {
    if (!hasDataGoKrKey()) {
      recordPublicDataFailure({
        channel: base.channel,
        entityName: name,
        kind: "missing_key",
        reason: "DATA_GO_KR_SERVICE_KEY 미설정 — 국토부 실거래 조회 불가",
      });
    } else if (!housingPublic?.tradeSummary && !housingPublic?.byPyeong) {
      recordPublicDataFailure({
        channel: base.channel,
        entityName: name,
        kind: "no_match",
        reason: "국토부 실거래·분양 매칭 실패",
      });
    } else {
      clearPublicDataRetry(name, base.channel);
    }
  }

  // Grant detail page crawl (only when API match is thin) — parallel with optional youtube docs.
  const grantPageNeed =
    wantsGrant &&
    (!publicGrant ||
      !publicGrant.deadline ||
      !publicGrant.target ||
      !publicGrant.documents ||
      !publicGrant.howToApply);
  const grantPageUrl =
    publicGrant?.url && isSafeOutboundUrl(publicGrant.url) ? publicGrant.url : undefined;

  const [youtubeDocs, grantPageText] = await Promise.all([
    wantsYoutube && !youtubeProfile?.recentVideoTitles.length
      ? crawlYoutube(name)
      : Promise.resolve([] as ContextSource[]),
    grantPageNeed && grantPageUrl
      ? fetchText(grantPageUrl, { next: { revalidate: 3600 } }).catch(() => "")
      : Promise.resolve(""),
  ]);

  const docs: CrawlDoc[] = [
    ...newsDocs,
    ...analysisDocs,
    ...webDocs,
    ...youtubeDocs.map((doc) => ({
      title: doc.title,
      url: doc.url,
      publisher: doc.publisher,
      snippet: doc.snippet,
    })),
  ];
  if (grantPageText) {
    docs.push({
      title: publicGrant?.title || `${name} 공고`,
      url: grantPageUrl || "",
      publisher: publicGrant?.agency,
      snippet: plain(grantPageText)?.slice(0, 4_000),
    });
  }
  const corpus = corpusOf(docs);

  let rows = [...base.rows];
  let chips = [...base.chips];
  let synopsis = base.synopsis;
  let statusMessage = base.statusMessage;
  let sparse = base.sparse;
  let sparkline = base.sparkline;
  let sparklines = base.sparklines ? [...base.sparklines] : [];

  const agency = extractAgency(corpus);
  const curatedHitSongs = sanitizeHitSongTitles(
    chips.find((chip) => /히트|곡/.test(chip.label))?.items ?? [],
    name,
  );
  const chartPeerHits = hitSongsFromMusicChartPeers(name, rankingPeers);
  // Melon → music_chart nameEn peers → curated pack → strict news extract.
  // Never fall back to unvalidated corpus scraps (HYBE/빅히트 agency noise).
  const hitSongs = pickHitSongs(
    name,
    melonHits,
    chartPeerHits,
    curatedHitSongs,
    extractHitSongs(corpus, name),
  );
  const cast = extractCast(corpus);
  const housing = extractHousingSnippet(corpus);
  const crawledSynopsis = extractSynopsis(docs, name);

  switch (base.channel) {
    case "kpop":
    case "trot":
    case "star":
    case "music": {
      if (agency) {
        rows = fillUpdatingRows(rows, [{ label: "소속사", value: agency, emphasize: true }]);
      }
      // Drop any junk titles that snuck into curated chips before enrich.
      chips = chips.map((chip) =>
        /히트|곡/.test(chip.label)
          ? { ...chip, items: sanitizeHitSongTitles(chip.items, name) }
          : chip,
      );
      if (hitSongs.length) {
        rows = fillUpdatingRows(rows, [
          { label: /히트곡|대표곡|최근 히트/, value: hitSongs.join(" · ") },
        ]);
        const existing = chips.find((chip) => /히트|곡/.test(chip.label));
        if (existing) {
          chips = chips.map((chip) =>
            chip === existing ? { ...chip, items: hitSongs } : chip,
          );
        } else {
          chips = [...chips, { label: "최근 히트곡", items: hitSongs }];
        }
      } else {
        // Prefer empty over junk — UI shows UPDATING row when no validated titles.
        chips = chips.filter((chip) => !/히트|곡/.test(chip.label) || chip.items.length > 0);
      }
      if (base.channel === "music") {
        if (resolvedMelonSong) {
          const applied = applyMelonSongRows(rows, [], resolvedMelonSong, name);
          rows = applied.rows;
        } else {
          // Force a Melon provenance path even when the live lookup misses.
          const searchHref = `https://www.melon.com/search/song/index.htm?q=${encodeURIComponent(
            artistHint ? `${name} ${artistHint}` : name,
          )}`;
          rows = forceRow(rows, "멜론 차트", "멜론 곡 검색으로 확인 중", {
            emphasize: true,
            href: searchHref,
          });
          rows = forceRow(rows, "출처", "멜론 공개 차트·검색 수집 대기", {
            href: searchHref,
          });
          if (artistHint) {
            rows = forceRow(rows, "아티스트", artistHint, { emphasize: true });
          }
        }
      }
      // Pack-less kpop/trot/star: ensure at least one Melon/news field is filled.
      if (
        (base.channel === "kpop" || base.channel === "trot" || base.channel === "star") &&
        hitSongs.length
      ) {
        rows = fillUpdatingRows(rows, [
          { label: /히트곡|대표곡|최근 히트/, value: hitSongs.join(" · ") },
        ]);
      }
      break;
    }
    case "movie":
    case "tv_ratings": {
      if (cast.length) {
        const label = base.channel === "tv_ratings" ? "최근 출연자" : "출연";
        const existing = chips.find((chip) => /출연|캐스트|등장/.test(chip.label));
        if (existing) {
          chips = chips.map((chip) =>
            chip === existing ? { ...chip, items: cast } : chip,
          );
        } else {
          chips = [...chips, { label, items: cast }];
        }
        rows = fillUpdatingRows(rows, [{ label: /출연/, value: cast.join(" · ") }]);
      }
      break;
    }
    case "youtuber":
    case "politics_youtube":
    case "political_pundit": {
      if (youtubeProfile) {
        rows = fillUpdatingRows(rows, [
          { label: "유튜브 채널", value: youtubeProfile.title, emphasize: true },
          {
            label: "채널 URL",
            value: youtubeProfile.title || name,
            emphasize: true,
          },
        ]);
        if (youtubeProfile.subscriberLabel) {
          rows = upsertRow(rows, "구독자 수", youtubeProfile.subscriberLabel, true);
        }
        rows = rows.map((row) =>
          row.label === "채널 URL"
            ? {
                ...row,
                value: youtubeProfile.title || name,
                href: youtubeProfile.url,
              }
            : row,
        );
        if (youtubeProfile.recentVideoTitles.length) {
          chips = [
            ...chips.filter((chip) => !/영상|조회/.test(chip.label)),
            {
              label: "최근 높은 조회수 영상 TOP 5",
              items: youtubeProfile.recentVideoTitles.slice(0, 5),
            },
          ];
        }
      } else if (youtubeDocs[0]) {
        const preferUc = youtubeDocs[0].url.includes("/channel/UC")
          ? youtubeDocs[0].url
          : youtubeDocs[0].url;
        rows = fillUpdatingRows(rows, [
          {
            label: "유튜브 채널",
            value: youtubeDocs[0].publisher || name,
            emphasize: true,
          },
          {
            label: "채널 URL",
            value: youtubeDocs[0].publisher || name,
            emphasize: true,
          },
        ]);
        rows = rows.map((row) =>
          row.label === "채널 URL"
            ? {
                ...row,
                value: youtubeDocs[0]!.publisher || name,
                href: preferUc,
              }
            : row,
        );
        chips = [
          ...chips.filter((chip) => !/영상|조회/.test(chip.label)),
          {
            label: "최근 화제 영상 TOP",
            items: youtubeDocs.map((doc) => doc.title).slice(0, 5),
          },
        ];
      }

      if (base.channel === "political_pundit") {
        const seed = punditSeed ?? matchPunditProfileSeed(name);
        if (seed?.sns?.length) {
          rows = fillUpdatingRows(rows, [
            {
              label: "SNS",
              value: seed.sns.map((s) => s.label).join(" · "),
              emphasize: true,
            },
          ]);
          rows = rows.map((row) =>
            row.label === "SNS"
              ? { ...row, href: seed.sns![0]?.href }
              : row,
          );
          chips = [
            ...chips.filter((chip) => chip.label !== "SNS"),
            { label: "SNS", items: seed.sns.map((s) => `${s.label}`) },
          ];
        }
        // 7-day appearance chips from news lookback (출연·토론·라디오)
        const appearance = newsDocs
          .filter((doc) =>
            /출연|토론|라디오|방송|인터뷰|패널|시사/.test(`${doc.title} ${doc.snippet ?? ""}`),
          )
          .map((doc) => doc.title.slice(0, 48))
          .filter(Boolean)
          .slice(0, 5);
        if (appearance.length) {
          rows = fillUpdatingRows(rows, [
            {
              label: "방송 출연",
              value: appearance.slice(0, 2).join(" · "),
              emphasize: true,
            },
          ]);
          chips = [
            ...chips.filter((chip) => !/출연|발언/.test(chip.label)),
            { label: "최근 7일 출연·발언", items: appearance },
          ];
        } else {
          rows = fillUpdatingRows(rows, [
            {
              label: "방송 출연",
              value: "최근 7일 출연·발언 추가 수집 중",
            },
          ]);
        }
      }
      break;
    }
    case "gov_subsidy":
    case "travel_grant": {
      if (publicGrant) {
        rows = applyGrantRecord(rows, publicGrant, name);
      }
      const agencyHome =
        resolveGrantOrgHomepage(publicGrant?.agency) ||
        resolveGrantOrgHomepage(name);
      // Only attach a crawled official URL when it matches the known agency host.
      if (!agencyHome) {
        const official = webDocs.find((doc) => {
          if (!isSafeOutboundUrl(doc.url) || isGrantServicePortalUrl(doc.url)) return false;
          try {
            const host = new URL(doc.url).hostname.toLowerCase();
            return /\.go\.kr$|\.korea\.kr$/i.test(host);
          } catch {
            return false;
          }
        });
        if (official) {
          rows = fillUpdatingRows(rows, [
            {
              label: "주관 기관 홈페이지",
              value: official.title.slice(0, 60),
              emphasize: true,
            },
          ]);
          rows = rows.map((row) =>
            row.label.includes("주관 기관")
              ? {
                  ...row,
                  href: official.url,
                  value:
                    row.value === UPDATING ? official.title.slice(0, 60) : row.value,
                }
              : row,
          );
        }
      }
      // Fill remaining gaps from crawl only when public API left the cell empty.
      // Never overwrite API values with hashtag/SEO spam.
      const period = sanitizeGrantField(
        firstMatch(corpus, [
          /신청\s*기간[:\s]*([^\n#]{6,80})/,
          /접수\s*기간[:\s]*([^\n#]{6,80})/,
          /(\d{4}\s*[.년/-]\s*\d{1,2}\s*[.월/-]\s*\d{1,2}\s*[~～-]\s*\d{4}\s*[.년/-]\s*\d{1,2}\s*[.월/-]\s*\d{1,2})/,
        ]),
      );
      const eligibilityRaw = sanitizeGrantField(
        firstMatch(corpus, [
          /(?:신청\s*자격|지원\s*대상|자격\s*요건|대상자)[:\s]*([^\n#]{8,280})/,
        ]),
      );
      const prepRaw = sanitizeGrantField(
        firstMatch(corpus, [
          /(?:준비\s*서류|제출\s*서류|준비\s*사항|신청\s*방법|구비\s*서류)[:\s]*([^\n#]{8,280})/,
        ]),
      );
      if (period) {
        rows = fillUpdatingRows(rows, [{ label: "신청 기간", value: period }]);
      }
      const eligibility = formatGrantList(eligibilityRaw);
      if (eligibility) {
        rows = rows.map((row) =>
          /신청 자격|자격·조건/.test(row.label) && isUpdating(row.value)
            ? { ...row, value: eligibility, multiline: true }
            : row,
        );
        if (!rows.some((row) => /신청 자격|자격·조건/.test(row.label))) {
          rows = [{ label: "신청 자격·조건", value: eligibility, multiline: true }, ...rows];
        }
      }
      const prep = formatGrantList(prepRaw);
      if (prep) {
        rows = rows.map((row) =>
          row.label === "준비사항" && isUpdating(row.value)
            ? { ...row, value: prep, multiline: true }
            : row,
        );
        if (!rows.some((row) => row.label === "준비사항")) {
          rows = [...rows, { label: "준비사항", value: prep, multiline: true }];
        }
      }
      // Final scrub — drop any leftover hashtag spam still sitting in grant cells.
      rows = rows.map((row) => {
        if (!/신청 기간|신청 자격|자격·조건|준비사항/.test(row.label)) return row;
        if (!isGrantSpamValue(row.value)) return row;
        return { ...row, value: UPDATING, multiline: undefined };
      });
      if (publicGrant?.summary || crawledSynopsis) {
        synopsis = synopsis || sanitizeGrantField(publicGrant?.summary) || crawledSynopsis;
      }
      break;
    }
    case "startup": {
      if (publicGrant) {
        rows = applyGrantRecord(rows, publicGrant, name);
        if (publicGrant.summary) {
          synopsis = synopsis || publicGrant.summary;
        }
      }
      break;
    }
    case "housing": {
      if (housingPublic?.byPyeong) {
        rows = fillUpdatingRows(rows, [
          {
            label: /실거래가\(평수별\)|실거래가/,
            value: housingPublic.byPyeong,
            emphasize: true,
          },
        ]);
      } else if (housingPublic?.tradeSummary) {
        rows = fillUpdatingRows(rows, [
          { label: /실거래가/, value: housingPublic.tradeSummary, emphasize: true },
        ]);
      } else if (housing) {
        rows = fillUpdatingRows(rows, [
          { label: /실거래가/, value: housing, emphasize: true },
        ]);
      }
      if (housingPublic?.saleOffer) {
        const saleText = housingPublic.saleOffer
          .replace(/네이버(?:페이)?/g, "")
          .replace(/\s{2,}/g, " ")
          .replace(/·\s*·/g, "·")
          .trim();
        if (saleText) {
          rows = fillUpdatingRows(rows, [{ label: /분양가/, value: saleText }]);
        }
        if (housingPublic.saleOfferUrl) {
          rows = rows.map((row) =>
            /분양가/.test(row.label)
              ? { ...row, href: housingPublic.saleOfferUrl }
              : row,
          );
        }
      }
      // Never reintroduce 네이버 branding in housing cells (legacy cache + crawls).
      rows = rows.map((row) =>
        /분양가|실거래|추이|단지/.test(row.label)
          ? {
              ...row,
              value: row.value
                .replace(/네이버(?:페이)?(?:\s*부동산)?/g, "")
                .replace(/\s{2,}/g, " ")
                .trim(),
            }
          : row,
      );
      rows = rows.filter((row) => !/네이버페이 부동산/.test(row.label));
      if (housingPublic?.trendSummary) {
        rows = fillUpdatingRows(rows, [
          {
            label: /매매·전세·월세 추이|추이/,
            value: [
              housingPublic.trendSummary,
              housingPublic.rentSummary,
            ]
              .filter(Boolean)
              .join(" · "),
          },
        ]);
      } else if (housingPublic?.rentSummary) {
        rows = fillUpdatingRows(rows, [
          {
            label: /매매·전세·월세|전세|월세|추이/,
            value: housingPublic.rentSummary,
          },
        ]);
      }
      if (housingPublic?.regionLabel) {
        rows = fillUpdatingRows(rows, [
          {
            label: "단지/지역",
            value: `${name} · ${housingPublic.regionLabel}`,
            emphasize: true,
          },
        ]);
      }
      if (housingPublic?.trendPoints && housingPublic.trendPoints.length >= 2) {
        sparkline = {
          title: "매매가 추이 (국토부 실거래 · 중위)",
          unit: "억원",
          points: housingPublic.trendPoints,
        };
      }
      const housingCharts: NonNullable<CategoryInfoPayload["sparklines"]> = [];
      if (housingPublic?.trendPoints && housingPublic.trendPoints.length >= 2) {
        housingCharts.push({
          title: "매매가 추이",
          unit: "억원",
          points: housingPublic.trendPoints,
        });
      }
      if (housingPublic?.jeonseTrendPoints && housingPublic.jeonseTrendPoints.length >= 2) {
        housingCharts.push({
          title: "전세 보증금 추이",
          unit: "억원",
          points: housingPublic.jeonseTrendPoints,
        });
      }
      if (
        housingPublic?.monthlyRentTrendPoints &&
        housingPublic.monthlyRentTrendPoints.length >= 2
      ) {
        housingCharts.push({
          title: "월세 월임대료 추이",
          unit: "만원",
          points: housingPublic.monthlyRentTrendPoints,
        });
      }
      if (housingCharts.length) sparklines = housingCharts;
      break;
    }
    case "webtoon": {
      if (webtoonFacts) {
        rows = fillUpdatingRows(rows, [
          { label: "플랫폼", value: webtoonFacts.platform, emphasize: true },
          { label: "작가", value: webtoonFacts.author },
        ]);
        if (webtoonFacts.scoreLabel) {
          rows = upsertRow(rows, "독자 반응", webtoonFacts.scoreLabel);
        }
        if (webtoonFacts.characters?.length) {
          rows = upsertRow(rows, "주요 인물", webtoonFacts.characters.join(" · "));
          chips = [
            ...chips.filter((chip) => !/인물|등장/.test(chip.label)),
            { label: "주요 인물", items: webtoonFacts.characters.slice(0, 6) },
          ];
        }
        if (webtoonFacts.url) {
          rows = rows.map((row) =>
            row.label === "플랫폼"
              ? {
                  ...row,
                  href: webtoonFacts.url,
                  value: isUpdating(row.value)
                    ? webtoonFacts.platform
                    : row.value,
                }
              : row,
          );
        }
        if (webtoonFacts.synopsis) synopsis = synopsis || webtoonFacts.synopsis;
      } else {
        const platform = extractPlatform(corpus);
        const author = extractAuthor(corpus, name);
        if (platform) rows = upsertRow(rows, "플랫폼", platform, true);
        if (author) rows = upsertRow(rows, "작가", author);
      }
      const characters = extractCast(corpus);
      if (characters.length && !rows.some((r) => r.label === "주요 인물" && !isUpdating(r.value))) {
        rows = upsertRow(rows, "주요 인물", characters.join(" · "));
        chips = [
          ...chips.filter((chip) => !/인물|등장/.test(chip.label)),
          { label: "주요 인물", items: characters.slice(0, 6) },
        ];
      }
      if (crawledSynopsis) synopsis = synopsis || crawledSynopsis;
      break;
    }
    case "book": {
      if (bookFacts) {
        rows = fillUpdatingRows(rows, [
          { label: "작가", value: bookFacts.author, emphasize: true },
          { label: "출판사", value: bookFacts.publisher },
          {
            label: /서점|판매처/,
            value: `${bookFacts.source}에서 보기`,
            emphasize: true,
          },
        ]);
        if (bookFacts.otherWorks?.length) {
          rows = upsertRow(
            rows,
            "필모",
            `작가 다른 작품 · ${bookFacts.otherWorks.slice(0, 4).join(" · ")}`,
          );
        }
        if (bookFacts.url) {
          rows = rows.map((row) =>
            /서점|판매처|작가|출판사|필모/.test(row.label)
              ? { ...row, href: row.href || bookFacts.url }
              : row,
          );
        }
        // Bookstore synopsis stays in table path as 요약 when present.
        if (bookFacts.synopsis) {
          rows = upsertRow(rows, "요약", bookFacts.synopsis);
          rows = rows.map((row) =>
            row.label === "요약" ? { ...row, multiline: true } : row,
          );
        }
        synopsis = undefined;
      } else {
        const author = extractAuthor(corpus, name);
        const publisher = firstMatch(corpus, [
          /(?:출판사|펴낸곳)\s*[:\s]*([가-힣A-Za-z0-9\s]{2,30})/,
        ]);
        if (author) rows = upsertRow(rows, "작가", author, true);
        if (publisher) rows = upsertRow(rows, "출판사", publisher);
      }
      break;
    }
    case "exhibition":
    case "performance": {
      const isExhibition = base.channel === "exhibition";
      if (ticketFacts) {
        const schedule = ticketFacts.schedule;
        const time =
          ticketFacts.time &&
          !looksLikeBadTicketTime(ticketFacts.time) &&
          ticketFacts.time !== schedule
            ? ticketFacts.time
            : undefined;
        const price =
          ticketFacts.price && looksLikeTicketPrice(ticketFacts.price)
            ? ticketFacts.price
            : undefined;
        rows = fillUpdatingRows(rows, [
          {
            label: isExhibition ? /행사\s*장소/ : /공연\s*장소|장소/,
            value: ticketFacts.venue,
            emphasize: true,
          },
          {
            label: isExhibition ? /행사\s*시간|일정/ : /공연\s*일정|일정/,
            value: schedule,
          },
          {
            label: isExhibition ? /입장료/ : /티켓\s*가격|가격/,
            value: price,
          },
        ]);
        if (!isExhibition && time) {
          rows = fillUpdatingRows(rows, [{ label: /공연\s*시간/, value: time }]);
        }
        // Never put 예매율 into 티켓 가격 / 공연 시간.
        if (ticketFacts.bookingPercent && !price) {
          rows = upsertRow(rows, "예매율", ticketFacts.bookingPercent);
        }
        if (ticketFacts.url) {
          rows = rows.map((row) =>
            /장소|입장료|티켓|예매율/.test(row.label)
              ? { ...row, href: row.href || ticketFacts.url }
              : row,
          );
        }
      } else {
        const venue = extractVenue(corpus);
        if (venue) {
          rows = upsertRow(
            rows,
            isExhibition ? "행사 장소" : "공연 장소",
            venue,
          );
        }
        const schedule = firstMatch(corpus, [
          /(?:공연\s*기간|전시\s*기간|관람\s*기간|기간|일정)\s*[:\s]*([^\n.]{6,50})/,
          /(\d{4}\s*[.년/-]\s*\d{1,2}\s*[.월/-]\s*\d{1,2}\s*[~～-]\s*\d{1,2}\s*[.월/-]\s*\d{1,2})/,
        ]);
        if (schedule && !looksLikeBadTicketTime(schedule)) {
          rows = upsertRow(
            rows,
            isExhibition ? "행사 시간" : "공연 일정",
            schedule,
          );
        }
        const time = firstMatch(corpus, [
          /(?:공연\s*시간|관람\s*시간|시작\s*시간)\s*[:\s]*([^\n.]{4,40})/,
        ]);
        if (!isExhibition && time && !looksLikeBadTicketTime(time)) {
          rows = upsertRow(rows, "공연 시간", time);
        }
        const fee = firstMatch(corpus, [
          /(?:티켓\s*가격|입장료|관람료)\s*[:\s]*([^\n.]{2,40}\d[\d,]*(?:\s*원)?)/,
        ]);
        if (fee && looksLikeTicketPrice(fee)) {
          rows = upsertRow(rows, isExhibition ? "입장료" : "티켓 가격", fee);
        }
      }
      if (cast.length && !isExhibition) {
        rows = fillUpdatingRows(rows, [{ label: /출연/, value: cast.join(" · ") }]);
        const existing = chips.find((chip) => /출연/.test(chip.label));
        if (existing) {
          chips = chips.map((chip) =>
            chip === existing ? { ...chip, items: cast } : chip,
          );
        } else {
          chips = [...chips, { label: "출연", items: cast }];
        }
      }
      if (crawledSynopsis) synopsis = synopsis || crawledSynopsis;
      break;
    }
    case "food": {
      if (foodFacts) {
        rows = fillUpdatingRows(rows, [
          { label: "주소", value: foodFacts.address, emphasize: true },
          { label: "영업시간", value: foodFacts.hours },
          { label: "추천 메뉴", value: foodFacts.menu },
        ]);
        if (foodFacts.phone) {
          rows = upsertRow(rows, "전화", foodFacts.phone);
        }
        if (foodFacts.url) {
          rows = rows.map((row) =>
            row.label === "주소"
              ? { ...row, href: row.href || foodFacts.url }
              : row,
          );
        }
      } else {
        const food = extractFoodMeta(corpus);
        if (food.address) rows = upsertRow(rows, "주소", food.address, true);
        if (food.hours) rows = upsertRow(rows, "영업시간", food.hours);
        if (food.menu) rows = upsertRow(rows, "추천 메뉴", food.menu);
      }
      if (crawledSynopsis) synopsis = synopsis || crawledSynopsis;
      break;
    }
    default:
      break;
  }

  if (!synopsis) {
    synopsis = crawledSynopsis;
  }

  const crawledLinks = mergeLinks(
    linksFromDocs(newsDocs, "뉴스"),
    mergeLinks(
      linksFromDocs(analysisDocs.filter((doc) => !doc.url.startsWith("analysis:")), "분석"),
      mergeLinks(
        linksFromDocs(
          youtubeDocs.map((doc) => ({
            title: doc.title,
            url: doc.url,
            publisher: doc.publisher,
            snippet: doc.snippet,
          })),
          "유튜브",
        ),
        linksFromDocs(webDocs, "웹"),
      ),
    ),
  );

  // Prefer real article titles + publishers; drop generic search placeholders when we have ≥3 news hits.
  const realNewsCount = newsDocs.filter((doc) => doc.publisher && doc.title.length >= 8).length;
  const baseLinks =
    realNewsCount >= 3
      ? base.links.filter((link) => !/네이버 뉴스|관련 최신 뉴스|관련 웹 검색/.test(`${link.source ?? ""} ${link.title}`))
      : base.links;

  const officialGrantLinks: CategoryInfoLink[] = publicGrant?.url
    ? [
        {
          title: publicGrant.title,
          href: publicGrant.url,
          source:
            publicGrant.source === "gov24"
              ? "보조금24"
              : publicGrant.source.startsWith("welfare")
                ? "복지로"
                : "기업마당",
        },
      ]
    : [];

  const specializedLinks: CategoryInfoLink[] = [];
  if (webtoonFacts?.url) {
    specializedLinks.push({
      title: `${webtoonFacts.title} · ${webtoonFacts.platform}`,
      href: webtoonFacts.url,
      source: webtoonFacts.platform,
    });
  }
  if (bookFacts?.url) {
    specializedLinks.push({
      title: `${bookFacts.title} · ${bookFacts.source}`,
      href: bookFacts.url,
      source: bookFacts.source,
    });
  }
  if (ticketFacts?.url) {
    specializedLinks.push({
      title: `${ticketFacts.title} · ${ticketFacts.source}`,
      href: ticketFacts.url,
      source: ticketFacts.source,
    });
  }
  if (foodFacts?.url) {
    specializedLinks.push({
      title: `${name} · ${foodFacts.source} 장소 정보`,
      href: foodFacts.url,
      source: foodFacts.source,
    });
  }
  if (resolvedMelonSong?.href) {
    specializedLinks.unshift({
      title: `${resolvedMelonSong.songName} · 멜론 곡 정보`,
      href: resolvedMelonSong.href,
      source: "멜론",
    });
  }

  let links = ensureQualityNewsLinks(
    name,
    sanitizeRelatedLinks(
      mergeLinks(
        specializedLinks,
        mergeLinks(officialGrantLinks, mergeLinks(crawledLinks, baseLinks)),
      ),
      name,
      base.channel,
    )
      .map((link) => ({
        ...link,
        title: displayLinkTitle(link.title, link.href),
        source: cleanLinkSource(link.source, link.href),
        publishedAt:
          link.publishedAt ||
          inferPublishedAt(link.title, link.source),
      }))
      // Prefer dated news first so UI rarely misses 발행일.
      .sort((a, b) => Number(Boolean(b.publishedAt)) - Number(Boolean(a.publishedAt))),
    {
      minPreferred: isNewsPrimaryChannel(base.channel) ? NEWS_SLA_MIN_REAL : 2,
      maxSearchFallbacks: 0,
      channel: base.channel,
    },
  );

  // Demote search fallbacks for news-primary when SLA is unmet — trust UX.
  if (isNewsPrimaryChannel(base.channel) && !meetsNewsSla(links)) {
    links = realNewsLinks(links);
  }

  if (!synopsis && publicGrant?.summary) {
    synopsis = publicGrant.summary;
  }

  // Gated LLM extract for still-empty required labels (catalogue miss).
  const required = requiredLabelsForChannel(base.channel);
  const missingRequired = required.filter(
    (label) =>
      !label.startsWith("관련 뉴스") &&
      !rows.some(
        (row) =>
          (row.label === label ||
            new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(row.label)) &&
          !isUpdating(row.value),
      ),
  );
  if (missingRequired.length > 0) {
    try {
      const extracted = await extractMissingCategoryFields({
        entityName: name,
        channel: base.channel,
        missingLabels: missingRequired,
        corpus,
      });
      if (extracted.length) {
        rows = fillUpdatingRows(
          rows,
          extracted.map((row) => ({ label: row.label, value: row.value })),
        );
      }
    } catch {
      /* soft — leave UPDATING for trust filter */
    }
  }

  const filledCount = rows.filter((row) => !isUpdating(row.value)).length;
  const realLinkCount = realNewsLinks(links).length;
  const filledRequired = isNewsPrimaryChannel(base.channel)
    ? required.slice(0, realLinkCount)
    : required.filter((label) =>
        rows.some(
          (row) =>
            (row.label === label ||
              new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(row.label)) &&
            !isUpdating(row.value),
        ),
      );
  const fillRate =
    required.length > 0
      ? filledRequired.length / required.length
      : filledCount > 0
        ? 1
        : 0;
  const visitorFillRate = fillRate;
  const usedFallback =
    links.some((link) => isNewsSearchFallbackUrl(link.href)) ||
    rows.some((row) => /추가 수집 중|검색으로 확인|확인 중/.test(row.value));

  if (filledCount > 0 || realLinkCount >= 1 || synopsis) {
    sparse = false;
    if (statusMessage === UPDATING && filledCount > 0) {
      statusMessage = undefined;
    }
  }
  if (isNewsPrimaryChannel(base.channel) && !meetsNewsSla(links) && filledCount === 0) {
    sparse = true;
    statusMessage = statusMessage || "관련 기사 추가 수집 중";
  } else if (sparse && links.length >= 2) {
    statusMessage = statusMessage || UPDATING;
  }

  const usedSpecialized =
    Boolean(webtoonFacts) ||
    Boolean(bookFacts) ||
    Boolean(ticketFacts) ||
    Boolean(foodFacts) ||
    Boolean(publicGrant) ||
    Boolean(housingPublic) ||
    Boolean(youtubeProfile) ||
    Boolean(punditSeed);

  // Persist visitor-visible rows only — placeholders never reach the detail UI.
  const visitorRows = rows.filter((row) => !isUpdating(row.value));

  return {
    ...base,
    rows: containRows(dedupeRows(visitorRows)),
    chips: dedupeChips(chips.filter((chip) => chip.items.length > 0)),
    synopsis: entityNarrativeSummary(synopsis),
    statusMessage: visitorRows.length > 0 ? undefined : statusMessage,
    sparse: visitorRows.length === 0 && realLinkCount < NEWS_SLA_MIN_REAL,
    sparkline,
    sparklines: sparklines.length ? sparklines : undefined,
    links: links.slice(0, 5),
    fillRate: visitorFillRate,
    usedFallback,
    fillStats: {
      filled: filledRequired.length,
      required: required.length || Math.max(filledCount, realLinkCount, 1),
    },
    notice:
      base.notice ||
      (usedSpecialized
        ? "채널 맞춤 정보는 플랫폼·서점·티켓·지도 공개 페이지와 공공데이터·뉴스·웹 문서를 주기적으로 수집해 보완합니다. 공식 발표와 다를 수 있습니다."
        : "채널 맞춤 정보는 공개 뉴스·웹 문서를 주기적으로 수집해 보완합니다. 공식 발표와 다를 수 있습니다."),
    updatedAt: new Date().toISOString(),
  };
}
