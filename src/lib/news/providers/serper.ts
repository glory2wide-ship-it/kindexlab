import { fetchJson } from "@/lib/ingestion/http";
import { isSerperEnabled } from "@/lib/news/serper-enabled";
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

  // English relative ages
  const en = raw.match(/(\d+)\s*(minute|hour|day|week|month)/i);
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

  // Korean relative ages: "3일 전", "2시간 전", "방금"
  if (/방금|조금\s*전/.test(raw)) return new Date().toISOString();
  const ko = raw.match(/(\d+)\s*(초|분|시간|일|주|개월|달)\s*전/);
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

  // Compact Korean dates in snippets: 2024.3.15 / 2024-03-15 / 2024년 3월 15일
  const compact = raw.match(
    /(\d{4})\s*[.년/-]\s*(\d{1,2})\s*[.월/-]\s*(\d{1,2})/,
  );
  if (compact) {
    const y = Number(compact[1]);
    const m = Number(compact[2]);
    const d = Number(compact[3]);
    const date = new Date(Date.UTC(y, m - 1, d, 3, 0, 0)); // ~KST noon-ish
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return undefined;
}

/** Global news search. Opt-in via SERPER_ENABLED=1 + SERPER_API_KEY. */
export const serperProvider: NewsProvider = {
  id: "serper",
  isConfigured: () => isSerperEnabled(),
  async search(keyword, { market, limit }) {
    if (!isSerperEnabled()) return [];
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
