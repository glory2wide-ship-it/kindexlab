/**
 * Navigation labels, heatmap caps, and travel region board routing.
 * Shared by the board registry, category rail, heatmap renderers, and travel sub-routes.
 */
import type { RegionSegment } from "@/lib/boards/types";
import { REGION_LABEL, REGION_SEGMENTS } from "@/lib/boards/regions";

export const POLITICS_RETIRED_BOARD_SLUGS = ["politics-housing-index"] as const;

export type PoliticsHeatmapBoardSlug = "party-support-chart" | "politician-support-chart";

export const POLITICS_HEATMAP_BOARD_NAV: Record<
  PoliticsHeatmapBoardSlug,
  { slug: PoliticsHeatmapBoardSlug; title: string; shortTitle: string; heatmapLimit: number }
> = {
  "party-support-chart": {
    slug: "party-support-chart",
    title: "정당 지지도 랭킹",
    shortTitle: "정당 지지도 랭킹",
    heatmapLimit: 15,
  },
  "politician-support-chart": {
    slug: "politician-support-chart",
    title: "정치인 지지도 랭킹",
    shortTitle: "정치인 지지도 랭킹",
    heatmapLimit: 20,
  },
};

export function isRetiredPoliticsBoard(slug: string): boolean {
  return (POLITICS_RETIRED_BOARD_SLUGS as readonly string[]).includes(slug);
}

/** Travel boards that expose 시/도 region tabs (same schema as 음식/맛집 랭킹). */
export const TRAVEL_REGION_BOARD_SLUGS = [
  "domestic-travel-ranking",
  "weekend-outing-ranking",
  "food-restaurant-ranking",
] as const;

export type TravelRegionBoardKey = "domestic" | "outing" | "food";

/** Heatmap tile caps for travel boards (domestic + outing only). */
export const TRAVEL_HEATMAP_BOARD_NAV: Record<
  "domestic-travel-ranking" | "weekend-outing-ranking",
  { slug: string; heatmapLimitAll: number; heatmapLimitRegion: number }
> = {
  "domestic-travel-ranking": {
    slug: "domestic-travel-ranking",
    heatmapLimitAll: 20,
    heatmapLimitRegion: 12,
  },
  "weekend-outing-ranking": {
    slug: "weekend-outing-ranking",
    heatmapLimitAll: 20,
    heatmapLimitRegion: 12,
  },
};

export const TRAVEL_REGION_BOARD_NAV: Record<
  TravelRegionBoardKey,
  {
    slug: (typeof TRAVEL_REGION_BOARD_SLUGS)[number];
    title: string;
    shortTitle: string;
    routePrefix: `/travel/${string}`;
    regions: readonly RegionSegment[];
  }
> = {
  domestic: {
    slug: "domestic-travel-ranking",
    title: "국내 여행 랭킹",
    shortTitle: "국내 여행 랭킹",
    routePrefix: "/travel/domestic",
    regions: REGION_SEGMENTS,
  },
  outing: {
    slug: "weekend-outing-ranking",
    title: "주말 나들이 랭킹",
    shortTitle: "주말 나들이 랭킹",
    routePrefix: "/travel/outing",
    regions: REGION_SEGMENTS,
  },
  food: {
    slug: "food-restaurant-ranking",
    title: "음식/맛집 랭킹",
    shortTitle: "음식/맛집 랭킹",
    routePrefix: "/travel/food",
    regions: REGION_SEGMENTS,
  },
};

export function travelRegionPath(
  key: Extract<TravelRegionBoardKey, "domestic" | "outing">,
  region: RegionSegment,
): string {
  return `${TRAVEL_REGION_BOARD_NAV[key].routePrefix}/${region}`;
}

export function travelRegionLabel(region: RegionSegment): string {
  return REGION_LABEL[region];
}

export function isTravelRegionBoardSlug(slug: string): boolean {
  return (TRAVEL_REGION_BOARD_SLUGS as readonly string[]).includes(slug);
}

export function travelBoardKeyForSlug(slug: string): TravelRegionBoardKey | undefined {
  const hit = Object.entries(TRAVEL_REGION_BOARD_NAV).find(([, meta]) => meta.slug === slug);
  return hit?.[0] as TravelRegionBoardKey | undefined;
}
