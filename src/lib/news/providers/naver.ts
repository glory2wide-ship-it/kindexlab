import { fetchJson } from "@/lib/ingestion/http";
import { decodeHtml, stripTags } from "@/lib/ingestion/parse";
import type { NewsProvider, RawNewsDoc } from "@/lib/news/providers/types";

function plain(raw?: string): string | undefined {
  if (!raw) return undefined;
  const text = decodeHtml(stripTags(raw)).replace(/\s+/g, " ").trim();
  return text || undefined;
}

function toIso(raw?: string): string | undefined {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/** Korea-only search API. Requires NAVER_CLIENT_ID and NAVER_CLIENT_SECRET. */
export const naverNewsProvider: NewsProvider = {
  id: "naver-news",
  isConfigured: (market) =>
    market.country === "KR" &&
    Boolean(process.env.NAVER_CLIENT_ID) &&
    Boolean(process.env.NAVER_CLIENT_SECRET),
  async search(keyword, { limit }) {
    const url =
      `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}` +
      `&display=${Math.min(Math.max(limit * 3, 10), 100)}&sort=date`;

    const data = await fetchJson<{
      items?: { title?: string; description?: string; link?: string; pubDate?: string }[];
    }>(url, {
      headers: {
        "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID ?? "",
        "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET ?? "",
        Accept: "application/json",
      },
    });

    return (data.items ?? []).flatMap((item): RawNewsDoc[] => {
      const title = plain(item.title);
      if (!title) return [];
      return [
        {
          title,
          link: item.link,
          publishedAt: toIso(item.pubDate),
          snippet: plain(item.description),
          source: "naver-news",
        },
      ];
    });
  },
};
