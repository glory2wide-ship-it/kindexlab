import { POLITICS_CATEGORIES, POLITICS_TYPE_ORDER } from "@/lib/politics/types";
import type { CategoryId, EntityType, RankingEntity, TimeframeOption } from "@/lib/types";

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "all", label: "종합 랭킹" },
  { id: "kpop", label: "K POP" },
  { id: "trot", label: "트로트·가요" },
  { id: "celebrity", label: "스타" },
  { id: "tv_show", label: "방송" },
  { id: "influencer", label: "유튜버" },
  { id: "music_chart", label: "음원" },
  { id: "tv_rating", label: "TV 시청률" },
  { id: "movie", label: "영화" },
  { id: "webtoon", label: "웹툰" },
  { id: "mobile_game", label: "모바일 게임" },
  { id: "pc_game", label: "PC 게임" },
  { id: "console_game", label: "콘솔 게임" },
];

/**
 * Candle buttons on the live-index / heatmap toolbar.
 * Default (and shortest UI) window is 5분 — aligned with refresh cadence.
 * Legacy 1m / 3m stay in ALL_TIMEFRAMES for stored metrics only.
 */
export const TIMEFRAMES: TimeframeOption[] = [
  { id: "5m", label: "5분", group: "분봉" },
  { id: "10m", label: "10분", group: "분봉" },
  { id: "30m", label: "30분", group: "분봉" },
  { id: "60m", label: "60분", group: "분봉" },
  { id: "1d", label: "일봉", group: "일봉" },
  { id: "1w", label: "주봉", group: "주봉" },
  { id: "1mo", label: "월봉", group: "월봉" },
];

/** Full metric windows including legacy 1m / 3m (data only — not shown in the toolbar). */
export const ALL_TIMEFRAMES: TimeframeOption[] = [
  { id: "1m", label: "1분", group: "분봉" },
  { id: "3m", label: "3분", group: "분봉" },
  ...TIMEFRAMES,
];

export { POLITICS_CATEGORIES, POLITICS_TYPE_ORDER };

export const TYPE_ORDER: EntityType[] = [
  "kpop",
  "trot",
  "celebrity",
  "tv_show",
  "influencer",
  "music_chart",
  "tv_rating",
  "movie",
  "webtoon",
  "mobile_game",
  "pc_game",
  "console_game",
];

export const ALL_CATEGORIES: { id: CategoryId; label: string }[] = [
  ...CATEGORIES,
  ...POLITICS_CATEGORIES.filter((item) => item.id !== "all"),
];

export function orderedEntityTypes(items: RankingEntity[]): EntityType[] {
  const present = [...new Set(items.map((item) => item.type))];
  const preferred = [...TYPE_ORDER, ...POLITICS_TYPE_ORDER];
  return [
    ...preferred.filter((type) => present.includes(type)),
    ...present.filter((type) => !preferred.includes(type)),
  ];
}
