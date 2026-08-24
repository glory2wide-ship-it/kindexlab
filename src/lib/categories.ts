import type { CategoryId, EntityType, TimeframeOption } from "@/lib/types";

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "all", label: "종합" },
  { id: "kpop", label: "K-POP 아이돌" },
  { id: "celebrity", label: "셀럽" },
  { id: "tv_show", label: "방송" },
  { id: "influencer", label: "인플루언서" },
  { id: "music_chart", label: "실시간 음원 차트" },
  { id: "tv_rating", label: "실시간 시청률 순위" },
];

export const TIMEFRAMES: TimeframeOption[] = [
  { id: "5m", label: "5m", group: "분봉" },
  { id: "10m", label: "10m", group: "분봉" },
  { id: "30m", label: "30m", group: "분봉" },
  { id: "60m", label: "60m", group: "분봉" },
  { id: "1d", label: "Daily", group: "일봉" },
  { id: "1w", label: "Weekly", group: "주봉" },
  { id: "1m", label: "Monthly", group: "월봉" },
];

export const TYPE_ORDER: EntityType[] = [
  "kpop",
  "celebrity",
  "tv_show",
  "influencer",
  "music_chart",
  "tv_rating",
];
