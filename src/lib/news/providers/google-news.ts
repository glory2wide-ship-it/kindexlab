import Parser from "rss-parser";
import { fetchText } from "@/lib/ingestion/http";
import { decodeHtml, stripTags } from "@/lib/ingestion/parse";
import type { NewsProvider, RawNewsDoc } from "@/lib/news/providers/types";

const parser = new Parser({ timeout: 8_000 });

/**
 * Google News titles arrive as "헤드라인 - 매체명", but bilingual outlets append
 * both names ("... - 조선비즈 - Chosunbiz"). Strip trailing segments and keep the
 * one closest to the headline, which is the local-language name.
 */
function splitPublisher(raw: string): { title: string; publisher?: string } {
  let title = raw.trim();
  let publisher: string | undefined;

  for (let guard = 0; guard < 3; guard += 1) {
    const match = title.match(/^(.+?)\s+[-–]\s+([^-–]{2,20})$/);
    if (!match?.[1] || !match[2]) break;
    title = match[1].trim();
    publisher = match[2].trim();
  }

  return { title, publisher };
}

function toIso(raw?: string): string | undefined {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function plain(raw?: string): string | undefined {
  if (!raw) return undefined;
  const text = decodeHtml(stripTags(raw)).replace(/\s+/g, " ").trim();
  return text || undefined;
}

/** Keyless and available in every market; the locale comes from MarketConfig. */
export const googleNewsProvider: NewsProvider = {
  id: "google-news",
  isConfigured: () => true,
  async search(keyword, { market }) {
    const { hl, gl, ceid } = market.googleNews;
    const url =
      `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}` +
      `&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;

    // rss-parser handles the XML; fetchText stays in front of it so the request
    // keeps the shared user agent, timeout and encoding handling.
    const xml = await fetchText(url, {
      headers: { Accept: "application/rss+xml,application/xml,text/xml" },
    });
    const feed = await parser.parseString(xml);

    return feed.items.flatMap((item): RawNewsDoc[] => {
      if (!item.title || !item.link) return [];
      const { title, publisher } = splitPublisher(item.title);
      return [
        {
          title,
          publisher: item.creator ?? publisher,
          link: item.link,
          publishedAt: item.isoDate ?? toIso(item.pubDate),
          snippet: plain(item.contentSnippet ?? item.content),
          source: "google-news",
        },
      ];
    });
  },
};
