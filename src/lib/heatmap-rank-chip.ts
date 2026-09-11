/**
 * Rank-header chips painted before the #NN badge on heatmap tiles.
 * Paint-only — never mutate entity.name.
 */

import { entityPlatform, type GamePlatformTag } from "@/lib/boards/game-platforms";
import { isTwoLineBracketHeatmap } from "@/lib/boards/culture-grants";
import { REGION_HOUSING_APARTMENTS } from "@/lib/boards/housing-apartments";
import {
  isRegionSegment,
  REGION_LABEL,
  regionFromName,
} from "@/lib/boards/regions";
import type { RegionSegment } from "@/lib/boards/types";
import {
  boardSlugOf,
  inferBookGenreChip,
  inferCelebrityJobChip,
  inferMusicGenreChip,
  inferTvChannelChip,
  stripChipBrackets,
} from "@/lib/heatmap-rank-meta";
import { namesOverlap } from "@/lib/ingestion/names";
import { heatmapSourceCaption } from "@/lib/news/headline-title";
import { parseBracketLabel } from "@/lib/politics/labeled-rank";
import type { RankingEntity } from "@/lib/types";

const GAME_GROUPS = new Set(["게임", "게임 e스포츠"]);
const GRANT_OR_REGION_TYPES = new Set([
  "subsidy",
  "local_policy",
  "housing",
  "apartment",
  "performance",
  "exhibition",
  "travel_spot",
  "restaurant",
]);

/** User-facing game platform labels for the rank chip. */
export function formatHeatmapGameChip(platform: GamePlatformTag | string): string {
  const raw = platform.replace(/\s*게임/g, "").trim();
  if (raw === "모바일" || raw.startsWith("모바일")) return "모바일";
  if (raw === "콘솔" || raw.startsWith("콘솔")) return "콘솔게임";
  if (raw === "PC" || raw.startsWith("PC")) return "PC게임";
  if (/모바일/.test(raw)) return "모바일";
  if (/콘솔/.test(raw)) return "콘솔게임";
  return "PC게임";
}

function isGameEntity(entity: Pick<RankingEntity, "type" | "slug" | "heatmapGroup">): boolean {
  if (entity.type === "mobile_game" || entity.type === "pc_game" || entity.type === "console_game") {
    return true;
  }
  const slug = entity.slug ?? "";
  const group = entity.heatmapGroup ?? "";
  return slug.startsWith("game-esports-ranking") || GAME_GROUPS.has(group);
}

function wantsBracketChip(entity: Pick<RankingEntity, "type" | "slug" | "heatmapGroup">): boolean {
  if (isTwoLineBracketHeatmap(entity.heatmapGroup)) return true;
  if (GRANT_OR_REGION_TYPES.has(entity.type)) return true;
  const slug = entity.slug ?? "";
  return (
    slug.startsWith("government-") ||
    slug.includes("grant") ||
    slug.startsWith("housing-") ||
    slug.startsWith("performance-") ||
    slug.startsWith("exhibition-") ||
    slug.startsWith("domestic-travel") ||
    slug.startsWith("weekend-outing") ||
    slug.startsWith("food-restaurant")
  );
}

function isTvRatingsEntity(entity: Pick<RankingEntity, "type" | "slug" | "heatmapGroup">): boolean {
  if (entity.type === "tv_rating" || entity.type === "tv_show") return true;
  const slug = boardSlugOf(entity);
  const group = entity.heatmapGroup ?? "";
  return slug === "realtime-tv-ratings" || group === "TV 시청률";
}

function isMusicChartEntity(entity: Pick<RankingEntity, "type" | "slug" | "heatmapGroup">): boolean {
  if (entity.type === "music_chart") return true;
  const slug = boardSlugOf(entity);
  const group = entity.heatmapGroup ?? "";
  return slug === "realtime-music-chart" || group === "음원";
}

function isStarEntity(entity: Pick<RankingEntity, "type" | "slug" | "heatmapGroup">): boolean {
  if (entity.type === "celebrity") return true;
  const slug = boardSlugOf(entity);
  const group = entity.heatmapGroup ?? "";
  return slug === "star-reputation-index" || group === "스타";
}

function isBookEntity(entity: Pick<RankingEntity, "type" | "slug" | "heatmapGroup">): boolean {
  if (entity.type === "book") return true;
  const slug = boardSlugOf(entity);
  const group = entity.heatmapGroup ?? "";
  return slug === "bestseller-surge-index" || group.includes("도서");
}

function isHousingRegionEntity(
  entity: Pick<RankingEntity, "type" | "slug" | "heatmapGroup">,
): boolean {
  if (entity.type === "housing") return true;
  const slug = boardSlugOf(entity);
  const group = entity.heatmapGroup ?? "";
  return (
    slug === "housing-subscription-hotspot" ||
    slug.startsWith("housing-") ||
    group === "지역별 부동산" ||
    group === "부동산" ||
    group === "부동산 관심 랭킹" ||
    group === "부동산 지수"
  );
}

/** Resolve 시/도 for 부동산 tiles: region field → name → catalog → bracket. */
function resolveHousingRegionChip(
  entity: Pick<RankingEntity, "name" | "region" | "type" | "slug" | "heatmapGroup">,
): string | undefined {
  if (entity.region && isRegionSegment(entity.region)) {
    return REGION_LABEL[entity.region];
  }

  const fromName = regionFromName(entity.name);
  if (fromName) return REGION_LABEL[fromName];

  const subject = parseBracketLabel(entity.name)?.subject ?? entity.name;
  for (const [segment, apartments] of Object.entries(REGION_HOUSING_APARTMENTS) as Array<
    [RegionSegment, readonly string[]]
  >) {
    if (apartments.some((apt) => namesOverlap(apt, subject))) {
      return REGION_LABEL[segment];
    }
  }

  const bracket = parseBracketLabel(entity.name);
  if (bracket?.org) return stripChipBrackets(bracket.org);
  return undefined;
}

/**
 * Chip text shown immediately before the rank badge.
 * Priority: game → TV → music → star → book → menu (category composite) → region/agency.
 * Bracket qualifiers render without `[` `]` symbols.
 * Economy 부동산 tiles prefer the 시/도 label ahead of the rank.
 */
export function heatmapRankPrefixChip(
  entity: Pick<
    RankingEntity,
    | "name"
    | "nameEn"
    | "type"
    | "slug"
    | "heatmapGroup"
    | "platform"
    | "sourceChannel"
    | "tags"
    | "region"
  >,
  options?: { allowMenuCaption?: boolean },
): string | undefined {
  // Category composite (정치/경제 첫 화면): always show submenu name before rank.
  if (options?.allowMenuCaption) {
    const menu = heatmapSourceCaption(entity as RankingEntity);
    if (menu) return stripChipBrackets(menu);
  }

  if (isGameEntity(entity)) {
    const platform = entityPlatform(entity);
    if (platform) return stripChipBrackets(formatHeatmapGameChip(platform));
  }

  if (isTvRatingsEntity(entity)) {
    const channel = inferTvChannelChip(entity);
    if (channel) return stripChipBrackets(channel);
  }

  if (isMusicChartEntity(entity)) {
    const genre = inferMusicGenreChip(entity);
    if (genre) return stripChipBrackets(genre);
  }

  if (isStarEntity(entity)) {
    const job = inferCelebrityJobChip(entity);
    if (job) return stripChipBrackets(job);
  }

  if (isBookEntity(entity)) {
    const genre = inferBookGenreChip(entity);
    if (genre) return stripChipBrackets(genre);
  }

  if (isHousingRegionEntity(entity)) {
    const regionChip = resolveHousingRegionChip(entity);
    if (regionChip) return stripChipBrackets(regionChip);
  }

  if (wantsBracketChip(entity)) {
    const bracket = parseBracketLabel(entity.name);
    if (bracket?.org) return stripChipBrackets(bracket.org);
  }

  return undefined;
}
