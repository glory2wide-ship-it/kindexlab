import { fetchText, nowIso } from "@/lib/ingestion/http";
import type { ChartRow, SourceResult } from "@/lib/ingestion/types";

function result(id: string, label: string, items: ChartRow[], error?: string): SourceResult {
  return {
    id,
    label,
    ok: !error && items.length > 0,
    count: items.length,
    error: error ?? (items.length ? undefined : "empty"),
    fetchedAt: nowIso(),
    items,
  };
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function cleanBookTitle(value: string): string {
  return decodeHtml(value)
    .replace(/\s+/g, " ")
    .replace(/\s*[:：]\s*$/, "")
    .trim();
}

/** Yes24 국내도서 베스트셀러 HTML — Open API 없이 공개 페이지 파싱. */
function parseYes24Bestsellers(html: string): ChartRow[] {
  const items: ChartRow[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/class=["']gd_name["'][^>]*>([^<]+)</gi)) {
    const title = cleanBookTitle(match[1] ?? "");
    if (title.length < 2) continue;
    const key = title.replace(/\s+/g, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const rank = items.length + 1;
    items.push({
      rank,
      title,
      metric: Math.max(1, 48 - rank),
      tags: ["예스24", "베스트셀러"],
    });
    if (items.length >= 40) break;
  }
  return items;
}

async function fetchYes24Bestsellers(): Promise<SourceResult> {
  const urls = [
    "https://www.yes24.com/Product/Category/BestSeller?categoryNumber=001&pageNumber=1&pageSize=40",
    "https://www.yes24.com/Product/Category/BestSeller?categoryNumber=001",
  ];
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const html = await fetchText(url, {
        headers: {
          Accept: "text/html",
          Referer: "https://www.yes24.com/",
        },
      });
      const items = parseYes24Bestsellers(html);
      if (items.length) return result("yes24-bestseller", "예스24 베스트셀러", items);
      errors.push(`${url}: empty`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return result("yes24-bestseller", "예스24 베스트셀러", [], errors.at(-1) ?? "unavailable");
}

export async function fetchBookSources(): Promise<SourceResult[]> {
  return [await fetchYes24Bestsellers()];
}

export function pickBestsellerRows(sources: SourceResult[]): ChartRow[] {
  const primary = sources.find((source) => source.id === "yes24-bestseller");
  return (primary?.items ?? []).slice(0, 30);
}
