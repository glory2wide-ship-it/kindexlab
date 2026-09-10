/**
 * Rank-header chips painted before the #NN badge on heatmap tiles.
 * Paint-only — never mutate entity.name.
 */

import { entityPlatform, type GamePlatformTag } from "@/lib/boards/game-platforms";
import { isTwoLineBracketHeatmap } from "@/lib/boards/culture-grants";
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

/**
 * Chip text shown immediately before the rank badge.
 * Priority: game platform → [지역/기관] → optional submenu caption.
 */
export function heatmapRankPrefixChip(
  entity: Pick<
    RankingEntity,
    "name" | "type" | "slug" | "heatmapGroup" | "platform" | "sourceChannel" | "tags"
  >,
  options?: { allowMenuCaption?: boolean },
): string | undefined {
  if (isGameEntity(entity)) {
    const platform = entityPlatform(entity);
    if (platform) return formatHeatmapGameChip(platform);
  }

  if (wantsBracketChip(entity)) {
    const bracket = parseBracketLabel(entity.name);
    if (bracket?.org) return `[${bracket.org}]`;
  }

  if (options?.allowMenuCaption) {
    const menu = heatmapSourceCaption(entity as RankingEntity);
    if (menu) return menu;
  }

  return undefined;
}
