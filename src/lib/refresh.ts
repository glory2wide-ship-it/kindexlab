export const DEFAULT_TRENDS_REVALIDATE_SEC = 60;

export function trendsRevalidateSec(): number {
  const n = Number(process.env.TRENDS_LIVE_REVALIDATE ?? DEFAULT_TRENDS_REVALIDATE_SEC);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_TRENDS_REVALIDATE_SEC;
}

export function formatRefreshCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `Next update in ${min} min ${sec} sec`;
}

export function formatRefreshClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}
