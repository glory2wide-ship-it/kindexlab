/**
 * Live news + YouTube crawls for economy / culture / travel heatmap boards.
 * Emits ChartRows tagged with boardSlug so compose can stamp live-chart entities.
 */
import { getBoard, menuBoardsForChannel } from "@/lib/boards/registry";
import { fetchYoutubeFallback } from "@/lib/context/fallback-youtube";
import { officialUrlSeeds } from "@/lib/context/official-url-seeds";
import { fetchText, nowIso } from "@/lib/ingestion/http";
import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import { decodeHtml, parseRssItems, stripTags } from "@/lib/ingestion/parse";
import type { ChartRow, SourceResult } from "@/lib/ingestion/types";
import { activeMarket } from "@/lib/market/config";
import { retrieveNewsForKeyword } from "@/lib/news/retrieve";
import { parseBracketLabel } from "@/lib/politics/labeled-rank";
import type { PostChannel } from "@/lib/posts/types";

function result(id: string, label: string, items: ChartRow[], error?: string): SourceResult {
  return {
    id,
    label,
    ok: !error && items.length > 0,
    count: items.length,
    error: error ?? (items.length ? undefined : "no rows"),
    fetchedAt: nowIso(),
    items,
  };
}

function cleanHeadline(title: string): string {
  return decodeHtml(stripTags(title))
    .replace(/\s+[-–|]\s+[^-–|]+$/, "")
    .replace(/^[\[【].*?[\]】]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchSeedNames(title: string, seeds: readonly string[]): string[] {
  const cleaned = cleanHeadline(title);
  const hits: string[] = [];
  for (const seed of seeds) {
    const labeled = parseBracketLabel(seed);
    const subject = labeled?.subject ?? seed;
    if (namesOverlap(seed, cleaned) || namesOverlap(subject, cleaned)) {
      hits.push(seed);
    }
  }
  return hits;
}

function extractShortTopic(title: string): string | undefined {
  const cleaned = cleanHeadline(title);
  if (cleaned.length < 4 || cleaned.length > 36) return undefined;
  if (/^(속보|단독|종합|영상|포토|오늘|이유|충격|공개)$/.test(cleaned)) return undefined;
  // Prefer quoted phrases.
  const quoted = cleaned.match(/[「『“"‘']([^」』”"’']{2,24})[」』”"’']/);
  if (quoted?.[1]) return quoted[1].trim();
  // Drop trailing news verbs for a usable topic label.
  const trimmed = cleaned
    .replace(/(?:한다|됐다|된다|인가|되나|전망|속보|종합)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (trimmed.length >= 4 && trimmed.length <= 28) return trimmed;
  return undefined;
}

interface LiveBoardSpec {
  boardSlug: string;
  channel: PostChannel;
  label: string;
  queries: string[];
  seeds: readonly string[];
  /** official-grant boards: homepage seeds first, then news. */
  grant?: boolean;
  /** economy: prefer Naver news weight. */
  preferNaver?: boolean;
}

const SKIP_LIVE_BOARDS = new Set([
  // 공연·전시는 티켓 랭킹 + 뉴스/YouTube 시드를 함께 쓴다 (지역 커버리지).
  "bestseller-surge-index",
  "eco-headline-news-ranking",
]);

function boardSpecsForChannel(channel: PostChannel): LiveBoardSpec[] {
  return menuBoardsForChannel(channel)
    .filter((board) => !board.deskKind && !SKIP_LIVE_BOARDS.has(board.slug))
    .map((board) => ({
      boardSlug: board.slug,
      channel,
      label: board.shortTitle,
      queries: board.queries.slice(0, 2),
      seeds: board.seeds,
      grant:
        board.slug.includes("grant") ||
        board.slug === "government-subsidy-search" ||
        board.slug === "government-support-fund" ||
        board.slug === "culture-leisure-grant-ranking" ||
        board.slug === "travel-government-grant-ranking",
      preferNaver: channel === "economy",
    }));
}

async function googleNewsRss(query: string): Promise<{ title: string; link?: string }[]> {
  const market = activeMarket();
  const url =
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}` +
    `&hl=${market.googleNews.hl}&gl=${market.googleNews.gl}&ceid=${market.googleNews.ceid}`;
  try {
    const xml = await fetchText(url, {
      headers: {
        Accept: "application/rss+xml,application/xml,text/xml,*/*",
        Referer: "https://news.google.com/",
      },
    });
    return parseRssItems(xml).map((item) => ({ title: item.title, link: item.link }));
  } catch {
    return [];
  }
}

async function collectNewsTitles(
  spec: LiveBoardSpec,
): Promise<{ title: string; weight: number; via: string }[]> {
  const out: { title: string; weight: number; via: string }[] = [];

  if (spec.grant) {
    for (const seed of spec.seeds.slice(0, 8)) {
      const official = officialUrlSeeds({
        keyword: seed,
        boardSlug: spec.boardSlug,
        strategy: "official-grant",
      });
      for (const source of official) {
        out.push({ title: seed, weight: 3, via: `official:${source.url}` });
      }
    }
  }

  for (const query of spec.queries.slice(0, 2)) {
    try {
      const retrieval = await retrieveNewsForKeyword(query, {
        limit: spec.preferNaver ? 10 : 6,
        lookbackHours: 72,
        trustedOnly: false,
        allowMarketTape: true,
        skipAliasFilter: true,
        preferNaver: spec.preferNaver,
      });
      for (const doc of retrieval.docs) {
        const boost = doc.source === "naver-news" && spec.preferNaver ? 2.5 : 1;
        out.push({ title: doc.title, weight: boost, via: doc.source });
      }
    } catch {
      /* provider failure — RSS below still helps */
    }
    const rss = await googleNewsRss(query);
    for (const item of rss.slice(0, 10)) {
      out.push({ title: item.title, weight: 1, via: "google-rss" });
    }
  }

  // Culture/travel/economy/entertainment/politics: YouTube fills gaps and always adds signal.
  const newsWeight = out.reduce((sum, row) => sum + row.weight, 0);
  const needYoutube = !spec.grant && (newsWeight < 12 || spec.channel !== "economy");
  const economyYoutube = spec.channel === "economy" && newsWeight < 14;
  const alwaysYoutube =
    spec.channel === "entertainment" ||
    spec.channel === "politics" ||
    spec.channel === "culture" ||
    spec.channel === "travel";
  if (needYoutube || economyYoutube || alwaysYoutube) {
    for (const query of spec.queries.slice(0, 2)) {
      const videos = await fetchYoutubeFallback(
        query,
        spec.channel === "economy" ? 4 : spec.channel === "entertainment" ? 6 : 5,
      );
      for (const video of videos) {
        out.push({ title: video.title, weight: newsWeight < 8 ? 1.4 : 0.9, via: "youtube" });
      }
    }
  }

  return out;
}

function rankTitlesToRows(
  spec: LiveBoardSpec,
  titles: { title: string; weight: number; via: string }[],
): ChartRow[] {
  const counts = new Map<string, { name: string; metric: number; tags: string[] }>();

  const bump = (name: string, weight: number, via: string) => {
    const key = normalizeName(name);
    if (!key || key.length < 2) return;
    const current = counts.get(key);
    const tags = [spec.boardSlug, "live-chart", via.split(":")[0] ?? via];
    if (current) {
      current.metric += weight;
      current.tags = [...new Set([...current.tags, ...tags])];
    } else {
      counts.set(key, { name, metric: weight, tags });
    }
  };

  let seedHits = 0;
  for (const row of titles) {
    const hits = matchSeedNames(row.title, spec.seeds);
    if (hits.length) {
      seedHits += hits.length;
      for (const name of hits) bump(name, row.weight * 1.5, row.via);
    }
  }

  // Only invent free-form topics when seed coverage is thin.
  // Star board must stay person-seeded — never invent drama/company titles.
  if (seedHits < 6 && spec.boardSlug !== "star-reputation-index") {
    for (const row of titles) {
      if (matchSeedNames(row.title, spec.seeds).length) continue;
      const topic = extractShortTopic(row.title);
      if (!topic) continue;
      // Drop blog chrome / clickbait fragments.
      if (/네이버|블로그|카페|클릭|속보|영상|포토|무조건|충격|이유/i.test(topic)) continue;
      if (/\s/.test(topic) && topic.length > 18) continue;
      bump(topic, row.weight * 0.8, row.via);
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.metric - a.metric)
    .slice(0, 24)
    .map((item, index) => ({
      rank: index + 1,
      title: item.name,
      metric: item.metric,
      tags: item.tags,
      subtitle: `${spec.label} 실시간`,
    }));
}

async function fetchBoardLive(spec: LiveBoardSpec): Promise<SourceResult> {
  const id = `live-${spec.channel}-${spec.boardSlug}`;
  try {
    const titles = await collectNewsTitles(spec);
    const items = rankTitlesToRows(spec, titles);
    return result(id, `${spec.label} 라이브`, items);
  } catch (error) {
    return result(id, `${spec.label} 라이브`, [], error instanceof Error ? error.message : "failed");
  }
}

/** All menu boards across desks → live-chart source batches (news + YouTube). */
export async function fetchCategoryLiveSources(): Promise<SourceResult[]> {
  const channels: PostChannel[] = ["economy", "culture", "travel", "entertainment", "politics"];
  const specs = channels.flatMap(boardSpecsForChannel);
  // Cap concurrent board crawls to avoid hammering news/YouTube APIs.
  const concurrency = 4;
  const out: SourceResult[] = [];
  for (let i = 0; i < specs.length; i += concurrency) {
    const batch = specs.slice(i, i + concurrency);
    const settled = await Promise.all(batch.map(fetchBoardLive));
    out.push(...settled);
  }
  return out;
}

/** Rows from category-live sources for a given board slug. */
export function pickCategoryLiveRows(sources: SourceResult[], boardSlug: string): ChartRow[] {
  const board = getBoard(boardSlug);
  const matched = sources.filter(
    (source) =>
      source.id === `live-${board?.channel ?? ""}-${boardSlug}` ||
      source.items.some((item) => item.tags?.includes(boardSlug)),
  );
  const merged = new Map<string, ChartRow>();
  for (const source of matched) {
    for (const item of source.items) {
      const key = normalizeName(item.title);
      if (!key) continue;
      const prev = merged.get(key);
      if (!prev || (item.metric ?? 0) > (prev.metric ?? 0)) {
        merged.set(key, {
          ...item,
          tags: [...new Set([...(item.tags ?? []), boardSlug, "live-chart"])],
        });
      }
    }
  }
  return [...merged.values()]
    .sort((a, b) => (b.metric ?? 0) - (a.metric ?? 0))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

/** Every category-live source that produced rows (for compose fan-out). */
export function listCategoryLiveBoardSlugs(sources: SourceResult[]): string[] {
  const slugs = new Set<string>();
  for (const source of sources) {
    const match = source.id.match(/^live-(?:economy|culture|travel|entertainment|politics)-(.+)$/);
    if (match?.[1]) slugs.add(match[1]);
    for (const item of source.items) {
      const tag = item.tags?.find((t) => t !== "live-chart" && !t.includes(":"));
      if (tag && getBoard(tag)) slugs.add(tag);
    }
  }
  return [...slugs];
}
