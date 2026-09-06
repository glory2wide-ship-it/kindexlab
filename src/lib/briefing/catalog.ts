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

/** Process-lifetime index — extra.json is static until the next deploy/restart. */
let persistedCache: BriefingArticle[] | null = null;
const persistedByChannelDate = new Map<string, BriefingArticle[]>();

function channelDateKey(channel: PostChannel, editionDate: string): string {
  return `${channel}:${editionDate}`;
}

/** Every persisted briefing row (extra.json + published seeds). */
export function listPersisted(): BriefingArticle[] {
  if (persistedCache) return persistedCache;
  const map = new Map<string, BriefingArticle>();
  for (const item of [...publishedBriefings(), ...extras()]) {
    map.set(item.slug, withBriefingCover(item));
  }
  persistedCache = [...map.values()].sort(compareArticles);
  return persistedCache;
}

export function persistedChannelEdition(
  channel: PostChannel,
  editionDate: string,
): BriefingArticle[] {
  const key = channelDateKey(channel, editionDate);
  const hit = persistedByChannelDate.get(key);
  if (hit) return hit;
  const rows = listPersisted()
    .filter((item) => item.channel === channel && item.editionDate === editionDate)
    .sort(compareArticles);
  persistedByChannelDate.set(key, rows);
  return rows;
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
