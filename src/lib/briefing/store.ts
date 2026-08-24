import { unstable_cache } from "next/cache";
import { marketIndices, rankings, rankingsUpdatedAt } from "@/data/rankings";
import { compareArticles, listSeeded } from "@/lib/briefing/catalog";
import { composeEdition } from "@/lib/briefing/compose";
import { compareDatesDesc, editionDateTime, isLiveEdition, kstDateString } from "@/lib/briefing/dates";
import type { BriefingArticle, CategoryId, RankingsPayload } from "@/lib/types";

const payload: RankingsPayload = {
  updatedAt: rankingsUpdatedAt,
  status: "open",
  indices: marketIndices,
  items: rankings,
};

const composeLiveEdition = unstable_cache(
  async (editionDate: string) => composeEdition(payload, editionDate, editionDateTime(editionDate)),
  ["briefing-live-edition"],
  { revalidate: 3600 },
);

export async function listAllBriefings(): Promise<BriefingArticle[]> {
  const seeded = listSeeded();
  const today = kstDateString();
  if (seeded.some((item) => item.editionDate === today)) {
    return seeded.sort(compareArticles);
  }
  const live = await composeLiveEdition(today);
  return [...seeded, ...live].sort(compareArticles);
}

export async function getBriefingBySlug(slug: string): Promise<BriefingArticle | undefined> {
  const articles = await listAllBriefings();
  return articles.find((item) => item.slug === slug);
}

export async function getTodaysBriefings(): Promise<BriefingArticle[]> {
  const today = kstDateString();
  return (await listAllBriefings()).filter((item) => item.editionDate === today);
}

export async function getTodaysMainBriefing(): Promise<BriefingArticle> {
  const all = await listAllBriefings();
  const today = all.filter((item) => item.editionDate === kstDateString());
  const main = today.find((item) => item.kind === "main") ?? today[0] ?? all[0];
  if (!main) {
    throw new Error("No briefing articles available");
  }
  return main;
}

export async function getArchiveBriefings(): Promise<BriefingArticle[]> {
  return (await listAllBriefings()).filter((item) => !isLiveEdition(item.editionDate));
}

export async function getAllBriefingSlugs(): Promise<string[]> {
  return (await listAllBriefings()).map((item) => item.slug);
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
  return (await listAllBriefings()).filter((item) => item.editionDate === date);
}

export async function listEditionDates(): Promise<string[]> {
  const dates = new Set((await listAllBriefings()).map((item) => item.editionDate));
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
  const allowed: CategoryId[] = [
    "all",
    "kpop",
    "celebrity",
    "tv_show",
    "influencer",
    "music_chart",
    "tv_rating",
  ];
  return allowed.includes(value as CategoryId) ? (value as CategoryId) : undefined;
}
