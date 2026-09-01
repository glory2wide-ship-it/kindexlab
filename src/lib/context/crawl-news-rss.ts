import { fetchText } from "@/lib/ingestion/http";
import { activeMarket } from "@/lib/market/config";
import { classifyPublisher } from "@/lib/news/publishers";
import { parseRssItems } from "@/lib/ingestion/parse";
import { isGoogleNewsUrl, publisherFromUrl, resolvePublisherUrl } from "@/lib/news/unwrap";
import type { ContextSource } from "@/lib/context/types";

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

/** Pulls publisher URLs embedded in Google News RSS description HTML. */
export function publisherLinksFromDescription(html: string | undefined): string[] {
  if (!html) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of html.matchAll(/href="(https?:\/\/[^"]+)"/gi)) {
    const url = match[1]?.trim();
    if (!url || !usableUrl(url) || isGoogleNewsUrl(url)) continue;
    if (url.includes("google.com/")) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function splitPublisher(raw: string): { title: string; publisher?: string } {
  let title = raw.trim();
  let publisher: string | undefined;
  for (let guard = 0; guard < 3; guard += 1) {
    const match = title.match(/^(.+?)\s+[-–]\s+([^-–]{2,24})$/);
    if (!match?.[1] || !match[2]) break;
    title = match[1].trim();
    publisher = match[2].trim();
  }
  return { title, publisher };
}

/**
 * Tier 1b — keyword-scoped Google News RSS crawl.
 * Boards use trustedOnly:false; this path mirrors that so CI runners keep
 * articles that would otherwise be dropped as "unknown" before unwrap runs.
 */
export async function crawlKeywordNewsRss(keyword: string, limit = 8): Promise<ContextSource[]> {
  const market = activeMarket();
  const { hl, gl, ceid } = market.googleNews;
  const feedUrl =
    `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}` +
    `&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;

  let xml: string;
  try {
    xml = await fetchText(feedUrl, {
      headers: { Accept: "application/rss+xml,application/xml,text/xml" },
    });
  } catch {
    return [];
  }

  const sources: ContextSource[] = [];
  const seen = new Set<string>();

  for (const item of parseRssItems(xml)) {
    if (!item.title) continue;
    const { title, publisher: feedPublisher } = splitPublisher(item.title);
    const candidates = [
      item.link,
      ...publisherLinksFromDescription(item.description),
    ].filter(usableUrl);

    for (const raw of candidates) {
      const resolved = await resolvePublisherUrl(raw);
      if (!resolved || isGoogleNewsUrl(resolved)) continue;
      if (classifyPublisher(market, feedPublisher, resolved) === "ugc") continue;
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      sources.push({
        title,
        url: resolved,
        publisher: feedPublisher || publisherFromUrl(resolved),
        publishedAt: formatDate(item.pubDate),
        snippet: item.description?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220),
        tier: "news",
      });
      if (sources.length >= limit) return sources;
    }
  }

  return sources;
}
