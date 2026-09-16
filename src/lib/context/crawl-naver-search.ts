/**
 * 1차: Naver search HTML crawl (blog / webkr).
 * Used before Open API so quota is reserved for thin/failed crawls.
 */

import { fetchText } from "@/lib/ingestion/http";
import { decodeHtml, stripTags } from "@/lib/ingestion/parse";
import type { ContextSource } from "@/lib/context/types";

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

function absUrl(href: string): string | undefined {
  const trimmed = href.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/")) return `https://search.naver.com${trimmed}`;
  return undefined;
}

type Hit = { title: string; url: string; snippet?: string; publisher?: string };

function pushHit(out: Hit[], seen: Set<string>, hit: Hit, limit: number): void {
  if (out.length >= limit) return;
  if (!hit.title || hit.title.length < 2 || !usableUrl(hit.url) || seen.has(hit.url)) return;
  // Skip Naver chrome / search-self links.
  try {
    const host = new URL(hit.url).hostname.toLowerCase();
    if (host === "search.naver.com" || host === "nid.naver.com") return;
  } catch {
    return;
  }
  seen.add(hit.url);
  out.push(hit);
}

/** Parse blog/web result cards from Naver HTML (markup varies; keep regex tolerant). */
function parseNaverSearchHtml(html: string, limit: number, kind: "blog" | "webkr"): Hit[] {
  const out: Hit[] = [];
  const seen = new Set<string>();

  // Anchor + nearby title/snippet blocks.
  const anchorRe =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html)) && out.length < limit * 3) {
    const href = absUrl(match[1] ?? "");
    const title = plain(match[2]);
    if (!href || !title || title.length < 4 || title.length > 120) continue;
    // Prefer result-looking hosts for blog vs web.
    try {
      const host = new URL(href).hostname.toLowerCase();
      if (kind === "blog" && !/(blog\.naver|tistory|post\.naver|blog\.)/.test(host)) {
        // still allow; Naver often wraps redirect URLs
      }
    } catch {
      continue;
    }
    pushHit(out, seen, { title, url: href }, limit);
  }

  // JSON-ish title/link pairs embedded in scripts (common on modern Naver SERP).
  const jsonTitleRe =
    /"title"\s*:\s*"((?:\\.|[^"\\]){4,120})"[\s\S]{0,240}?"(?:link|url|originallink)"\s*:\s*"(https?:\\\/\\\/[^"\\]+|https?:\/\/[^"\\]+)"/gi;
  while ((match = jsonTitleRe.exec(html)) && out.length < limit) {
    const title = plain(match[1]?.replace(/\\u([\dA-Fa-f]{4})/g, (_, h) =>
      String.fromCharCode(Number.parseInt(h, 16)),
    ).replace(/\\"/g, '"'));
    const rawUrl = (match[2] ?? "").replace(/\\\//g, "/");
    const url = absUrl(rawUrl);
    if (title && url) pushHit(out, seen, { title, url }, limit);
  }

  return out.slice(0, limit);
}

async function crawlNaverWhere(
  where: "blog" | "webkr",
  keyword: string,
  limit: number,
  publisher: string,
): Promise<ContextSource[]> {
  const url =
    `https://search.naver.com/search.naver?where=${where}` +
    `&sm=tab_jum&query=${encodeURIComponent(keyword)}`;
  try {
    const html = await fetchText(url, {
      headers: {
        Accept: "text/html",
        Referer: "https://search.naver.com/",
      },
    });
    if (!html || html.length < 800) return [];
    // Bot / captcha / empty shell pages.
    if (/캡차|자동입력|blocked|access denied/i.test(html) && html.length < 20_000) {
      return [];
    }
    return parseNaverSearchHtml(html, limit, where).map((hit) => ({
      title: hit.title,
      url: hit.url,
      publisher: hit.publisher || publisher,
      snippet: hit.snippet?.slice(0, 320),
      tier: "web" as const,
    }));
  } catch {
    return [];
  }
}

/**
 * HTML crawl of Naver blog + web document search.
 * Returns [] on bot walls / empty markup so callers can fall back to Open API.
 */
export async function crawlNaverWebSearch(
  keyword: string,
  limit = 5,
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
      : crawlNaverWhere("blog", keyword, blogLimit, "네이버 블로그"),
    crawlNaverWhere("webkr", keyword, preferOfficial ? limit : webLimit, "네이버 웹문서"),
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
    seen.add(source.url);
    merged.push(source);
    if (merged.length >= limit) break;
  }
  return merged;
}
