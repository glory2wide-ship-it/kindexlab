import { fetchJson } from "@/lib/ingestion/http";
import type { NewsProvider, RawNewsDoc } from "@/lib/news/providers/types";

interface SerperNewsItem {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
  source?: string;
}

/**
 * Serper reports relative ages ("2 hours ago", "3 days ago") rather than
 * timestamps, so we resolve them against now. Unparseable values return
 * undefined and the doc is kept: the staleness filter only drops docs it can
 * actually date.
 */
function relativeToIso(raw?: string): string | undefined {
  if (!raw) return undefined;

  const absolute = new Date(raw);
  if (!Number.isNaN(absolute.getTime())) return absolute.toISOString();

  const match = raw.match(/(\d+)\s*(minute|hour|day|week|month)/i);
  if (!match?.[1] || !match[2]) return undefined;

  const amount = Number.parseInt(match[1], 10);
  const unitMs: Record<string, number> = {
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
  };
  const step = unitMs[match[2].toLowerCase()];
  if (!step) return undefined;

  return new Date(Date.now() - amount * step).toISOString();
}

/** Global news search. Requires SERPER_API_KEY. */
export const serperProvider: NewsProvider = {
  id: "serper",
  isConfigured: () => Boolean(process.env.SERPER_API_KEY),
  async search(keyword, { market, limit }) {
    const data = await fetchJson<{ news?: SerperNewsItem[] }>(
      "https://google.serper.dev/news",
      {
        method: "POST",
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: keyword,
          gl: market.googleNews.gl.toLowerCase(),
          hl: market.language,
          num: Math.min(Math.max(limit * 3, 10), 100),
        }),
      },
    );

    return (data.news ?? []).flatMap((item): RawNewsDoc[] => {
      const title = item.title?.trim();
      if (!title) return [];
      return [
        {
          title,
          publisher: item.source?.trim() || undefined,
          link: item.link,
          publishedAt: relativeToIso(item.date),
          snippet: item.snippet?.trim() || undefined,
          source: "serper",
        },
      ];
    });
  },
};
