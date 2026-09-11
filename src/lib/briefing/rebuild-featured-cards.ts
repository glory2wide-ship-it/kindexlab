import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { slimBriefingsForCards } from "@/lib/briefing/card-dto";
import {
  clearFeaturedCardsMemo,
  FEATURED_CARDS_REL,
} from "@/lib/briefing/featured-cards";
import { filterLiveBriefings } from "@/lib/briefing/featured";
import { getTodaysBriefings } from "@/lib/briefing/store";
import type { BriefingArticle } from "@/lib/types";

/**
 * Rebuild the slim landing-rail index from today's live edition.
 * Safe to call after `persistEdition` or from the prebuild script.
 */
export async function rebuildFeaturedCardsIndex(
  articles?: BriefingArticle[],
): Promise<{ path: string; count: number }> {
  const source = articles?.length
    ? filterLiveBriefings(articles)
    : filterLiveBriefings(await getTodaysBriefings());
  const slim = slimBriefingsForCards(source);
  const file = path.join(process.cwd(), FEATURED_CARDS_REL);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), articles: slim })}\n`,
    "utf8",
  );
  clearFeaturedCardsMemo();
  return { path: FEATURED_CARDS_REL, count: slim.length };
}
