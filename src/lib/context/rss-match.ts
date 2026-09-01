import { fetchText } from "@/lib/ingestion/http";
import { namesOverlap } from "@/lib/ingestion/names";
import { parseRssItems } from "@/lib/ingestion/parse";
import type { ContextSource } from "@/lib/context/types";

const FEEDS = [
  {
    id: "news-ent",
    label: "Google News 연예",
    url: "https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=ko&gl=KR&ceid=KR:ko",
  },
  {
    id: "news-kpop",
    label: "Google News K-POP",
    url: "https://news.google.com/rss/search?q=K-POP%20OR%20%EC%95%84%EC%9D%B4%EB%8F%8C&hl=ko&gl=KR&ceid=KR:ko",
  },
  {
    id: "news-tv",
    label: "Google News 방송",
    url: "https://news.google.com/rss/search?q=%EC%98%88%EB%8A%A5%20OR%20%EB%93%9C%EB%9D%BC%EB%A7%88&hl=ko&gl=KR&ceid=KR:ko",
  },
  {
    id: "news-creator",
    label: "Google News 크리에이터",
    url: "https://news.google.com/rss/search?q=%EC%9C%A0%ED%8A%9C%EB%B2%84%20OR%20%EC%9D%B8%ED%94%8C%EB%A3%A8%EC%96%B8%EC%84%9C&hl=ko&gl=KR&ceid=KR:ko",
  },
  {
    id: "news-kr",
    label: "Google News 한국",
    url: "https://news.google.com/rss/headlines/section/topic/NATION?hl=ko&gl=KR&ceid=KR:ko",
  },
];

function formatDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const time = new Date(raw).getTime();
  if (!Number.isFinite(time)) return undefined;
  return new Date(time).toISOString().slice(0, 10);
}

function usableUrl(link: string | undefined): link is string {
  if (!link) return false;
  try {
    const url = new URL(link);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Scans category RSS feeds for headlines mentioning the keyword.
 * These hits become both signal facts and optional citable news-tier sources.
 */
export async function matchKeywordInRss(keyword: string, limit = 5): Promise<ContextSource[]> {
  const seen = new Set<string>();
  const hits: ContextSource[] = [];

  const settled = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const xml = await fetchText(feed.url, {
        headers: { Accept: "application/rss+xml,application/xml,text/xml" },
      });
      return { feed, items: parseRssItems(xml) };
    }),
  );

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value.items) {
      if (!namesOverlap(keyword, item.title)) continue;
      const url = item.link;
      if (!usableUrl(url) || seen.has(url)) continue;
      seen.add(url);
      hits.push({
        title: item.title,
        url,
        publisher: result.value.feed.label,
        publishedAt: formatDate(item.pubDate),
        snippet: item.description?.slice(0, 220),
        tier: "news",
      });
      if (hits.length >= limit) return hits;
    }
  }

  return hits;
}
