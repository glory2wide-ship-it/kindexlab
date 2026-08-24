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
  return scoreFmt.format(value);
}

export function formatRate(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(n).toFixed(2);
  if (n > 0) return `+${abs}%`;
  if (n < 0) return `-${abs}%`;
  return `0.00%`;
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
};

export function scoreLabel(type: string): string {
  if (type === "music_chart") return "차트 지수";
  if (type === "tv_rating") return "시청률 지수";
  return "버즈 점수";
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
