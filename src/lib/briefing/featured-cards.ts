import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { BriefingArticle } from "@/lib/types";

export const FEATURED_CARDS_REL = path.join("src", "data", "briefings", "featured-cards.json");

type FeaturedCardsFile = {
  updatedAt?: string;
  articles?: BriefingArticle[];
};

/** Process-lifetime cache — featured-cards.json is static between deploys/rebuilds. */
let featuredCardsMemo: BriefingArticle[] | null | undefined;

/**
 * Slim landing-rail cards built at prebuild / briefing persist time.
 * Avoids parsing the multi-MB `extra.json` on every landing request.
 */
export function readFeaturedCardsIndex(): BriefingArticle[] {
  if (featuredCardsMemo !== undefined) return featuredCardsMemo ?? [];
  try {
    const file = path.join(process.cwd(), FEATURED_CARDS_REL);
    if (!existsSync(file)) {
      featuredCardsMemo = null;
      return [];
    }
    const parsed = JSON.parse(readFileSync(file, "utf8")) as FeaturedCardsFile;
    const articles = Array.isArray(parsed.articles) ? parsed.articles : [];
    featuredCardsMemo = articles;
    return articles;
  } catch {
    featuredCardsMemo = null;
    return [];
  }
}

/** Drop memo after regenerating the index in the same process (persist / scripts). */
export function clearFeaturedCardsMemo(): void {
  featuredCardsMemo = undefined;
}
