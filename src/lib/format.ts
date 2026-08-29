const krw = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat("ko-KR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const scoreFmt = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatKrw(value: number): string {
  return krw.format(value);
}

export function formatCompact(value: number): string {
  return compact.format(value);
}

export function formatScore(value: number): string {
  return scoreFmt.format(Number.isFinite(value) ? value : 0);
}

/** Safe integer/count formatter — never throws on undefined cache fields. */
export function formatCount(value: number | null | undefined, locale = "ko-KR"): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n.toLocaleString(locale) : "0";
}

export function formatRate(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(n).toFixed(2);
  if (n > 0) return `+${abs}%`;
  if (n < 0) return `-${abs}%`;
  return `0.00%`;
}

/** Board index on a 100-point scale, e.g. "98.5 pt". */
export function formatIndexPoints(buzzScore: number): string {
  const raw = Number.isFinite(buzzScore) ? buzzScore : 0;
  const points = raw > 120 ? raw / 10 : raw;
  return `${points.toFixed(1)} pt`;
}

export function formatPoints(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(n).toFixed(2);
  if (n > 0) return `+${abs}pt`;
  if (n < 0) return `-${abs}pt`;
  return `0.00pt`;
}

export function formatKst(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}.${pick("month")}.${pick("day")} ${pick("hour")}:${pick("minute")}`;
}

export const TYPE_LABEL: Record<string, string> = {
  kpop: "K-POP",
  celebrity: "셀럽",
  tv_show: "방송",
  influencer: "인플루언서",
  music_chart: "음원",
  tv_rating: "시청률",
  webtoon: "웹툰",
  shorts: "숏폼",
  mobile_game: "모바일",
  pc_game: "PC게임",
  console_game: "콘솔",
  headline_news: "헤드라인",
  party_support: "정당",
  politician_support: "정치인",
  political_pundit: "평론가",
  political_influencer: "정치유튜브",
  political_ratings: "정치뉴스",
  political_search: "검색어",
  local_policy: "지자체",
  subsidy: "지원금",
  economy_board: "경제 지수",
  culture_board: "문화/여행/맛집/레져/생활",
};

export function scoreLabel(type: string): string {
  if (type === "music_chart") return "차트 지수";
  if (type === "tv_rating") return "시청률 지수";
  if (type === "webtoon") return "인기 지수";
  if (type === "shorts") return "조회 지수";
  if (type === "mobile_game") return "인기 지수";
  if (type === "pc_game") return "플레이 지수";
  if (type === "console_game") return "트렌드 지수";
  if (type === "headline_news") return "헤드라인 지수";
  if (type === "party_support" || type === "politician_support") return "지지도 지수";
  if (type === "political_pundit") return "평론 지수";
  if (type === "political_influencer") return "유튜브 지수";
  if (type === "political_ratings") return "시청률 지수";
  if (type === "political_search") return "검색 지수";
  if (type === "local_policy") return "정책 지수";
  if (type === "subsidy") return "지원금 지수";
  if (type === "economy_board") return "경제 지수";
  if (type === "culture_board") return "문화/여행/맛집/레져/생활 지수";
  return "버즈 점수";
}

export function metricLabel(type: string): string {
  if (type === "shorts" || type === "webtoon") return "조회";
  if (type === "mobile_game") return "인기";
  if (type === "pc_game") return "동접";
  if (type === "console_game") return "트렌드";
  if (type === "tv_rating") return "시청";
  if (type === "music_chart") return "스트리밍";
  if (type === "headline_news" || type === "political_search") return "언급";
  if (type === "party_support" || type === "politician_support") return "지지도";
  if (type === "subsidy" || type === "local_policy") return "관심";
  return "거래량";
}

export function formatLiveKst(date: Date): { dateLine: string; timeLine: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekdayKo: Record<string, string> = {
    Mon: "월",
    Tue: "화",
    Wed: "수",
    Thu: "목",
    Fri: "금",
    Sat: "토",
    Sun: "일",
  };
  const weekday = weekdayKo[pick("weekday")] ?? pick("weekday");
  return {
    dateLine: `${pick("year")}.${pick("month")}.${pick("day")} (${weekday})`,
    timeLine: `${pick("hour")}:${pick("minute")}:${pick("second")}`,
  };
}

export function rankDelta(rank: number, previousRank: number): number {
  return previousRank - rank;
}
