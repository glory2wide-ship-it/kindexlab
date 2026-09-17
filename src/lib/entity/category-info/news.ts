import type { CategoryInfoLink } from "@/lib/entity/category-info/types";

export function naverNewsUrl(query: string): string {
  return `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
}

export function naverWebUrl(query: string): string {
  return `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`;
}

export function naverBlogUrl(query: string): string {
  return `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(query)}`;
}

/** True for aggregator / in-site search URLs — not press article permalinks. */
export function isNewsSearchFallbackUrl(href: string): boolean {
  try {
    const host = new URL(href).hostname.toLowerCase();
    const path = new URL(href).pathname.toLowerCase();
    if (host.includes("search.naver.com")) return true;
    if (host.includes("news.google.com") && path.includes("/search")) return true;
    if (host.includes("google.com") && path.includes("/search")) return true;
    if (host.includes("search.daum.net")) return true;
    return false;
  } catch {
    return true;
  }
}

/**
 * Score a candidate news link for title · entity · domain trust.
 * Used across all channels (same spirit as 보조금24 host/title checks).
 */
export function scoreNewsLinkQuality(
  link: CategoryInfoLink,
  entityName: string,
): number {
  if (!link.href || isNewsSearchFallbackUrl(link.href)) return 0;
  let host = "";
  try {
    host = new URL(link.href).hostname.toLowerCase();
  } catch {
    return 0;
  }
  const title = `${link.title} ${link.source ?? ""}`;
  const compactTitle = title.replace(/\s+/g, "");
  const needle = entityName.replace(/\s+/g, "").replace(/^\[[^\]]+\]/, "");
  const tokens = needle.match(/[가-힣A-Za-z0-9]{2,}/g) ?? [];
  let score = 1;

  // Entity overlap in title
  if (needle.length >= 2 && compactTitle.includes(needle)) score += 4;
  else if (tokens.some((t) => compactTitle.includes(t))) score += 2;

  // Known press / official domains
  if (
    /\.(co\.kr|com|net|org)$/i.test(host) &&
    !/blog\.|tistory\.|cafe\.|instagram\.|facebook\./i.test(host)
  ) {
    score += 1;
  }
  if (/\.go\.kr$|\.gov\.kr$/i.test(host)) score += 2;
  if (/yna\.co\.kr|chosun\.|joongang\.|donga\.|hani\.|khan\.|mt\.co\.kr|hankyung\.|mk\.co\.kr|sedaily\.|seoul\.co\.kr|ytn\.|sbs\.|kbs\.|mbc\./i.test(host)) {
    score += 2;
  }

  // Claimed source vs host disagreement (보조금24-style)
  const claimsGov = /보조금\s*24|정부24|gov\.kr/i.test(title);
  const claimsWelfare = /복지로|bokjiro/i.test(title);
  if (claimsGov && !/(^|\.)gov\.kr$/i.test(host) && !host.endsWith(".go.kr")) return 0;
  if (claimsWelfare && !/bokjiro\.go\.kr$/i.test(host) && !host.endsWith(".go.kr")) return 0;

  // Thin / generic titles
  if (link.title.length < 8) score -= 1;
  if (/관련 뉴스|검색 결과|네이버 뉴스/.test(link.title)) score -= 2;

  return Math.max(0, score);
}

/**
 * Related-news placeholders. Prefer empty here — enrich fills real article URLs.
 * At most one Naver search fallback is attached later via ensureQualityNewsLinks.
 */
export function buildRelatedNewsLinks(
  name: string,
  extras: string[] = ["속보", "이슈", "해설"],
  options?: { includeWeb?: boolean; includeBlog?: boolean },
): CategoryInfoLink[] {
  void name;
  void extras;
  void options;
  return [];
}

/**
 * Keep real article links; allow at most one search fallback.
 * Prefer 1–2 quality press URLs over padding to 3 with search pages.
 * When under-filled, label the fallback as “추가 수집 중”.
 */
export function ensureQualityNewsLinks(
  name: string,
  links: CategoryInfoLink[],
  options?: { maxSearchFallbacks?: number; minPreferred?: number },
): CategoryInfoLink[] {
  const maxSearch = options?.maxSearchFallbacks ?? 1;
  const minPreferred = options?.minPreferred ?? 1;
  const scored = links
    .filter((link) => link.href)
    .map((link) => ({ link, score: scoreNewsLinkQuality(link, name) }))
    .sort((a, b) => b.score - a.score);

  const real: CategoryInfoLink[] = [];
  const search: CategoryInfoLink[] = [];
  const seen = new Set<string>();
  for (const { link, score } of scored) {
    if (seen.has(link.href)) continue;
    seen.add(link.href);
    if (isNewsSearchFallbackUrl(link.href) || score === 0) {
      if (isNewsSearchFallbackUrl(link.href)) search.push(link);
      continue;
    }
    if (score >= 2) real.push(link);
  }
  // Also keep lower-score real permalinks if we are thin
  if (real.length < 2) {
    for (const { link, score } of scored) {
      if (seen.has(`kept:${link.href}`)) continue;
      if (isNewsSearchFallbackUrl(link.href) || score === 0) continue;
      if (real.some((r) => r.href === link.href)) continue;
      real.push(link);
      if (real.length >= 2) break;
    }
  }

  const out = [...real.slice(0, 5)];
  const needFallback = out.length < minPreferred && maxSearch > 0;
  if (needFallback || (out.length === 0 && maxSearch > 0)) {
    const fallback =
      search[0] ??
      ({
        title:
          out.length > 0
            ? `${name} 추가 수집 중 · 뉴스 검색`
            : `${name} 관련 뉴스 추가 수집 중`,
        href: naverNewsUrl(name),
        source: "네이버 뉴스 검색",
      } satisfies CategoryInfoLink);
    if (!out.some((l) => l.href === fallback.href)) {
      out.push({
        ...fallback,
        title: fallback.title.includes("추가 수집")
          ? fallback.title
          : `${name} 추가 수집 중 · 뉴스 검색`,
      });
    }
  }
  // Prefer quality 2 over forced 3 — cap soft at 5, do not pad.
  return out.slice(0, Math.max(out.length, 0));
}

/** @deprecated Prefer ensureQualityNewsLinks — kept for call-site compatibility. */
export function ensureMinNewsLinks(
  name: string,
  links: CategoryInfoLink[],
  min = 2,
): CategoryInfoLink[] {
  return ensureQualityNewsLinks(name, links, {
    maxSearchFallbacks: 1,
    minPreferred: Math.min(min, 2),
  });
}
