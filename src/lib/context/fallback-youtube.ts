import { fetchJson } from "@/lib/ingestion/http";
import { fetchSerperVideos } from "@/lib/context/fallback-serper";
import type { ContextSource } from "@/lib/context/types";

function youtubeApiKey(): string {
  return (process.env.YOUTUBE_API_KEY ?? process.env.GOOGLE_YOUTUBE_API_KEY ?? "").trim();
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
 * Tier 3 — YouTube title + description + URL for RAG when news and web are thin.
 * Serper videos run first; YouTube Data API fills gaps when a key is configured.
 */
export async function fetchYoutubeFallback(keyword: string, limit = 3): Promise<ContextSource[]> {
  const serper = await fetchSerperVideos(keyword, limit);
  if (serper.length >= limit) return serper;

  const key = youtubeApiKey();
  if (!key) return serper;

  try {
    const search = await fetchJson<{
      items?: { id?: { videoId?: string } }[];
    }>(
      `https://www.googleapis.com/youtube/v3/search?part=id&type=video` +
        `&q=${encodeURIComponent(`${keyword} 최신`)}` +
        `&maxResults=${Math.min(limit * 2, 8)}` +
        `&regionCode=KR&relevanceLanguage=ko&key=${encodeURIComponent(key)}`,
    );

    const ids = (search.items ?? [])
      .map((item) => item.id?.videoId)
      .filter((id): id is string => Boolean(id));
    if (!ids.length) return serper;

    const details = await fetchJson<{
      items?: {
        id?: string;
        snippet?: { title?: string; description?: string; channelTitle?: string; publishedAt?: string };
      }[];
    }>(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.map(encodeURIComponent).join(",")}` +
        `&key=${encodeURIComponent(key)}`,
    );

    const out = [...serper];
    const seen = new Set(out.map((item) => item.url));
    for (const item of details.items ?? []) {
      const id = item.id;
      const snippet = item.snippet;
      if (!id || !snippet) continue;
      const title = snippet.title?.trim();
      if (!title) continue;
      const url = `https://www.youtube.com/watch?v=${id}`;
      if (seen.has(url)) continue;
      seen.add(url);
      const description = snippet.description?.replace(/\s+/g, " ").trim().slice(0, 420);
      out.push({
        title,
        url,
        publisher: snippet.channelTitle?.trim() || "YouTube",
        publishedAt: snippet.publishedAt?.slice(0, 10),
        snippet: description,
        tier: "youtube",
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return serper;
  }
}
