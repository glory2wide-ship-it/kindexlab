import { fetchJson } from "@/lib/ingestion/http";
import type { ContextSource } from "@/lib/context/types";

interface GoogleCseItem {
  title?: string;
  link?: string;
  snippet?: string;
  displayLink?: string;
}

function configured(): boolean {
  return Boolean(process.env.GOOGLE_CSE_API_KEY?.trim() && process.env.GOOGLE_CSE_CX?.trim());
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

/**
 * Tier 2b — Google Custom Search fallback for non-news web documents.
 * Optional: only runs when both GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX exist.
 */
export async function fetchGoogleCustomSearch(keyword: string, limit = 5): Promise<ContextSource[]> {
  if (!configured()) return [];

  try {
    const url =
      `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(process.env.GOOGLE_CSE_API_KEY ?? "")}` +
      `&cx=${encodeURIComponent(process.env.GOOGLE_CSE_CX ?? "")}` +
      `&q=${encodeURIComponent(keyword)}` +
      `&num=${Math.min(Math.max(limit * 2, 5), 10)}` +
      "&gl=kr&hl=ko&safe=off";
    const data = await fetchJson<{ items?: GoogleCseItem[] }>(url);
    const out: ContextSource[] = [];
    const seen = new Set<string>();
    for (const item of data.items ?? []) {
      const title = item.title?.replace(/\s+/g, " ").trim();
      if (!title || !usableUrl(item.link) || seen.has(item.link)) continue;
      seen.add(item.link);
      out.push({
        title,
        url: item.link,
        publisher: item.displayLink?.trim() || "Google CSE",
        snippet: item.snippet?.replace(/\s+/g, " ").trim().slice(0, 320),
        tier: "web",
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
