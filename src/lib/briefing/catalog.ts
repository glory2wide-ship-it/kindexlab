import { readFileSync } from "node:fs";
import path from "node:path";
import { publishedBriefings } from "@/data/briefings/published";
import { compareDatesDesc, isLiveEdition } from "@/lib/briefing/dates";
import { withBriefingCover } from "@/lib/briefing/cover";
import { isPersistableBriefing } from "@/lib/briefing/quality";
import { isPublicEditorialContent } from "@/lib/content/public-since";
import type { PostChannel } from "@/lib/posts/types";
import type { BriefingArticle } from "@/lib/types";

/**
 * Read extra.json from disk on first use instead of a static import.
 * A static import embeds ~4.6MB into every server chunk that touches the
 * briefing catalog and slows cold soft-nav / first briefing Suspense paint.
 */
function extras(): BriefingArticle[] {
  try {
    const file = path.join(process.cwd(), "src", "data", "briefings", "extra.json");
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { articles?: BriefingArticle[] };
    return parsed.articles ?? [];
  } catch {
    return [];
  }
}

/** Process-lifetime index — extra.json is static until the next deploy/restart. */
let persistedCache: BriefingArticle[] | null = null;
const persistedByChannelDate = new Map<string, BriefingArticle[]>();

function channelDateKey(channel: PostChannel, editionDate: string): string {
  return `${channel}:${editionDate}`;
}

function isPublicBriefing(article: BriefingArticle): boolean {
  return isPublicEditorialContent({
    editionDate: article.editionDate,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
  });
}

/** Every persisted briefing row (extra.json + published seeds). */
export function listPersisted(): BriefingArticle[] {
  if (persistedCache) return persistedCache;
  const map = new Map<string, BriefingArticle>();
  for (const item of [...publishedBriefings(), ...extras()]) {
    if (!isPublicBriefing(item)) continue;
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
