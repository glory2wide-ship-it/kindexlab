import type { RankingEntity, SeriesPoint, Timeframe, TimeframeMetrics } from "@/lib/types";
import { TIMEFRAMES } from "@/lib/categories";

const COUNTS: Record<Timeframe, number> = {
  "5m": 48,
  "10m": 36,
  "30m": 24,
  "60m": 24,
  "1d": 30,
  "1w": 26,
  "1m": 12,
};

function hash(input: string): number {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function labelFor(tf: Timeframe, index: number, count: number): string {
  if (tf === "5m" || tf === "10m" || tf === "30m" || tf === "60m") {
    const step = tf === "5m" ? 5 : tf === "10m" ? 10 : tf === "30m" ? 30 : 60;
    const minutes = 9 * 60 + index * step;
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  if (tf === "1d") return index === count - 1 ? "오늘" : `${count - index}일전`.replace("1일전", "어제");
  if (tf === "1w") return index === count - 1 ? "이번주" : `${count - index}주전`;
  return index === count - 1 ? "이번달" : `${count - index}달전`;
}

function seriesHasMovement(points: SeriesPoint[]): boolean {
  if (points.length < 2) return false;
  const first = points[0]?.v;
  return points.some((point) => point.v !== first);
}

export function getTimeframeSeries(
  entity: RankingEntity,
  timeframe: Timeframe,
): SeriesPoint[] {
  if (timeframe === "1d" && entity.history.length > 3 && seriesHasMovement(entity.history)) {
    return entity.history;
  }

  const count = COUNTS[timeframe];
  const rand = mulberry(hash(`${entity.id}:${timeframe}`));
  const end = entity.buzzScore;
  const start = openForTimeframe(entity, timeframe, rand);
  const points: SeriesPoint[] = [];
  let value = start;

  for (let i = 0; i < count; i += 1) {
    const progress = i / Math.max(count - 1, 1);
    const drift = start + (end - start) * progress;
    const noise = (rand() - 0.48) * entity.buzzScore * 0.012;
    value = drift * 0.7 + value * 0.3 + noise;
    points.push({ t: labelFor(timeframe, i, count), v: Number(value.toFixed(2)) });
  }

  points[0] = { t: points[0]?.t ?? labelFor(timeframe, 0, count), v: Number(start.toFixed(2)) };
  points[points.length - 1] = {
    t: points[points.length - 1]?.t ?? "지금",
    v: Number(end.toFixed(2)),
  };
  return points;
}

function openForTimeframe(
  entity: RankingEntity,
  timeframe: Timeframe,
  rand: () => number,
): number {
  if (timeframe === "1d") {
    if (Number.isFinite(entity.fluctuationRate) && entity.fluctuationRate !== 0 && entity.buzzScore) {
      const implied = entity.buzzScore / (1 + entity.fluctuationRate / 100);
      if (implied > 0) return implied;
    }
    if (Number.isFinite(entity.openScore) && entity.openScore > 0 && entity.openScore !== entity.buzzScore) {
      return entity.openScore;
    }
  }
  return Math.max(entity.openScore, 1) * (0.92 + rand() * 0.08);
}

export function changeForSeries(points: SeriesPoint[]): number {
  const first = points[0]?.v ?? 0;
  const last = points[points.length - 1]?.v ?? first;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return 0;
  return Number((((last - first) / first) * 100).toFixed(2));
}

export function changeForEntity(entity: RankingEntity, timeframe: Timeframe): number {
  const stored = Number.isFinite(entity.fluctuationRate) ? entity.fluctuationRate : 0;
  if (timeframe === "1d" && stored !== 0) return stored;

  const seriesChange = changeForSeries(getTimeframeSeries(entity, timeframe));
  if (Number.isFinite(seriesChange) && seriesChange !== 0) return seriesChange;
  return timeframe === "1d" ? stored : seriesChange;
}

export function timeframeLabel(id: Timeframe): string {
  return TIMEFRAMES.find((item) => item.id === id)?.label ?? id;
}

const VOLUME_SCALE: Record<Timeframe, number> = {
  "5m": 0.06,
  "10m": 0.1,
  "30m": 0.22,
  "60m": 0.4,
  "1d": 1,
  "1w": 4.2,
  "1m": 14,
};

export function buildTimeframeMetrics(entity: RankingEntity): TimeframeMetrics {
  const metrics = {} as TimeframeMetrics;
  for (const option of TIMEFRAMES) {
    const series = getTimeframeSeries(entity, option.id);
    const last = series[series.length - 1]?.v ?? entity.buzzScore;
    metrics[option.id] = {
      buzzScore: Number(last.toFixed(2)),
      changeRate: changeForEntity(entity, option.id),
      volume: Math.round(entity.volume * VOLUME_SCALE[option.id]),
    };
  }
  return metrics;
}

export function parseTimeframeParam(raw?: string | string[]): Timeframe | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  return TIMEFRAMES.some((item) => item.id === value) ? (value as Timeframe) : undefined;
}
