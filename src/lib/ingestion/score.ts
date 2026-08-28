export function scoreFromRank(rank: number, size: number, floor = 880, ceil = 1860): number {
  if (size <= 1) return ceil;
  const t = 1 - (rank - 1) / Math.max(size - 1, 1);
  return Number((floor + t * (ceil - floor)).toFixed(2));
}

export function scoreFromMetric(metric: number, scale = 72, floor = 820): number {
  return Number((floor + Math.min(metric, 18) * scale).toFixed(2));
}

export function volumeFromRank(rank: number, base = 90_000): number {
  return Math.max(12_000, Math.round((48 - rank) * base));
}

export function changeFromScores(current: number, previous?: number): number {
  if (!previous || previous <= 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

export function pointsFromRate(value: number, rate: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(rate) || rate === 0) return 0;
  const previous = value / (1 + rate / 100);
  if (!Number.isFinite(previous)) return 0;
  return Number((value - previous).toFixed(2));
}

export function sparklineFromHistory(history: number[], current: number): number[] {
  const points = [...history.slice(-6), current];
  while (points.length < 7) points.unshift(points[0] ?? current);
  return points.map((value) => Number(value.toFixed(2)));
}
