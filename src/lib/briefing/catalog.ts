import extraFile from "@/data/briefings/extra.json";
import { publishedBriefings } from "@/data/briefings/published";
import { compareDatesDesc } from "@/lib/briefing/dates";
import { withBriefingCover } from "@/lib/briefing/cover";
import type { BriefingArticle } from "@/lib/types";

function extras(): BriefingArticle[] {
  return (extraFile as { articles?: BriefingArticle[] }).articles ?? [];
}

export function listSeeded(): BriefingArticle[] {
  const map = new Map<string, BriefingArticle>();
  for (const item of [...publishedBriefings(), ...extras()]) {
    map.set(item.slug, withBriefingCover(item));
  }
  return [...map.values()].sort(compareArticles);
}

export function hasEdition(editionDate: string): boolean {
  return listSeeded().some((item) => item.editionDate === editionDate);
}

export function compareArticles(a: BriefingArticle, b: BriefingArticle): number {
  const byDate = compareDatesDesc(a.editionDate, b.editionDate);
  if (byDate !== 0) return byDate;
  if (a.kind !== b.kind) return a.kind === "main" ? -1 : 1;
  return a.slug.localeCompare(b.slug);
}
