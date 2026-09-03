import { fetchJson, nowIso } from "@/lib/ingestion/http";
import type { ChartRow, SourceResult } from "@/lib/ingestion/types";
import {
  POLITICS_YOUTUBE_SEEDS,
  politicsYoutubeChannelIds,
  type PoliticsYoutubeSeed,
} from "@/lib/politics/youtube-seeds";

function result(id: string, label: string, items: ChartRow[], error?: string): SourceResult {
  return {
    id,
    label,
    ok: !error && items.length > 0,
    count: items.length,
    error: error ?? (items.length ? undefined : "no rows"),
    fetchedAt: nowIso(),
    items,
  };
}

function youtubeKey(): string {
  return (process.env.YOUTUBE_API_KEY ?? process.env.GOOGLE_YOUTUBE_API_KEY ?? "").trim();
}

interface ChannelList {
  items?: {
    id?: string;
    snippet?: { title?: string };
    statistics?: { viewCount?: string; subscriberCount?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }[];
}

interface PlaylistItems {
  items?: { contentDetails?: { videoId?: string } }[];
}

interface VideoList {
  items?: {
    id?: string;
    statistics?: { viewCount?: string };
    liveStreamingDetails?: { concurrentViewers?: string };
  }[];
}

function seedForChannelId(id: string): PoliticsYoutubeSeed | undefined {
  return POLITICS_YOUTUBE_SEEDS.find((seed) => seed.channelId === id);
}

function baselineMetric(seed: PoliticsYoutubeSeed, index: number): number {
  return Math.max(12, 88 - index * 6);
}

/** Seed rows used when the YouTube API is missing or a channel fetch fails. */
export function politicsYoutubeSeedRows(): ChartRow[] {
  return POLITICS_YOUTUBE_SEEDS.filter((seed) => seed.influencer).map((seed, index) => ({
    rank: index + 1,
    title: seed.name,
    subtitle: seed.nameEn,
    metric: baselineMetric(seed, index),
    volume: Math.round(2_400_000 / (index + 1)),
    tags: ["유튜브", "시사", "정치 유튜브", "seed", ...seed.types],
  }));
}

function scoreFromStats(input: {
  subscribers: number;
  lifetimeViews: number;
  concurrent: number;
  recentVodViews: number;
}): number {
  const sub = Math.log10(input.subscribers + 1) * 14;
  const life = Math.log10(input.lifetimeViews + 1) * 4;
  const live = Math.log10(input.concurrent + 1) * 18;
  const vod = Math.log10(input.recentVodViews + 1) * 8;
  return Number((sub + life + live + vod).toFixed(2));
}

async function playlistVideoIds(playlistId: string, key: string): Promise<string[]> {
  if (!playlistId) return [];
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=8&key=${encodeURIComponent(key)}`;
  try {
    const data = await fetchJson<PlaylistItems>(url);
    return (data.items ?? [])
      .map((item) => item.contentDetails?.videoId ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function videoStats(
  ids: string[],
  key: string,
): Promise<{ concurrent: number; recentVodViews: number }> {
  if (!ids.length) return { concurrent: 0, recentVodViews: 0 };
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${ids.map(encodeURIComponent).join(",")}&key=${encodeURIComponent(key)}`;
  try {
    const data = await fetchJson<VideoList>(url);
    let concurrent = 0;
    let recentVodViews = 0;
    for (const item of data.items ?? []) {
      const live = Number.parseInt(item.liveStreamingDetails?.concurrentViewers ?? "0", 10);
      if (Number.isFinite(live) && live > 0) concurrent += live;
      const views = Number.parseInt(item.statistics?.viewCount ?? "0", 10);
      if (Number.isFinite(views)) recentVodViews += views;
    }
    return { concurrent, recentVodViews };
  } catch {
    return { concurrent: 0, recentVodViews: 0 };
  }
}

export async function fetchPoliticsYoutubeSources(): Promise<SourceResult[]> {
  const seeded = politicsYoutubeSeedRows();
  const key = youtubeKey();
  if (!key) {
    return [result("youtube-politics-seeds", "정치 시사 유튜브 씨드", seeded, "YOUTUBE_API_KEY 없음 · 씨드 유지")];
  }

  const ids = politicsYoutubeChannelIds();
  if (!ids.length) {
    return [result("youtube-politics-seeds", "정치 시사 유튜브 씨드", seeded)];
  }

  try {
    const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${ids.join(",")}&maxResults=50&key=${encodeURIComponent(key)}`;
    const channels = await fetchJson<ChannelList>(channelsUrl);
    const liveItems: ChartRow[] = [];

    for (const [index, channel] of (channels.items ?? []).entries()) {
      const id = channel.id ?? "";
      const seed = seedForChannelId(id);
      const title = seed?.name ?? channel.snippet?.title ?? id;
      const subscribers = Number.parseInt(channel.statistics?.subscriberCount ?? "0", 10) || 0;
      const lifetimeViews = Number.parseInt(channel.statistics?.viewCount ?? "0", 10) || 0;
      const uploads = channel.contentDetails?.relatedPlaylists?.uploads ?? "";
      const videoIds = await playlistVideoIds(uploads, key);
      const { concurrent, recentVodViews } = await videoStats(videoIds, key);
      const metric = scoreFromStats({ subscribers, lifetimeViews, concurrent, recentVodViews });
      liveItems.push({
        rank: index + 1,
        title,
        subtitle: seed?.nameEn ?? channel.snippet?.title,
        metric: Number.isFinite(metric) && metric > 0 ? metric : baselineMetric(seed ?? POLITICS_YOUTUBE_SEEDS[0], index),
        volume: Math.max(1, Math.round(subscribers / 10 + concurrent * 80 + recentVodViews / 50)),
        tags: [
          "유튜브",
          "시사",
          "정치 유튜브",
          concurrent > 0 ? "라이브" : "VOD",
          ...(seed?.types ?? ["political_influencer"]),
        ],
      });
    }

    const byTitle = new Set(liveItems.map((item) => item.title));
    for (const row of seeded) {
      if (![...byTitle].some((name) => name === row.title)) liveItems.push(row);
    }

    liveItems.sort((a, b) => (b.metric ?? 0) - (a.metric ?? 0));
    return [
      result(
        "youtube-politics-seeds",
        "정치 시사 유튜브 씨드",
        liveItems.map((item, index) => ({ ...item, rank: index + 1 })),
      ),
    ];
  } catch (error) {
    return [
      result(
        "youtube-politics-seeds",
        "정치 시사 유튜브 씨드",
        seeded,
        error instanceof Error ? error.message : "youtube fetch failed",
      ),
    ];
  }
}
