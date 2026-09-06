import { crawlKeywordNewsRss, publisherLinksFromDescription } from "@/lib/context/crawl-news-rss";
import { fetchGoogleCustomSearch } from "@/lib/context/fallback-google-cse";
import { fetchNaverWebFallback } from "@/lib/context/fallback-naver";
import { fetchSerperWeb } from "@/lib/context/fallback-serper";
import { fetchYoutubeFallback } from "@/lib/context/fallback-youtube";
import { buildIntentHints, buildSparseIntentHints } from "@/lib/context/intent-outline";
import {
  computeContextScore,
  countNewsSources,
  NEWS_FALLBACK_THRESHOLD,
} from "@/lib/context/score";
import { buildSignalBrief } from "@/lib/context/signal-brief";
import type { CollectedContext, ContextSource } from "@/lib/context/types";
import { retrieveNewsForKeyword } from "@/lib/news/retrieve";
import { isGoogleNewsUrl, publisherFromUrl, unwrapNewsUrls } from "@/lib/news/unwrap";
import type { RankingEntity } from "@/lib/types";

const DEFAULT_LIMIT = 8;
const LOOKBACK_LADDER_HOURS = [96, 336, 720] as const;

function usableUrl(link: string | undefined): link is string {
  if (!link) return false;
  try {
    const url = new URL(link);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const time = new Date(raw).getTime();
  if (!Number.isFinite(time)) return undefined;
  return new Date(time).toISOString().slice(0, 10);
}

/** Days from publishedAt (YYYY-MM-DD) to editionDate (KST calendar). */
export function daysBeforeEdition(publishedAt: string | undefined, editionDate: string): number | null {
  if (!publishedAt || !/^\d{4}-\d{2}-\d{2}/.test(editionDate)) return null;
  const pubDay = publishedAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}/.test(pubDay)) return null;
  const pub = Date.parse(`${pubDay}T00:00:00+09:00`);
  const ed = Date.parse(`${editionDate}T00:00:00+09:00`);
  if (!Number.isFinite(pub) || !Number.isFinite(ed)) return null;
  return Math.round((ed - pub) / 86_400_000);
}

export function freshnessLabel(days: number | null): string {
  if (days === null) return "발행일 미확인";
  if (days < 0) return `에디션 ${Math.abs(days)}일 후 발행`;
  if (days <= 3) return `최신(에디션 ${days}일 전)`;
  if (days <= 14) return `최근(에디션 ${days}일 전)`;
  if (days <= 45) return `배경(에디션 ${days}일 전)`;
  return `오래된 배경(에디션 ${days}일 전) — 메인 앵글 금지`;
}

function mergeSources(existing: ContextSource[], incoming: ContextSource[]): ContextSource[] {
  const seen = new Set(existing.map((source) => source.url));
  const out = [...existing];
  for (const source of incoming) {
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    out.push(source);
  }
  return out;
}

function sourceSnippetChars(sources: ContextSource[]): number {
  return sources.reduce((sum, source) => sum + (source.snippet?.replace(/\s+/g, "").length ?? 0), 0);
}

function tierCounts(sources: ContextSource[]): Partial<Record<ContextSource["tier"], number>> {
  const counts: Partial<Record<ContextSource["tier"], number>> = {};
  for (const source of sources) {
    counts[source.tier] = (counts[source.tier] ?? 0) + 1;
  }
  return counts;
}

async function materializeSources(
  docs: { title: string; link?: string; publisher?: string; publishedAt?: string; snippet?: string }[],
): Promise<{ sources: ContextSource[]; unwrapped: { resolved: number; failed: number } }> {
  const links = docs.map((doc) => doc.link).filter(usableUrl);
  const { resolved, stats } = await unwrapNewsUrls(links);
  const seen = new Set<string>();
  const sources: ContextSource[] = [];

  for (const doc of docs) {
    if (!usableUrl(doc.link)) continue;
    const target = resolved.get(doc.link);
    if (!target || isGoogleNewsUrl(target) || seen.has(target)) continue;
    seen.add(target);
    sources.push({
      title: doc.title,
      url: target,
      publisher: doc.publisher || publisherFromUrl(target),
      publishedAt: formatDate(doc.publishedAt),
      snippet: doc.snippet?.slice(0, 220),
      tier: "news",
    });
  }
  return { sources, unwrapped: { resolved: stats.resolved, failed: stats.failed } };
}

async function newsSourcesFromRetrieval(
  keyword: string,
  options: { limit?: number; lookbackHours?: number },
): Promise<{
  sources: ContextSource[];
  providers: string[];
  unwrapped: { resolved: number; failed: number };
  lookbackHours: number;
}> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const ladder = options.lookbackHours ? [options.lookbackHours] : [...LOOKBACK_LADDER_HOURS];

  let providers: string[] = [];
  let sources: ContextSource[] = [];
  let unwrapped = { resolved: 0, failed: 0 };
  let lookbackHours = ladder[0] ?? 96;

  for (const hours of ladder) {
    const retrieval = await retrieveNewsForKeyword(keyword, {
      limit,
      lookbackHours: hours,
      // Boards already ingest with trustedOnly:false; matching that here keeps
      // articles that Google labels without a recognised outlet string.
      trustedOnly: false,
    });
    providers = retrieval.providers;
    lookbackHours = hours;

    const materialized = await materializeSources(retrieval.docs);
    unwrapped = materialized.unwrapped;

    const seen = new Set<string>();
    sources = [];
    for (const source of materialized.sources) {
      if (seen.has(source.url)) continue;
      seen.add(source.url);
      sources.push(source);
    }

    if (sources.length > NEWS_FALLBACK_THRESHOLD) break;
  }

  return { sources, providers, unwrapped, lookbackHours };
}

export function renderContextBlock(
  ctx: CollectedContext,
  options?: { asOfDate?: string },
): string {
  const asOf = options?.asOfDate?.trim();
  const lines: string[] = [`[포커스 키워드] ${ctx.keyword}`, ""];

  if (asOf) {
    lines.push(`[에디션 기준일(KST)] ${asOf}`);
    lines.push(
      "시의성: 최신(≤3일)·최근(≤14일)을 title·❶ 앵글로. 배경·오래된 배경은 과거형 배경만. 오래된 배경으로 오늘의 심층을 쓰지 마세요.",
    );
    lines.push("");
  }

  if (ctx.signalFacts.length) {
    lines.push("[실시간 신호 — URL 없음, 배경·맥락 근거로만 사용]");
    ctx.signalFacts.forEach((fact, index) => {
      lines.push(`${index + 1}. ${fact.text}`);
    });
    lines.push("");
  }

  if (ctx.sources.length) {
    const ranked = [...ctx.sources].sort((a, b) => {
      const da = daysBeforeEdition(a.publishedAt, asOf ?? "") ?? 9_999;
      const db = daysBeforeEdition(b.publishedAt, asOf ?? "") ?? 9_999;
      return da - db;
    });
    lines.push("[수집 자료 (실제 URL 포함 · 최신순)]");
    ranked.forEach((source, index) => {
      const age = asOf ? freshnessLabel(daysBeforeEdition(source.publishedAt, asOf)) : undefined;
      const meta = [source.publisher, source.publishedAt, age, source.tier]
        .filter(Boolean)
        .join(" · ");
      lines.push(`${index + 1}. ${source.title}`);
      lines.push(`   출처: ${meta}`);
      lines.push(`   URL: ${source.url}`);
      if (source.snippet) lines.push(`   요약: ${source.snippet}`);
    });
    lines.push("");
    lines.push("위 URL 목록에 없는 주소는 어떤 경우에도 본문에 쓰지 마세요.");
  } else {
    lines.push("[수집 자료] URL이 확보되지 않았습니다. 외부 링크를 만들어 내지 마세요.");
  }

  if (ctx.intentHints.length) {
    lines.push("");
    lines.push("[연관 검색 의도 — FAQ·소제목 구조 참고용, 사실 근거로 쓰지 마세요]");
    ctx.intentHints.forEach((hint, index) => {
      lines.push(`${index + 1}. ${hint}`);
    });
  }

  return lines.join("\n");
}

export interface CollectContextOptions {
  limit?: number;
  lookbackHours?: number;
  entity?: RankingEntity;
  related?: RankingEntity[];
  relatedKeywords?: string[];
  /** KST edition date — used to label RAG freshness in the prompt block. */
  asOfDate?: string;
}

/**
 * 4-Tier hybrid collector for 오늘의 분석 / premium columns.
 *
 * Tier 0: Signal Brief (entity, board note, RSS match)
 * Tier 1: News RSS/API with lookback ladder
 * Tier 2: Serper web + YouTube (when news ≤ 2)
 * Tier 3: Intent hints (structure only)
 */
export async function collectArticleContext(
  keyword: string,
  options: CollectContextOptions = {},
): Promise<CollectedContext> {
  const { entity, related = [], relatedKeywords = [] } = options;

  const signal = await buildSignalBrief({ keyword, entity, related });

  const [crawled, news] = await Promise.all([
    crawlKeywordNewsRss(keyword, DEFAULT_LIMIT),
    newsSourcesFromRetrieval(keyword, options),
  ]);

  let sources = mergeSources(crawled, news.sources);
  sources = mergeSources(sources, signal.rssSources);

  let newsCount = countNewsSources(sources);
  const providers = [...news.providers];

  if (newsCount <= NEWS_FALLBACK_THRESHOLD) {
    const [naverWeb, serperWeb, googleCse] = await Promise.all([
      fetchNaverWebFallback(keyword, 5),
      fetchSerperWeb(keyword, 5),
      fetchGoogleCustomSearch(keyword, 5),
    ]);
    if (naverWeb.length) providers.push("naver-web");
    if (serperWeb.length) providers.push("serper-web");
    if (googleCse.length) providers.push("google-cse");
    sources = mergeSources(sources, mergeSources(mergeSources(naverWeb, serperWeb), googleCse));
    newsCount = countNewsSources(sources);
  }

  const webCount = sources.filter((source) => source.tier === "web").length;
  const snippetCharsAfterWeb = sourceSnippetChars(sources);
  if (newsCount <= NEWS_FALLBACK_THRESHOLD && (webCount <= 2 || snippetCharsAfterWeb < 260)) {
    const videos = await fetchYoutubeFallback(keyword, 3);
    if (videos.length) providers.push("youtube-fallback");
    sources = mergeSources(sources, videos);
  }

  const sparse = newsCount <= NEWS_FALLBACK_THRESHOLD || sources.length <= 3;
  const intentHints = sparse
    ? buildSparseIntentHints({
        keyword,
        entityType: entity?.type,
        related: relatedKeywords.length
          ? relatedKeywords
          : related.map((item) => item.name).slice(0, 4),
      })
    : buildIntentHints({
        keyword,
        entityType: entity?.type,
        related: relatedKeywords.length
          ? relatedKeywords
          : related.map((item) => item.name).slice(0, 4),
      });

  const score = computeContextScore(signal.facts, sources);

  const ctx: CollectedContext = {
    keyword,
    sources,
    signalFacts: signal.facts,
    providers,
    block: "",
    unwrapped: news.unwrapped,
    lookbackHours: news.lookbackHours,
    score,
    intentHints,
    sourceTextChars: sourceSnippetChars(sources),
    tierCounts: tierCounts(sources),
  };
  ctx.block = renderContextBlock(ctx, { asOfDate: options.asOfDate });
  return ctx;
}
