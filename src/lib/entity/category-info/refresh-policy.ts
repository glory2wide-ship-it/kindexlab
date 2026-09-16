/**
 * Client-safe refresh policy for ItemDetailCategoryInfo.
 * Cadence matches the ops recommendation table shown on /admin.
 */

import type { CategoryInfoChannel } from "@/lib/entity/category-info/types";

export type CategoryInfoRefreshTierId =
  | "live_signal"
  | "ticket_food"
  | "media_catalog"
  | "entertainment_curated"
  | "other_news";

export type CategoryInfoRefreshTier = {
  id: CategoryInfoRefreshTierId;
  /** Admin table “구분”. */
  label: string;
  /** Human cadence, e.g. 하루 1회. */
  cadenceLabel: string;
  /** Cache / stale window. */
  intervalMs: number;
  /** ISR/unstable_cache revalidate seconds. */
  revalidateSec: number;
  /** Channels covered by this tier. */
  channels: readonly CategoryInfoChannel[];
  /** Short reason shown under the admin table. */
  reason: string;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const CATEGORY_INFO_REFRESH_TIERS: readonly CategoryInfoRefreshTier[] = [
  {
    id: "live_signal",
    label: "부동산·차트·뉴스·보조금",
    cadenceLabel: "하루 1회",
    intervalMs: DAY,
    revalidateSec: 24 * 3600,
    channels: [
      "housing",
      "stock",
      "finance",
      "overseas_stock",
      "commodities_fx",
      "inflation",
      "music",
      "gov_subsidy",
      "travel_grant",
      "local_policy",
      "startup",
      "issue_keyword",
      "party_support",
      "politician_support",
    ],
    reason: "실거래·차트·지원 공고 등 — 일 1회 재수집으로 비용·지연을 맞춥니다",
  },
  {
    id: "ticket_food",
    label: "공연·전시·맛집·티켓",
    cadenceLabel: "하루 1회",
    intervalMs: DAY,
    revalidateSec: 24 * 3600,
    channels: ["performance", "exhibition", "food"],
    reason: "일정·장소·영업시간·예매율이 자주 바뀌는 채널",
  },
  {
    id: "media_catalog",
    label: "웹툰·도서·유튜브",
    cadenceLabel: "3일",
    intervalMs: 3 * DAY,
    revalidateSec: 3 * 24 * 3600,
    channels: ["webtoon", "book", "youtuber", "politics_youtube"],
    reason: "플랫폼·작가·출판사·채널 메타는 상대적으로 안정적",
  },
  {
    id: "entertainment_curated",
    label: "소속사·히트곡·시놉시스(연예)",
    cadenceLabel: "주 1회",
    intervalMs: 7 * DAY,
    revalidateSec: 7 * 24 * 3600,
    channels: ["kpop", "trot", "star", "movie", "tv_ratings"],
    reason: "큐레이션 팩(멤버·소속·시놉시스) 중심 채널",
  },
  {
    id: "other_news",
    label: "기타·뉴스 보강",
    cadenceLabel: "6시간",
    intervalMs: 6 * HOUR,
    revalidateSec: 6 * 3600,
    channels: [
      "generic",
      "game",
      "health",
      "recipe",
      "car",
      "domestic_travel",
      "overseas_travel",
      "weekend_outing",
      "political_pundit",
    ],
    reason: "뉴스·웹 수집 보강이 주된 채널",
  },
] as const;

const CHANNEL_TO_TIER = new Map<CategoryInfoChannel, CategoryInfoRefreshTier>();
for (const tier of CATEGORY_INFO_REFRESH_TIERS) {
  for (const channel of tier.channels) {
    CHANNEL_TO_TIER.set(channel, tier);
  }
}

const FALLBACK_TIER =
  CATEGORY_INFO_REFRESH_TIERS.find((tier) => tier.id === "other_news")!;

export function resolveCategoryInfoRefreshTier(
  channel: CategoryInfoChannel,
): CategoryInfoRefreshTier {
  return CHANNEL_TO_TIER.get(channel) ?? FALLBACK_TIER;
}

export function categoryInfoRevalidateSec(channel: CategoryInfoChannel): number {
  return resolveCategoryInfoRefreshTier(channel).revalidateSec;
}
