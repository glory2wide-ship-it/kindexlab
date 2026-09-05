import { fetchJson } from "@/lib/ingestion/http";
import { decodeHtml, stripTags } from "@/lib/ingestion/parse";
import type { ContextSource } from "@/lib/context/types";

function configured(): boolean {
  return Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
}

function headers(): Record<string, string> {
  return {
    "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID ?? "",
    "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET ?? "",
    Accept: "application/json",
  };
}

function plain(raw?: string): string | undefined {
  if (!raw) return undefined;
  const text = decodeHtml(stripTags(raw)).replace(/\s+/g, " ").trim();
  return text || undefined;
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

async function searchNaver(
  endpoint: "blog" | "webkr",
  keyword: string,
  limit: number,
  publisher: string,
): Promise<ContextSource[]> {
  if (!configured()) return [];

  const url =
    `https://openapi.naver.com/v1/search/${endpoint}.json` +
    `?query=${encodeURIComponent(keyword)}` +
    `&display=${Math.min(Math.max(limit * 2, 5), 20)}&sort=sim`;

  try {
    const data = await fetchJson<{
      items?: { title?: string; description?: string; link?: string; bloggername?: string }[];
    }>(url, { headers: headers() });

    const out: ContextSource[] = [];
    const seen = new Set<string>();
    for (const item of data.items ?? []) {
      const title = plain(item.title);
      if (!title || !usableUrl(item.link) || seen.has(item.link)) continue;
      seen.add(item.link);
      out.push({
        title,
        url: item.link,
        publisher: item.bloggername?.trim() || publisher,
        snippet: plain(item.description)?.slice(0, 320),
        tier: "web",
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Tier 2 — Naver blog + web document search when news RSS is thin.
 * Blog posts are intentional UGC sources for Korean lifestyle/policy keywords.
 */
export async function fetchNaverWebFallback(keyword: string, limit = 5): Promise<ContextSource[]> {
  const perSource = Math.ceil(limit / 2);
  const [blogs, web] = await Promise.all([
    searchNaver("blog", keyword, perSource, "네이버 블로그"),
    searchNaver("webkr", keyword, perSource, "네이버 웹문서"),
  ]);
  const merged: ContextSource[] = [];
  const seen = new Set<string>();
  for (const source of [...blogs, ...web]) {
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    merged.push(source);
    if (merged.length >= limit) break;
  }
  return merged;
}
