import { crawlKeywordNewsRss, publisherLinksFromDescription } from "@/lib/context/crawl-news-rss";
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

export function renderContextBlock(ctx: CollectedContext): string {
  const lines: string[] = [`[포커스 키워드] ${ctx.keyword}`, ""];

  if (ctx.signalFacts.length) {
    lines.push("[실시간 신호 — URL 없음, 배경·맥락 근거로만 사용]");
    ctx.signalFacts.forEach((fact, index) => {
      lines.push(`${index + 1}. ${fact.text}`);
    });
    lines.push("");
  }

  if (ctx.sources.length) {
    lines.push("[수집 자료 (실제 URL 포함)]");
    ctx.sources.forEach((source, index) => {
      const meta = [source.publisher, source.publishedAt, source.tier].filter(Boolean).join(" · ");
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
    const [naverWeb, serperWeb] = await Promise.all([
      fetchNaverWebFallback(keyword, 5),
      fetchSerperWeb(keyword, 5),
    ]);
    if (naverWeb.length) providers.push("naver-web");
    if (serperWeb.length) providers.push("serper-web");
    sources = mergeSources(sources, mergeSources(naverWeb, serperWeb));
    newsCount = countNewsSources(sources);
  }

  const webCount = sources.filter((source) => source.tier === "web").length;
  if (newsCount <= NEWS_FALLBACK_THRESHOLD && webCount <= 2) {
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
  };
  ctx.block = renderContextBlock(ctx);
  return ctx;
}
