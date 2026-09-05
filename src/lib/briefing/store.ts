import { cache } from "react";
import { compareArticles, listPersisted, listSeeded, persistedChannelEdition } from "@/lib/briefing/catalog";
import { withBriefingCover } from "@/lib/briefing/cover";
import { compareDatesDesc, isLiveEdition, kstDateString } from "@/lib/briefing/dates";
import { desksForChannel, resolveBriefingDeskId } from "@/lib/briefing/desks";
import { isPersistableBriefing } from "@/lib/briefing/quality";
import { ALL_CATEGORIES } from "@/lib/categories";
import { isPostChannel, POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import type { BriefingArticle, CategoryId } from "@/lib/types";

export function parseChannelFromSlug(slug: string): PostChannel | undefined {
  const match = slug.match(/^\d{4}-\d{2}-\d{2}-([a-z]+)-/);
  const candidate = match?.[1];
  return isPostChannel(candidate) ? candidate : undefined;
}

/**
 * Reader-facing edition: Gemini-persisted articles only.
 * When today's run misses a slot, keep showing the most recent successful article
 * for that slot instead of exposing a blank card or template shell.
 */
export async function getChannelBriefingEdition(channel: PostChannel): Promise<BriefingArticle[]> {
  const today = kstDateString();
  const todays = persistedChannelEdition(channel, today).filter(isPersistableBriefing);
  const persisted = listPersisted()
    .filter((item) => item.channel === channel)
    .filter(isPersistableBriefing)
    .sort(compareArticles);

  const byDesk = new Map<string, BriefingArticle>();
  for (const article of todays) {
    if (article.kind !== "deep-dive") continue;
    const deskId = resolveBriefingDeskId(article.deskId, channel);
    if (deskId) byDesk.set(deskId, article);
  }

  const main =
    todays.find((item) => item.kind === "main") ??
    persisted.find((item) => item.kind === "main");

  for (const desk of desksForChannel(channel)) {
    if (byDesk.has(desk.id)) continue;
    const fallback = persisted.find(
      (item) => item.kind === "deep-dive" && resolveBriefingDeskId(item.deskId, channel) === desk.id,
    );
    if (fallback) byDesk.set(desk.id, fallback);
  }

  return [main, ...desksForChannel(channel).map((desk) => byDesk.get(desk.id))]
    .filter((item): item is BriefingArticle => Boolean(item))
    .sort(compareArticles);
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
  const seeded = listSeeded()
    .filter((item) => item.editionDate !== today)
    .filter(isPersistableBriefing);
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

export async function getTodaysMainBriefing(): Promise<BriefingArticle | undefined> {
  const entertainment = await getChannelBriefingEdition("entertainment");
  return entertainment.find((item) => item.kind === "main") ?? entertainment[0];
}

export async function getArchiveBriefings(): Promise<BriefingArticle[]> {
  return listSeeded().filter(isPersistableBriefing).sort(compareArticles);
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

