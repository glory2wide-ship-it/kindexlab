import { unstable_cache } from "next/cache";
import { cache } from "react";
import { compareArticles, listPersisted, listSeeded, persistedChannelEdition } from "@/lib/briefing/catalog";
import { composeChannelEdition } from "@/lib/briefing/compose";
import { withBriefingCover } from "@/lib/briefing/cover";
import { compareDatesDesc, editionDateTime, isLiveEdition, kstDateString } from "@/lib/briefing/dates";
import { channelUsesBoardBriefing, composeBoardChannelEdition } from "@/lib/briefing/from-boards";
import { collectHeatmapTopics } from "@/lib/briefing/heatmap-topics";
import { isPersistableBriefing } from "@/lib/briefing/quality";
import { ALL_CATEGORIES } from "@/lib/categories";
import { isPostChannel, POST_CHANNELS } from "@/lib/posts/channels";
import { getRankings } from "@/lib/providers/trends";
import type { PostChannel } from "@/lib/posts/types";
import type { BriefingArticle, CategoryId } from "@/lib/types";

/** Template-only fallback when today's persisted edition is missing. No on-demand OpenAI. */
const composeLiveChannelEdition = unstable_cache(
  async (editionDate: string, channel: PostChannel) => {
    const publishedAt = editionDateTime(editionDate);
    const topicPool = await collectHeatmapTopics(channel);
    if (channelUsesBoardBriefing(channel)) {
      return composeBoardChannelEdition(channel, editionDate, publishedAt, topicPool);
    }
    return composeChannelEdition(
      await getRankings(),
      channel,
      editionDate,
      publishedAt,
      topicPool,
    );
  },
  ["briefing-channel-edition-v17-heatmap-topics"],
  { revalidate: 3600 },
);

export function parseChannelFromSlug(slug: string): PostChannel | undefined {
  const match = slug.match(/^\d{4}-\d{2}-\d{2}-([a-z]+)-/);
  const candidate = match?.[1];
  return isPostChannel(candidate) ? candidate : undefined;
}

export async function getChannelBriefingEdition(channel: PostChannel): Promise<BriefingArticle[]> {
  const today = kstDateString();
  const persisted = persistedChannelEdition(channel, today).filter(isPersistableBriefing);
  if (persisted.length) {
    // listPersisted already strips cover images — return as-is.
    return persisted;
  }
  const live = await composeLiveChannelEdition(today, channel);
  return live.filter(isPersistableBriefing).map((item) => withBriefingCover(item));
}

export function splitChannelEdition(articles: BriefingArticle[]): {
  main: BriefingArticle | undefined;
  dives: BriefingArticle[];
} {
  return {
    main: articles.find((item) => item.kind === "main"),
    dives: articles.filter((item) => item.kind === "deep-dive"),
  };
}

export async function listAllBriefings(): Promise<BriefingArticle[]> {
  const today = kstDateString();
  const live = (
    await Promise.all(POST_CHANNELS.map((channel) => getChannelBriefingEdition(channel.id)))
  ).flat();
  const seeded = listSeeded().filter((item) => item.editionDate !== today);
  return [...seeded, ...live].sort(compareArticles);
}

export async function getTodaysBriefings(): Promise<BriefingArticle[]> {
  const live = await Promise.all(POST_CHANNELS.map((channel) => getChannelBriefingEdition(channel.id)));
  return live.flat().sort(compareArticles);
}

export async function getBriefingBySlug(slug: string): Promise<BriefingArticle | undefined> {
  const persisted = listPersisted().find((item) => item.slug === slug);
  if (persisted && isPersistableBriefing(persisted)) return withBriefingCover(persisted);

  const editionDate = slug.slice(0, 10);
  const channel = parseChannelFromSlug(slug);
  if (channel && isLiveEdition(editionDate)) {
    const edition = await getChannelBriefingEdition(channel);
    const hit = edition.find((item) => item.slug === slug);
    if (hit) return withBriefingCover(hit);
  }
  return undefined;
}

/** Dedupes metadata + page fetches within one navigation request. */
export const loadBriefingBySlug = cache(getBriefingBySlug);

export async function getTodaysMainBriefing(): Promise<BriefingArticle> {
  const entertainment = await getChannelBriefingEdition("entertainment");
  const main = entertainment.find((item) => item.kind === "main") ?? entertainment[0];
  if (!main) {
    throw new Error("No briefing articles available");
  }
  return main;
}

export async function getArchiveBriefings(): Promise<BriefingArticle[]> {
  return listSeeded().sort(compareArticles);
}

export async function getAllBriefingSlugs(): Promise<string[]> {
  const today = await getTodaysBriefings();
  const archive = await getArchiveBriefings();
  return [...today, ...archive].map((item) => item.slug);
}

export function searchBriefings(
  articles: BriefingArticle[],
  query?: string,
  category?: CategoryId,
): BriefingArticle[] {
  const q = query?.trim().toLowerCase();
  return articles.filter((item) => {
    if (category && category !== "all" && item.category !== category) return false;
    if (!q) return true;
    const haystack = [
      item.title,
      item.excerpt,
      item.editionDate,
      ...item.sections.flatMap((section) => [section.heading ?? "", ...section.paragraphs]),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export async function getBriefingsByDate(date: string): Promise<BriefingArticle[]> {
  if (isLiveEdition(date)) return getTodaysBriefings();
  return (await getArchiveBriefings()).filter((item) => item.editionDate === date);
}

export async function listEditionDates(): Promise<string[]> {
  const dates = new Set(
    [...(await getTodaysBriefings()), ...(await getArchiveBriefings())].map((item) => item.editionDate),
  );
  return [...dates].sort(compareDatesDesc);
}

export function groupBriefingsByDate(
  articles: BriefingArticle[],
): { date: string; articles: BriefingArticle[] }[] {
  const map = new Map<string, BriefingArticle[]>();
  for (const article of articles) {
    const bucket = map.get(article.editionDate) ?? [];
    bucket.push(article);
    map.set(article.editionDate, bucket);
  }
  return [...map.entries()]
    .sort((a, b) => compareDatesDesc(a[0], b[0]))
    .map(([date, grouped]) => ({ date, articles: grouped }));
}

export function parseScopeParam(raw?: string | string[]): "today" | "archive" | "all" {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "today" || value === "archive") return value;
  return "all";
}

export function parseCategoryParam(raw?: string | string[]): CategoryId | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value === "all") return value === "all" ? "all" : undefined;
  const allowed = ALL_CATEGORIES.map((item) => item.id);
  return allowed.includes(value as CategoryId) ? (value as CategoryId) : undefined;
}

