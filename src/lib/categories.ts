import type { CategoryId, EntityType, TimeframeOption } from "@/lib/types";

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "all", label: "종합" },
  { id: "kpop", label: "K-POP 아이돌" },
  { id: "celebrity", label: "셀럽" },
  { id: "tv_show", label: "방송" },
  { id: "influencer", label: "인플루언서" },
  { id: "music_chart", label: "실시간 음원 차트" },
  { id: "tv_rating", label: "실시간 시청률 순위" },
  { id: "webtoon", label: "실시간 웹툰" },
  { id: "shorts", label: "숏폼/SNS" },
  { id: "mobile_game", label: "모바일 게임" },
  { id: "pc_game", label: "PC 게임" },
  { id: "console_game", label: "콘솔 게임" },
];

export const TIMEFRAMES: TimeframeOption[] = [
  { id: "1m", label: "1m", group: "분봉" },
  { id: "5m", label: "5m", group: "분봉" },
  { id: "10m", label: "10m", group: "분봉" },
  { id: "30m", label: "30m", group: "분봉" },
  { id: "60m", label: "60m", group: "분봉" },
  { id: "120m", label: "120m", group: "분봉" },
  { id: "1d", label: "Daily", group: "일봉" },
  { id: "1w", label: "Weekly", group: "주봉" },
  { id: "1mo", label: "Monthly", group: "월봉" },
];

export const TYPE_ORDER: EntityType[] = [
  "kpop",
  "celebrity",
  "tv_show",
  "influencer",
  "music_chart",
  "tv_rating",
  "webtoon",
  "shorts",
  "mobile_game",
  "pc_game",
  "console_game",
];
