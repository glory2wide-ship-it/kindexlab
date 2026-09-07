import type { PostChannel } from "@/lib/posts/types";

/**
 * Destination / restaurant / outing boards. Their synthetic change and volume
 * were scaled like entertainment search spikes, which pushed 여행·맛집 tiles
 * to #1 on the mixed landing heatmap.
 */
export const TRAVEL_LEISURE_BOARD_SLUGS = [
  "food-restaurant-ranking",
  "domestic-travel-ranking",
  "overseas-travel-ranking",
  "weekend-outing-ranking",
] as const;

const TRAVEL_CHANNEL_HEAT = 0.36;

const CHANNEL_HEAT_SCALE: Record<PostChannel, number> = {
  entertainment: 1,
  politics: 1,
  economy: 1,
  culture: 1,
  travel: TRAVEL_CHANNEL_HEAT,
};

export function isTravelLeisureBoardSlug(slug: string | undefined): boolean {
  if (!slug) return false;
  return TRAVEL_LEISURE_BOARD_SLUGS.some((prefix) => slug === prefix || slug.startsWith(`${prefix}--`));
}

export function isTravelHeatmapEntity(entity: {
  sourceChannel?: PostChannel;
  slug?: string;
}): boolean {
  if (entity.sourceChannel === "travel") return true;
  return isTravelLeisureBoardSlug(entity.slug);
}

/** Tighter than the global ±15% tone so leisure rows cannot sit at the ceiling. */
export function travelLeisureChangeClamp(): number {
  return 7.4;
}

/** Volume was `score * 80` (~8k at the score cap) — sqrt(volume) then dominated heat. */
export function volumePerScoreForBoard(boardSlug: string): number {
  return isTravelLeisureBoardSlug(boardSlug) ? 32 : 80;
}

function kstClock(at = new Date()): { hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  const wd = parts.find((part) => part.type === "weekday")?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  return { hour, weekday: weekday < 0 ? 1 : weekday };
}

/**
 * Extra leisure dampener in KST. Late night / weekday mornings should not
 * outrank news and entertainment on the landing board.
 */
function travelHourFactor(at = new Date()): number {
  const { hour, weekday } = kstClock(at);
  const weekend = weekday === 0 || weekday === 6;
  let hourFactor = 0.7;
  if (hour >= 22 || hour < 8) hourFactor = 0.48;
  else if (hour < 11) hourFactor = 0.62;
  else if (hour < 14) hourFactor = 0.82;
  else if (hour < 17) hourFactor = 0.68;
  else if (hour < 21) hourFactor = 0.78;
  else hourFactor = 0.58;
  return hourFactor * (weekend ? 1.18 : 1);
}

/**
 * Multiplier applied to heatmap heat (not the on-tile % itself).
 * Same factor for every travel name, so /travel internal order is unchanged.
 */
export function heatmapChannelHeatScale(
  entity: { sourceChannel?: PostChannel; slug?: string },
  at = new Date(),
): number {
  if (!isTravelHeatmapEntity(entity)) {
    return CHANNEL_HEAT_SCALE[entity.sourceChannel ?? "entertainment"] ?? 1;
  }
  return TRAVEL_CHANNEL_HEAT * travelHourFactor(at);
}

export function lightHorizonFloorMin(entity: { sourceChannel?: PostChannel; slug?: string }): number {
  return isTravelHeatmapEntity(entity) ? 1.15 : 3.2;
}
