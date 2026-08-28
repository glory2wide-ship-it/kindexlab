import {
  getAllBriefingSlugs,
  getArchiveBriefings,
  getBriefingBySlug,
  getBriefingsByDate,
  getChannelBriefingEdition,
  getTodaysBriefings,
  getTodaysMainBriefing,
  groupBriefingsByDate,
  listAllBriefings,
  listEditionDates,
  parseCategoryParam,
  parseScopeParam,
  searchBriefings,
  splitChannelEdition,
} from "@/lib/briefing/store";
import {
  getAllSlugs,
  getEntitiesBySlugs,
  getEntityBySlug,
  getRankings,
  getRelatedEntities,
  getTrendBySlug,
  getTrends,
} from "@/lib/providers/trends";
import type { RankingEntity } from "@/lib/types";

/**
 * App-facing data access. Rankings/trends come from the provider so scrapers
 * can replace the mock without touching pages or route handlers.
 */

export {
  getAllSlugs,
  getEntitiesBySlugs,
  getEntityBySlug,
  getRankings,
  getRelatedEntities,
  getTrendBySlug,
  getTrends,
};

export async function getDailyBriefing() {
  return getTodaysMainBriefing();
}

export {
  getAllBriefingSlugs,
  getArchiveBriefings,
  getBriefingBySlug,
  getBriefingsByDate,
  getChannelBriefingEdition,
  getTodaysBriefings,
  getTodaysMainBriefing,
  groupBriefingsByDate,
  listAllBriefings,
  listEditionDates,
  parseCategoryParam,
  parseScopeParam,
  searchBriefings,
  splitChannelEdition,
};

export type { RankingEntity };
