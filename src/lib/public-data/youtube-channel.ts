import { fetchJson } from "@/lib/ingestion/http";
import { matchPoliticsYoutubeSeed } from "@/lib/politics/youtube-seeds";

function youtubeApiKey(): string {
  return (process.env.YOUTUBE_API_KEY ?? process.env.GOOGLE_YOUTUBE_API_KEY ?? "").trim();
}

export type YoutubeChannelProfile = {
  channelId: string;
  title: string;
  url: string;
  subscriberCount?: number;
  subscriberLabel?: string;
  recentVideoTitles: string[];
};

function formatSubscribers(count: number): string {
  if (count >= 100_000_000) return `${(count / 100_000_000).toFixed(1).replace(/\.0$/, "")}억명`;
  if (count >= 10_000) return `${Math.round(count / 10_000).toLocaleString("ko-KR")}만명`;
  return `${count.toLocaleString("ko-KR")}명`;
}

async function channelsByIds(
  key: string,
  ids: string[],
): Promise<
  Array<{
    id: string;
    title: string;
    customUrl?: string;
    subscriberCount?: number;
  }>
> {
  if (!ids.length) return [];
  const details = await fetchJson<{
    items?: {
      id?: string;
      snippet?: { title?: string; customUrl?: string };
      statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
    }[];
  }>(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics` +
      `&id=${ids.map(encodeURIComponent).join(",")}` +
      `&key=${encodeURIComponent(key)}`,
  );
  return (details.items ?? [])
    .map((item) => {
      const id = item.id?.trim();
      const title = item.snippet?.title?.trim();
      if (!id || !title) return undefined;
      const hidden = item.statistics?.hiddenSubscriberCount;
      const raw = Number.parseInt(item.statistics?.subscriberCount ?? "", 10);
      return {
        id,
        title,
        customUrl: item.snippet?.customUrl?.trim(),
        subscriberCount: !hidden && Number.isFinite(raw) ? raw : undefined,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

async function recentVideoTitles(
  key: string,
  channelId: string,
  limit: number,
): Promise<string[]> {
  try {
    const search = await fetchJson<{
      items?: { snippet?: { title?: string } }[];
    }>(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
        `&channelId=${encodeURIComponent(channelId)}` +
        `&order=viewCount&maxResults=${Math.min(limit, 5)}` +
        `&regionCode=KR&relevanceLanguage=ko&key=${encodeURIComponent(key)}`,
    );
    return (search.items ?? [])
      .map((item) => item.snippet?.title?.trim())
      .filter((title): title is string => Boolean(title))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Resolve a YouTube channel (seed ID or name search) + subscriber stats + top videos.
 * Soft-fails to undefined when YOUTUBE_API_KEY is missing.
 */
export async function lookupYoutubeChannelProfile(
  name: string,
): Promise<YoutubeChannelProfile | undefined> {
  const key = youtubeApiKey();
  if (!key) return undefined;
  const q = name.trim();
  if (!q) return undefined;

  try {
    const seed = matchPoliticsYoutubeSeed(q);
    let channelId = seed?.channelId;
    if (!channelId) {
      const search = await fetchJson<{
        items?: { id?: { channelId?: string }; snippet?: { channelId?: string; title?: string } }[];
      }>(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel` +
          `&q=${encodeURIComponent(q)}` +
          `&maxResults=5&regionCode=KR&relevanceLanguage=ko&key=${encodeURIComponent(key)}`,
      );
      const needle = q.replace(/\s+/g, "");
      const ranked = [...(search.items ?? [])].sort((a, b) => {
        const aTitle = (a.snippet?.title ?? "").replace(/\s+/g, "");
        const bTitle = (b.snippet?.title ?? "").replace(/\s+/g, "");
        const aHit = aTitle.includes(needle) || needle.includes(aTitle) ? 1 : 0;
        const bHit = bTitle.includes(needle) || needle.includes(bTitle) ? 1 : 0;
        return bHit - aHit;
      });
      channelId =
        ranked[0]?.id?.channelId ||
        ranked[0]?.snippet?.channelId ||
        undefined;
    }
    if (!channelId) return undefined;

    const [channels, videos] = await Promise.all([
      channelsByIds(key, [channelId]),
      recentVideoTitles(key, channelId, 5),
    ]);
    const channel = channels[0];
    if (!channel) return undefined;
    const handle = channel.customUrl?.replace(/^@/, "");
    const url = handle
      ? `https://www.youtube.com/@${handle}`
      : `https://www.youtube.com/channel/${channel.id}`;
    return {
      channelId: channel.id,
      title: channel.title,
      url,
      subscriberCount: channel.subscriberCount,
      subscriberLabel:
        channel.subscriberCount != null
          ? formatSubscribers(channel.subscriberCount)
          : undefined,
      recentVideoTitles: videos,
    };
  } catch {
    return undefined;
  }
}
