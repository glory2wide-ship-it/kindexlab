/** Client poll + CDN max-age for live trends / heatmap boards (3 minutes). */
export const DEFAULT_TRENDS_REVALIDATE_SEC = 180;

export function trendsRevalidateSec(): number {
  const n = Number(process.env.TRENDS_LIVE_REVALIDATE ?? DEFAULT_TRENDS_REVALIDATE_SEC);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_TRENDS_REVALIDATE_SEC;
}

/** e.g. "Next Update in 3 min" · "Next Update in 2 min 12 sec" · "Next Update in 45 sec" */
export function formatRefreshCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  if (min <= 0) return `Next Update in ${sec} sec`;
  if (sec === 0) return `Next Update in ${min} min`;
  return `Next Update in ${min} min ${sec} sec`;
}

export function formatRefreshClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}
