import { crawlNaverWebSearch } from "@/lib/context/crawl-naver-search";
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

async function searchNaverOpenApi(
  keyword: string,
  limit: number,
  options?: { preferBlog?: boolean; preferOfficial?: boolean },
): Promise<ContextSource[]> {
  const preferBlog = Boolean(options?.preferBlog);
  const preferOfficial = Boolean(options?.preferOfficial);
  const blogLimit = preferBlog
    ? Math.max(limit - 1, Math.ceil(limit * 0.75))
    : preferOfficial
      ? 1
      : Math.ceil(limit / 2);
  const webLimit = Math.max(1, limit - blogLimit);
  const [blogs, web] = await Promise.all([
    preferOfficial && !preferBlog
      ? Promise.resolve([] as ContextSource[])
      : searchNaver("blog", keyword, blogLimit, "네이버 블로그"),
    searchNaver("webkr", keyword, preferOfficial ? limit : webLimit, "네이버 웹문서"),
  ]);
  const ordered = preferBlog
    ? [...blogs, ...web]
    : preferOfficial
      ? [...web, ...blogs]
      : [...blogs, ...web];
  const merged: ContextSource[] = [];
  const seen = new Set<string>();
  for (const source of ordered) {
    if (seen.has(source.url)) continue;
    if (preferOfficial) {
      const host = (() => {
        try {
          return new URL(source.url).hostname.toLowerCase();
        } catch {
          return "";
        }
      })();
      // Keep official-looking hosts first; still allow other webkr hits to fill.
      if (
        merged.length < Math.ceil(limit / 2) &&
        host &&
        !/\.go\.kr|\.or\.kr|\.korea\.kr|visitkorea|seoul\.go\.kr/.test(host) &&
        /blog\.naver|tistory|post\.naver/.test(host)
      ) {
        continue;
      }
    }
    seen.add(source.url);
    merged.push(source);
    if (merged.length >= limit) break;
  }
  return merged;
}

function mergeUnique(primary: ContextSource[], secondary: ContextSource[], limit: number): ContextSource[] {
  const merged: ContextSource[] = [];
  const seen = new Set<string>();
  for (const source of [...primary, ...secondary]) {
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    merged.push(source);
    if (merged.length >= limit) break;
  }
  return merged;
}

/**
 * Tiered Naver web/blog collection:
 * 1차 HTML crawl of search.naver.com (blog + webkr)
 * 2차 Open API only when crawl is empty or thinner than half the requested limit
 *
 * Blog posts are intentional UGC sources for Korean lifestyle/policy keywords.
 */
export async function fetchNaverWebFallback(
  keyword: string,
  limit = 5,
  options?: { preferBlog?: boolean; preferOfficial?: boolean },
): Promise<ContextSource[]> {
  const crawled = await crawlNaverWebSearch(keyword, limit, options);
  if (crawled.length >= Math.max(2, Math.ceil(limit / 2))) {
    return crawled.slice(0, limit);
  }

  const api = await searchNaverOpenApi(keyword, limit, options);
  if (!crawled.length) return api;
  return mergeUnique(crawled, api, limit);
}
