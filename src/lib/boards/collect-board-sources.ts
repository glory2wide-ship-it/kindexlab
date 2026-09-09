import type { AnalysisLogger } from "@/lib/analysis/log";
import {
  filterSourcesByBoardSense,
  rankSourcesByBoardSense,
  resolveBoardSense,
} from "@/lib/boards/sense";
import type { BoardDefinition } from "@/lib/boards/types";
import { fetchGoogleCustomSearch } from "@/lib/context/fallback-google-cse";
import { fetchNaverWebFallback } from "@/lib/context/fallback-naver";
import { fetchSerperWeb } from "@/lib/context/fallback-serper";
import { fetchYoutubeFallback } from "@/lib/context/fallback-youtube";
import { officialUrlSeeds } from "@/lib/context/official-url-seeds";
import { NEWS_FALLBACK_THRESHOLD } from "@/lib/context/score";
import { resolveSourceStrategy, type SourceStrategyPlan } from "@/lib/context/source-strategy";
import type { ContextSource, ContextTier } from "@/lib/context/types";
import { activeMarket } from "@/lib/market/config";
import { classifyPublisher } from "@/lib/news/publishers";
import { retrieveNewsForKeyword } from "@/lib/news/retrieve";
import type { NewsDoc } from "@/lib/news/types";

/**
 * Boards whose rankings should expand beyond news RSS into official pages,
 * blogs, web documents, and YouTube when news coverage is thin or the topic
 * is inherently non-news (grants, travel UGC, reviews, etc.).
 */
export const EXPANDED_CRAWL_BOARD_SLUGS = new Set([
  "government-subsidy-search",
  "government-support-fund",
  "culture-leisure-grant-ranking",
  "travel-government-grant-ranking",
  "entertainment-government-grant-ranking",
  "domestic-travel-ranking",
  "overseas-travel-ranking",
  "weekend-outing-ranking",
  "food-restaurant-ranking",
  "ott-buzz-ranking",
  "political-pundit-ranking",
  "housing-subscription-hotspot",
  "health-info-ranking",
  "car-review-ranking",
]);

const LOOKBACK_HOURS = 168;

export interface BoardSourceCollection {
  docs: NewsDoc[];
  publishers: string[];
  providers: string[];
  strategy: string;
  strategyHint?: string;
  tierCounts: Partial<Record<ContextTier, number>>;
  expanded: boolean;
}

function mergeSources(existing: ContextSource[], incoming: ContextSource[]): ContextSource[] {
  const seen = new Set(existing.map((source) => source.url));
  const out = [...existing];
  for (const source of incoming) {
    if (!source.url || seen.has(source.url)) continue;
    seen.add(source.url);
    out.push(source);
  }
  return out;
}

function tierLabel(tier: ContextTier): string {
  switch (tier) {
    case "news":
      return "뉴스";
    case "web":
      return "웹·공식·블로그";
    case "youtube":
      return "유튜브·SNS";
    case "signal":
      return "시그널";
    default:
      return "자료";
  }
}

function contextToNewsDoc(source: ContextSource): NewsDoc {
  const kind = classifyPublisher(activeMarket(), source.publisher, source.url);
  const snippet = [source.snippet?.trim(), source.url ? `URL: ${source.url}` : ""]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 360);
  return {
    title: `[${tierLabel(source.tier)}] ${source.title}`.slice(0, 160),
    publisher: source.publisher || tierLabel(source.tier),
    link: source.url,
    publishedAt: source.publishedAt,
    snippet: snippet || undefined,
    source: source.tier === "news" ? "google-news" : "serper",
    publisherKind: kind === "ugc" ? "unknown" : kind,
  };
}

function newsDocToContext(doc: NewsDoc): ContextSource | null {
  if (!doc.link && !doc.title) return null;
  return {
    title: doc.title,
    url: doc.link || `news://${encodeURIComponent(doc.title)}`,
    publisher: doc.publisher || "뉴스",
    publishedAt: doc.publishedAt?.slice(0, 10),
    snippet: doc.snippet,
    tier: "news",
  };
}

function countTiers(sources: ContextSource[]): Partial<Record<ContextTier, number>> {
  const counts: Partial<Record<ContextTier, number>> = {};
  for (const source of sources) {
    counts[source.tier] = (counts[source.tier] ?? 0) + 1;
  }
  return counts;
}

async function retrieveNewsDocs(
  board: BoardDefinition,
  logger: AnalysisLogger,
): Promise<NewsDoc[]> {
  const settled = await Promise.allSettled(
    board.queries.map((query) =>
      retrieveNewsForKeyword(query, {
        limit: board.channel === "entertainment" ? 8 : 5,
        lookbackHours: LOOKBACK_HOURS,
        trustedOnly: false,
        allowMarketTape: true,
        skipAliasFilter: true,
      }),
    ),
  );

  const docs: NewsDoc[] = [];
  const seen = new Set<string>();
  for (const [index, result] of settled.entries()) {
    const query = board.queries[index] ?? board.focusKeyword;
    if (result.status !== "fulfilled") {
      logger.warn("board:rss-failed", {
        query,
        error: result.reason instanceof Error ? result.reason.message : "unknown",
      });
      continue;
    }
    logger.step("board:rss", {
      query,
      fetched: result.value.stats.fetched,
      kept: result.value.stats.kept,
      providers: result.value.providers.join(","),
    });
    console.log(
      `[rebuild:rss] channel=${board.channel} board=${board.slug} query="${query}" fetched=${result.value.stats.fetched} kept=${result.value.stats.kept}`,
    );
    for (const doc of result.value.docs) {
      const key = doc.link ?? doc.title;
      if (seen.has(key)) continue;
      seen.add(key);
      docs.push(doc);
    }
  }
  return docs;
}

async function expandAltSources(input: {
  board: BoardDefinition;
  plan: SourceStrategyPlan;
  seedQueries: string[];
  providers: string[];
}): Promise<{ sources: ContextSource[]; providers: string[] }> {
  const { board, plan, seedQueries } = input;
  let sources: ContextSource[] = [];
  const providers = [...input.providers];

  for (const keyword of seedQueries.slice(0, 3)) {
    const seeded = officialUrlSeeds({
      keyword,
      boardSlug: board.slug,
      strategy: plan.strategy,
    });
    if (seeded.length) {
      providers.push(`official-url-seeds+${keyword}`);
      sources = mergeSources(sources, seeded);
    }
  }

  if (plan.prioritizeYoutube) {
    for (const query of plan.queries.slice(0, 2)) {
      const videos = await fetchYoutubeFallback(query, plan.youtubeLimit);
      if (videos.length) {
        providers.push(`youtube-fallback+${query}`);
        sources = mergeSources(sources, videos);
      }
      if (sources.filter((item) => item.tier === "youtube").length >= plan.youtubeLimit) break;
    }
  }

  const searchQueries = [...new Set([board.focusKeyword, ...plan.queries, ...seedQueries])]
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

  for (const query of searchQueries) {
    const [naverWeb, serperWeb, googleCse] = await Promise.all([
      fetchNaverWebFallback(query, plan.blogLimit + plan.webLimit, {
        preferBlog: plan.prioritizeBlog,
        preferOfficial: plan.prioritizeOfficial,
      }),
      fetchSerperWeb(query, plan.webLimit, {
        allowUgc: plan.allowUgc,
        preferOfficial: plan.prioritizeOfficial,
      }),
      plan.prioritizeOfficial || plan.strategy === "review-web"
        ? fetchGoogleCustomSearch(query, 8)
        : Promise.resolve([] as ContextSource[]),
    ]);
    if (naverWeb.length) providers.push(`naver-web+${query}`);
    if (serperWeb.length) providers.push(`serper-web+${query}`);
    if (googleCse.length) providers.push(`google-cse+${query}`);
    sources = mergeSources(sources, mergeSources(mergeSources(naverWeb, serperWeb), googleCse));
    if (sources.length >= 10) break;
  }

  if (
    !plan.prioritizeYoutube &&
    sources.filter((item) => item.tier === "youtube").length < 2 &&
    (plan.youtubeLimit > 0 || plan.strategy === "review-web")
  ) {
    const videos = await fetchYoutubeFallback(board.focusKeyword, Math.max(2, plan.youtubeLimit));
    if (videos.length) {
      providers.push("youtube-fallback");
      sources = mergeSources(sources, videos);
    }
  }

  return { sources, providers };
}

/**
 * News RSS plus strategy-biased official / blog / web / YouTube expansion for
 * grant·travel·OTT·pundit·housing·health·car·outing·food boards.
 */
export async function collectBoardSources(
  board: BoardDefinition,
  logger: AnalysisLogger,
): Promise<BoardSourceCollection> {
  const newsDocs = await retrieveNewsDocs(board, logger);
  const plan = resolveSourceStrategy({
    keyword: board.focusKeyword,
    boardSlug: board.slug,
    channel: board.channel,
  });
  const sense = resolveBoardSense({
    boardSlug: board.slug,
    keyword: board.focusKeyword,
  });

  let sources = newsDocs
    .map(newsDocToContext)
    .filter((item): item is ContextSource => Boolean(item));
  let providers = [`strategy:${plan.strategy}`, "board-news-rss"];

  const shouldExpand =
    EXPANDED_CRAWL_BOARD_SLUGS.has(board.slug) ||
    plan.strategy !== "news-first" ||
    newsDocs.length <= NEWS_FALLBACK_THRESHOLD;

  if (shouldExpand) {
    const expanded = await expandAltSources({
      board,
      plan,
      seedQueries: [board.focusKeyword, ...board.queries.slice(0, 2), ...board.seeds.slice(0, 2)],
      providers,
    });
    sources = mergeSources(sources, expanded.sources);
    providers = expanded.providers;
    logger.step("board:expand-crawl", {
      strategy: plan.strategy,
      added: expanded.sources.length,
      providers: expanded.providers.filter((item) => !item.startsWith("strategy:")).slice(0, 8).join(","),
    });
    console.log(
      `[rebuild:expand] board=${board.slug} strategy=${plan.strategy} sources=${sources.length} providers=${providers.length}`,
    );
  }

  sources = filterSourcesByBoardSense(rankSourcesByBoardSense(sources, sense), sense);
  const docs = sources.map(contextToNewsDoc);
  const cap = board.channel === "entertainment" ? 28 : EXPANDED_CRAWL_BOARD_SLUGS.has(board.slug) ? 22 : 12;
  const sliced = docs.slice(0, cap);
  const publishers = [...new Set(sliced.map((doc) => doc.publisher).filter(Boolean))] as string[];

  logger.step("board:retrieve", {
    queries: board.queries.length,
    docs: sliced.length,
    news: newsDocs.length,
    expanded: shouldExpand,
    strategy: plan.strategy,
    publishers: publishers.slice(0, 4).join(","),
  });

  return {
    docs: sliced,
    publishers,
    providers,
    strategy: plan.strategy,
    strategyHint: plan.promptHint || undefined,
    tierCounts: countTiers(sources),
    expanded: shouldExpand,
  };
}
