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

function cleanTitle(raw?: string): string | undefined {
  const text = plain(raw);
  if (!text) return undefined;
  return text
    .replace(/\s*새\s*창\s*열림\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pushHit(out: Hit[], seen: Set<string>, hit: Hit, limit: number): void {
  if (out.length >= limit) return;
  const title = cleanTitle(hit.title);
  if (!title || title.length < 10 || title.length > 120) return;
  if (!usableUrl(hit.url) || seen.has(hit.url)) return;
  const junkTitle =
    /^(다운로드|로그인|회원가입|더보기|이전|다음|NAVER|네이버|검색|메뉴|홈|쇼핑|어학사전|뉴스|이미지|동영상|지식iN|지도|책|학술정보|Entertain)$/i.test(
      title,
    ) || /^(광고|Sponsored)/i.test(title);
  if (junkTitle) return;
  try {
    const host = new URL(hit.url).hostname.toLowerCase();
    if (
      host === "search.naver.com" ||
      host === "nid.naver.com" ||
      host === "www.naver.com" ||
      host === "naver.com" ||
      host === "dict.naver.com" ||
      host === "search.shopping.naver.com" ||
      host.endsWith(".naver.net") ||
      host.startsWith("help.") ||
      host.startsWith("advertising.")
    ) {
      return;
    }
    // Bare blog hub without post id is usually chrome.
    if (/^blog\.naver\.com$/i.test(host) && !/blog\.naver\.com\/[^/]+\/\d+/.test(hit.url)) {
      return;
    }
  } catch {
    return;
  }
  seen.add(hit.url);
  out.push({ ...hit, title });
}

/** Parse blog/web result cards from Naver HTML (markup varies; keep regex tolerant). */
function parseNaverSearchHtml(html: string, limit: number, kind: "blog" | "webkr"): Hit[] {
  const out: Hit[] = [];
  const seen = new Set<string>();

  // Prefer structured title/link pairs in embedded JSON first (cleaner than raw anchors).
  const jsonTitleRe =
    /"title"\s*:\s*"((?:\\.|[^"\\]){8,120})"[\s\S]{0,280}?"(?:link|url|originallink|pcUrl|mobileUrl)"\s*:\s*"(https?:\\\/\\\/[^"\\]+|https?:\/\/[^"\\]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonTitleRe.exec(html)) && out.length < limit) {
    const title = cleanTitle(
      match[1]
        ?.replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => String.fromCharCode(Number.parseInt(h, 16)))
        .replace(/\\"/g, '"'),
    );
    const rawUrl = (match[2] ?? "").replace(/\\\//g, "/");
    const url = absUrl(rawUrl);
    if (title && url) pushHit(out, seen, { title, url }, limit);
  }

  // Fallback: result-looking anchors with blog/web hosts.
  const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = anchorRe.exec(html)) && out.length < limit) {
    const href = absUrl(match[1] ?? "");
    const title = cleanTitle(match[2]);
    if (!href || !title) continue;
    try {
      const host = new URL(href).hostname.toLowerCase();
      if (kind === "blog") {
        if (!/(blog\.naver|tistory|post\.naver|blogspot|brunch\.co\.kr)/.test(host)) continue;
        if (/blog\.naver\.com/i.test(host) && !/blog\.naver\.com\/[^/]+\/\d+/.test(href)) continue;
      } else if (
        /(nid\.naver|search\.naver|www\.naver\.com|help\.naver|advertising|dict\.naver|shopping\.naver)/.test(
          host,
        )
      ) {
        continue;
      }
    } catch {
      continue;
    }
    pushHit(out, seen, { title, url: href }, limit);
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
