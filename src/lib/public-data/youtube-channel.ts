import { fetchJson } from "@/lib/ingestion/http";
import { recordYoutubeApiUnits } from "@/lib/ops/detail-collect-api-cost";
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

/**
 * Verified UC channel IDs only. Do not add @handles here — squatters reuse popular
 * handles (e.g. @chimchakman → 3-subscriber channel) and destroy trust.
 */
const ENTERTAINMENT_YOUTUBE_SEEDS: Array<{
  name: string;
  aliases?: string[];
  channelId: string;
}> = [
  // IDs must be UC… and verified via channels.list (not forHandle alone).
];

function matchEntertainmentYoutubeSeed(
  text: string,
): (typeof ENTERTAINMENT_YOUTUBE_SEEDS)[number] | undefined {
  const needle = text.replace(/\s+/g, "").toLowerCase();
  return ENTERTAINMENT_YOUTUBE_SEEDS.find((seed) => {
    const names = [seed.name, ...(seed.aliases ?? [])].map((n) =>
      n.replace(/\s+/g, "").toLowerCase(),
    );
    return names.some((n) => needle.includes(n) || n.includes(needle));
  });
}

function formatSubscribers(count: number): string {
  if (count >= 100_000_000) return `${(count / 100_000_000).toFixed(1).replace(/\.0$/, "")}억명`;
  if (count >= 10_000) return `${Math.round(count / 10_000).toLocaleString("ko-KR")}만명`;
  return `${count.toLocaleString("ko-KR")}명`;
}

function titleSimilarity(a: string, b: string): number {
  const left = a.replace(/\s+/g, "").toLowerCase();
  const right = b.replace(/\s+/g, "").toLowerCase();
  if (!left || !right) return 0;
  if (left === right) return 10;
  if (left.includes(right) || right.includes(left)) return 7;
  const tokens = right.match(/[가-힣a-z0-9]{2,}/g) ?? [];
  let score = 0;
  for (const token of tokens) {
    if (left.includes(token)) score += Math.min(token.length, 4);
  }
  return score;
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
  recordYoutubeApiUnits(1, 1);
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
    recordYoutubeApiUnits(100, 1);
    return (search.items ?? [])
      .map((item) => item.snippet?.title?.trim())
      .filter((title): title is string => Boolean(title))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Prefer stable /channel/UC… URLs. Only emit @handles when the handle itself
 * resembles the entity name AND the channel has meaningful subscribers
 * (blocks handle-squatter channels with 0–3 subs).
 */
function channelPublicUrl(
  channelId: string,
  customUrl: string | undefined,
  queryName: string,
  subscriberCount?: number,
): string {
  const handle = customUrl?.replace(/^@/, "").trim();
  if (handle && (subscriberCount ?? 0) >= 10_000) {
    const handleScore = titleSimilarity(handle, queryName);
    if (handleScore >= 4) return `https://www.youtube.com/@${handle}`;
  }
  return `https://www.youtube.com/channel/${channelId}`;
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
    const politics = matchPoliticsYoutubeSeed(q);
    const entertainment = matchEntertainmentYoutubeSeed(q);
    let channelId =
      (politics?.channelId && /^UC[\w-]{20,}$/.test(politics.channelId)
        ? politics.channelId
        : undefined) || entertainment?.channelId;

    if (!channelId) {
      const search = await fetchJson<{
        items?: { id?: { channelId?: string }; snippet?: { channelId?: string; title?: string } }[];
        error?: { message?: string };
      }>(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel` +
          `&q=${encodeURIComponent(q)}` +
          `&maxResults=8&regionCode=KR&relevanceLanguage=ko&key=${encodeURIComponent(key)}`,
      );
      recordYoutubeApiUnits(100, 1);
      if (search.error) return undefined;
      const ranked = [...(search.items ?? [])]
        .map((item) => {
          const id = item.id?.channelId || item.snippet?.channelId;
          const title = item.snippet?.title ?? "";
          return { id, title, score: titleSimilarity(title, q) };
        })
        .filter((row): row is { id: string; title: string; score: number } => Boolean(row.id))
        .sort((a, b) => b.score - a.score);
      // Reject weak matches — wrong channels destroy trust more than missing URLs.
      if (!ranked[0] || ranked[0].score < 4) return undefined;
      channelId = ranked[0].id;
    }
    if (!channelId) return undefined;

    const [channels, videos] = await Promise.all([
      channelsByIds(key, [channelId]),
      recentVideoTitles(key, channelId, 5),
    ]);
    const channel = channels[0];
    if (!channel) return undefined;
    if (!politics && !entertainment && titleSimilarity(channel.title, q) < 4) {
      return undefined;
    }
    // Reject ghost / squatter channels even if title somehow matched.
    if ((channel.subscriberCount ?? 0) < 1000 && !politics) return undefined;

    return {
      channelId: channel.id,
      title: channel.title,
      url: channelPublicUrl(channel.id, channel.customUrl, q, channel.subscriberCount),
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
