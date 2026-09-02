import extraFile from "@/data/briefings/extra.json";
import { publishedBriefings } from "@/data/briefings/published";
import { compareDatesDesc, isLiveEdition } from "@/lib/briefing/dates";
import { withBriefingCover } from "@/lib/briefing/cover";
import { isPersistableBriefing } from "@/lib/briefing/quality";
import type { PostChannel } from "@/lib/posts/types";
import type { BriefingArticle } from "@/lib/types";

function extras(): BriefingArticle[] {
  return (extraFile as { articles?: BriefingArticle[] }).articles ?? [];
}

/** Every persisted briefing row (extra.json + published seeds). */
export function listPersisted(): BriefingArticle[] {
  const map = new Map<string, BriefingArticle>();
  for (const item of [...publishedBriefings(), ...extras()]) {
    map.set(item.slug, withBriefingCover(item));
  }
  return [...map.values()].sort(compareArticles);
}

export function persistedChannelEdition(
  channel: PostChannel,
  editionDate: string,
): BriefingArticle[] {
  return listPersisted()
    .filter((item) => item.channel === channel && item.editionDate === editionDate)
    .sort(compareArticles);
}

/** Archived seeds only — today's live edition is served from persisted or template compose. */
export function listSeeded(): BriefingArticle[] {
  return listPersisted().filter((item) => !isLiveEdition(item.editionDate));
}

export function hasEdition(editionDate: string): boolean {
  const forDate = listPersisted().filter((item) => item.editionDate === editionDate);
  if (!forDate.length) return false;
  return forDate.some(isPersistableBriefing);
}

export function compareArticles(a: BriefingArticle, b: BriefingArticle): number {
  const byDate = compareDatesDesc(a.editionDate, b.editionDate);
  if (byDate !== 0) return byDate;
  if (a.kind !== b.kind) return a.kind === "main" ? -1 : 1;
  return a.slug.localeCompare(b.slug);
}
