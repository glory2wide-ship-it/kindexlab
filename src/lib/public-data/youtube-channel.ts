import { fetchJson } from "@/lib/ingestion/http";
import { recordYoutubeApiUnits } from "@/lib/ops/detail-collect-api-cost";
import { matchPunditProfileSeed } from "@/lib/politics/pundit-profiles";
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
  handle?: string;
}> = [
  // Verified via youtube.com/@handle → channelId scrape (title/subs checked).
  {
    name: "숏박스",
    aliases: ["SHOTBOX", "shotbox"],
    channelId: "UC1B6SalAoiJD7eHfMUA9QrA",
    handle: "@shortbox",
  },
  {
    name: "딩고 프리스타일",
    aliases: ["딩고뮤직", "dingo music", "딩고"],
    channelId: "UCtCiO5t2voB14CmZKTkIzPQ",
    handle: "@dingomusic",
  },
  {
    name: "문명특급",
    aliases: ["MMTG", "mmug"],
    channelId: "UCSg8FOCttTmMkGT8DPwiqkA",
    handle: "@mmug",
  },
  {
    name: "채널십오야",
    aliases: ["채널 십오야", "십오야", "디글"],
    channelId: "UCWYzc_p0GgfCepIWDHGFmEg",
    handle: "@tvnDENT",
  },
  {
    name: "우왁굳",
    aliases: ["우왁굳의게임방송"],
    channelId: "UCBkyj16n2snkRg1BAzpovXQ",
    handle: "@woowakgood",
  },
  {
    name: "보겸",
    aliases: ["보겸TV", "보겸s"],
    channelId: "UCCJ2b2lJE7M77cSuSHLcMOQ",
    handle: "@bokyemtv",
  },
  {
    name: "워크맨",
    aliases: ["Workman", "워크맨-Workman"],
    channelId: "UCwx6n_4OcLgzAGdty0RWCoA",
    handle: "@workman",
  },
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
    uploadsPlaylistId?: string;
  }>
> {
  if (!ids.length) return [];
  const details = await fetchJson<{
    items?: {
      id?: string;
      snippet?: { title?: string; customUrl?: string };
      statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }[];
  }>(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails` +
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
        uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads?.trim(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

/** Resolve UC… via forHandle (1 unit) — avoids search.list quota (100 units). */
async function channelIdByHandle(
  key: string,
  handle: string,
): Promise<string | undefined> {
  const cleaned = handle.replace(/^@/, "").trim();
  if (!cleaned) return undefined;
  try {
    const details = await fetchJson<{
      items?: { id?: string; snippet?: { title?: string } }[];
      error?: { message?: string };
    }>(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet` +
        `&forHandle=${encodeURIComponent(cleaned)}` +
        `&key=${encodeURIComponent(key)}`,
    );
    recordYoutubeApiUnits(1, 1);
    if (details.error) return undefined;
    return details.items?.[0]?.id?.trim();
  } catch {
    return undefined;
  }
}

/**
 * Recent titles via uploads playlist (playlistItems = 1 unit) instead of search.list (100).
 */
async function recentVideoTitles(
  key: string,
  channelId: string,
  uploadsPlaylistId: string | undefined,
  limit: number,
): Promise<string[]> {
  const playlistId = uploadsPlaylistId || `UU${channelId.slice(2)}`;
  try {
    const list = await fetchJson<{
      items?: { snippet?: { title?: string; resourceId?: { kind?: string } } }[];
    }>(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet` +
        `&playlistId=${encodeURIComponent(playlistId)}` +
        `&maxResults=${Math.min(limit, 5)}` +
        `&key=${encodeURIComponent(key)}`,
    );
    recordYoutubeApiUnits(1, 1);
    return (list.items ?? [])
      .map((item) => item.snippet?.title?.trim())
      .filter(
        (title): title is string =>
          typeof title === "string" && title.length > 0 && !/^Private video$/i.test(title),
      )
      .slice(0, limit);
  } catch {
    return [];
  }
}

/** Always prefer stable /channel/UC… — never emit @handles as primary URL. */
function channelPublicUrl(channelId: string): string {
  return `https://www.youtube.com/channel/${channelId}`;
}

/**
 * Resolve a YouTube channel (seed ID or name search) + subscriber stats + top videos.
 * Soft-fails to undefined when YOUTUBE_API_KEY is missing.
 * Prefer board-level UC seeds (politics / pundit / entertainment) over search quota.
 * Prefer forHandle (1u) over search.list (100u) when seed has a handle.
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
    const pundit = matchPunditProfileSeed(q);
    const seededId =
      (politics?.channelId && /^UC[\w-]{20,}$/.test(politics.channelId)
        ? politics.channelId
        : undefined) ||
      entertainment?.channelId ||
      (pundit?.youtubeChannelId && /^UC[\w-]{20,}$/.test(pundit.youtubeChannelId)
        ? pundit.youtubeChannelId
        : undefined) ||
      (/^UC[\w-]{20,}$/.test(q) ? q : undefined);

    let channelId = seededId;

    // Handle resolution before expensive search.list (quota-safe path).
    if (!channelId) {
      const handle =
        politics?.handle ||
        entertainment?.handle ||
        (() => {
          const m = pundit?.youtubeUrl?.match(/youtube\.com\/@([^/?#]+)/i);
          return m?.[1] ? `@${m[1]}` : undefined;
        })();
      if (handle) {
        channelId = await channelIdByHandle(key, handle);
      }
    }

    if (!channelId) {
      // Last resort — search burns 100 units/day; skip when quota is known-tight.
      if (process.env.YOUTUBE_SKIP_SEARCH === "1") return undefined;
      const search = await fetchJson<{
        items?: { id?: { channelId?: string }; snippet?: { channelId?: string; title?: string } }[];
        error?: { message?: string; errors?: { reason?: string }[] };
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
      if (!ranked[0] || ranked[0].score < 4) return undefined;
      channelId = ranked[0].id;
    }
    if (!channelId) return undefined;

    const channels = await channelsByIds(key, [channelId]);
    const channel = channels[0];
    if (!channel) return undefined;
    if (
      !politics &&
      !entertainment &&
      !pundit &&
      !seededId &&
      titleSimilarity(channel.title, q) < 4
    ) {
      return undefined;
    }
    if ((channel.subscriberCount ?? 0) < 1000 && !politics && !pundit && !seededId) {
      return undefined;
    }

    const videos = await recentVideoTitles(
      key,
      channel.id,
      channel.uploadsPlaylistId,
      5,
    );

    return {
      channelId: channel.id,
      title: channel.title,
      url: channelPublicUrl(channel.id),
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
