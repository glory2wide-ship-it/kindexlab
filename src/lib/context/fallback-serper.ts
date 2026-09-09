import { fetchJson } from "@/lib/ingestion/http";
import { activeMarket } from "@/lib/market/config";
import { classifyPublisher } from "@/lib/news/publishers";
import type { ContextSource } from "@/lib/context/types";

interface SerperOrganic {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
}

interface SerperVideo {
  title?: string;
  link?: string;
  snippet?: string;
  channel?: string;
  date?: string;
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

function toSource(
  item: { title?: string; link?: string; snippet?: string; publisher?: string; date?: string },
  tier: "web" | "youtube",
): ContextSource | null {
  const title = item.title?.trim();
  if (!title || !usableUrl(item.link)) return null;
  return {
    title,
    url: item.link,
    publisher: item.publisher?.trim() || (tier === "youtube" ? "YouTube" : "Web"),
    snippet: item.snippet?.trim()?.slice(0, 320),
    publishedAt: item.date,
    tier,
  };
}

/**
 * Tier 2a — web pages via Serper organic search.
 * By default UGC hosts are dropped; pass `allowUgc` for blog/community strategies.
 */
export async function fetchSerperWeb(
  keyword: string,
  limit = 5,
  options?: { allowUgc?: boolean; preferOfficial?: boolean },
): Promise<ContextSource[]> {
  if (!process.env.SERPER_API_KEY) return [];

  const market = activeMarket();
  const allowUgc = Boolean(options?.allowUgc);
  const preferOfficial = Boolean(options?.preferOfficial);
  try {
    const data = await fetchJson<{ organic?: SerperOrganic[] }>("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: keyword,
        gl: market.googleNews.gl.toLowerCase(),
        hl: market.language,
        num: Math.min(limit * 3, 10),
      }),
    });

    const out: ContextSource[] = [];
    const seen = new Set<string>();
    const rows = [...(data.organic ?? [])];
    if (preferOfficial) {
      rows.sort((a, b) => {
        const score = (link?: string) => {
          const host = (link ?? "").toLowerCase();
          if (/\.go\.kr|\.or\.kr|\.korea\.kr|visitkorea|forest\.go\.kr|mof\.go\.kr|mcst\.go\.kr/.test(host)) {
            return 0;
          }
          return 1;
        };
        return score(a.link) - score(b.link);
      });
    }
    for (const row of rows) {
      const kind = classifyPublisher(market, undefined, row.link);
      if (!allowUgc && kind === "ugc") continue;
      const source = toSource(
        { title: row.title, link: row.link, snippet: row.snippet, date: row.date },
        "web",
      );
      if (!source || seen.has(source.url)) continue;
      seen.add(source.url);
      out.push(source);
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Tier 2b — YouTube videos via Serper videos endpoint.
 */
export async function fetchSerperVideos(keyword: string, limit = 3): Promise<ContextSource[]> {
  if (!process.env.SERPER_API_KEY) return [];

  const market = activeMarket();
  try {
    const data = await fetchJson<{ videos?: SerperVideo[] }>("https://google.serper.dev/videos", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: `${keyword} 최신`,
        gl: market.googleNews.gl.toLowerCase(),
        hl: market.language,
        num: Math.min(limit * 2, 8),
      }),
    });

    const out: ContextSource[] = [];
    const seen = new Set<string>();
    for (const row of data.videos ?? []) {
      const link = row.link;
      if (!link?.includes("youtube.com") && !link?.includes("youtu.be")) continue;
      const source = toSource(
        {
          title: row.title,
          link: row.link,
          snippet: row.snippet,
          publisher: row.channel,
          date: row.date,
        },
        "youtube",
      );
      if (!source || seen.has(source.url)) continue;
      seen.add(source.url);
      out.push(source);
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
