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

/** Default related news/issue links (title + outbound press/search URL). */
export function buildRelatedNewsLinks(
  name: string,
  extras: string[] = ["속보", "이슈", "해설"],
  options?: { includeWeb?: boolean; includeBlog?: boolean },
): CategoryInfoLink[] {
  const links: CategoryInfoLink[] = [
    { title: `${name} 관련 최신 뉴스`, href: naverNewsUrl(name), source: "네이버 뉴스" },
  ];
  for (const extra of extras.slice(0, 4)) {
    links.push({
      title: `${name} · ${extra}`,
      href: naverNewsUrl(`${name} ${extra}`),
      source: "네이버 뉴스",
    });
  }
  if (options?.includeWeb) {
    links.push({
      title: `${name} 관련 웹 검색`,
      href: naverWebUrl(name),
      source: "네이버 검색",
    });
  }
  if (options?.includeBlog) {
    links.push({
      title: `${name} 관련 블로그`,
      href: naverBlogUrl(name),
      source: "네이버 블로그",
    });
  }
  return links.slice(0, 5);
}

export function ensureMinNewsLinks(
  name: string,
  links: CategoryInfoLink[],
  min = 3,
): CategoryInfoLink[] {
  if (links.length >= min) return links.slice(0, Math.max(min, 5));
  const fallback = buildRelatedNewsLinks(name);
  const seen = new Set(links.map((l) => l.href));
  const merged = [...links];
  for (const link of fallback) {
    if (seen.has(link.href)) continue;
    merged.push(link);
    if (merged.length >= min) break;
  }
  return merged.slice(0, Math.max(min, merged.length));
}
