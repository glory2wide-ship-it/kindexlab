import type { RankingEntity, SeriesPoint, Timeframe, TimeframeMetrics } from "@/lib/types";
import { TIMEFRAMES } from "@/lib/categories";

const COUNTS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 48,
  "10m": 36,
  "30m": 24,
  "60m": 24,
  "120m": 24,
  "1d": 30,
  "1w": 26,
  "1mo": 12,
};

const CHANGE_SCALE: Record<Timeframe, number> = {
  "1m": 0.42,
  "5m": 0.58,
  "10m": 0.74,
  "30m": 0.92,
  "60m": 1.08,
  "120m": 1.14,
  "1d": 1.2,
  "1w": 1.85,
  "1mo": 2.45,
};

const JITTER: Record<Timeframe, number> = {
  "1m": 7.4,
  "5m": 5.8,
  "10m": 4.6,
  "30m": 3.4,
  "60m": 2.8,
  "120m": 2.2,
  "1d": 1.6,
  "1w": 3.8,
  "1mo": 5.2,
};

const PHASE: Record<Timeframe, number> = {
  "1m": 0.2,
  "5m": 1.1,
  "10m": 2.0,
  "30m": 2.9,
  "60m": 3.7,
  "120m": 4.15,
  "1d": 4.6,
  "1w": 5.8,
  "1mo": 7.1,
};

const VOLUME_SCALE: Record<Timeframe, number> = {
  "1m": 0.03,
  "5m": 0.06,
  "10m": 0.1,
  "30m": 0.22,
  "60m": 0.4,
  "120m": 0.7,
  "1d": 1,
  "1w": 4.2,
  "1mo": 14,
};

const MINUTE_STEP: Partial<Record<Timeframe, number>> = {
  "1m": 1,
  "5m": 5,
  "10m": 10,
  "30m": 30,
  "60m": 60,
  "120m": 120,
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
  const step = MINUTE_STEP[tf];
  if (step) {
    const minutes = 9 * 60 + index * step;
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  if (tf === "1d") return index === count - 1 ? "오늘" : `${count - index}일전`.replace("1일전", "어제");
  if (tf === "1w") return index === count - 1 ? "이번주" : `${count - index}주전`;
  return index === count - 1 ? "이번달" : `${count - index}달전`;
}

function storedChange(entity: RankingEntity): number {
  return Number.isFinite(entity.fluctuationRate) ? entity.fluctuationRate : 0;
}

function sparklineChange(entity: RankingEntity): number {
  const series = entity.sparkline.filter((value) => Number.isFinite(value));
  if (series.length < 2) return 0;
  const first = series[0] ?? 0;
  const last = series[series.length - 1] ?? first;
  if (!first || first === last) return 0;
  return ((last - first) / first) * 100;
}

function horizonChange(entity: RankingEntity, timeframe: Timeframe): number {
  const stored = storedChange(entity);
  const spark = sparklineChange(entity);
  const rawBase = stored !== 0 ? stored : spark;
  const base = Math.max(-28, Math.min(28, rawBase));
  const rand = mulberry(hash(`${entity.id}:${entity.slug}:${timeframe}`));
  const scale = CHANGE_SCALE[timeframe];
  const jitter = (rand() - 0.5) * JITTER[timeframe];
  const phase = PHASE[timeframe] + (hash(entity.id) % 360) * (Math.PI / 180);
  const wave = Math.sin(entity.rank * 0.41 + phase + rand() * 0.15);
  const floor = Math.max(Math.abs(base), 3.2);
  const value = base * scale * 0.4 + floor * scale * wave + jitter;
  return Number(Math.max(-89, Math.min(89, value)).toFixed(2));
}

function metricsCoverAllWindows(metrics?: TimeframeMetrics): boolean {
  if (!metrics) return false;
  return TIMEFRAMES.every((option) => Number.isFinite(metrics[option.id]?.changeRate));
}

function metricsAreDistinct(metrics?: TimeframeMetrics): boolean {
  if (!metricsCoverAllWindows(metrics)) return false;
  const rates = TIMEFRAMES.map((option) => metrics?.[option.id]?.changeRate);
  const first = rates[0];
  return rates.some((rate) => rate !== first);
}

export function volumeForTimeframe(entity: RankingEntity, timeframe: Timeframe): number {
  const stored = entity.metrics?.[timeframe]?.volume;
  if (metricsAreDistinct(entity.metrics) && Number.isFinite(stored) && (stored as number) > 0) {
    return stored as number;
  }
  return Math.max(1, Math.round(entity.volume * VOLUME_SCALE[timeframe]));
}

export function scoreForTimeframe(entity: RankingEntity, timeframe: Timeframe): number {
  const stored = entity.metrics?.[timeframe]?.buzzScore;
  if (metricsAreDistinct(entity.metrics) && Number.isFinite(stored) && (stored as number) > 0) {
    return stored as number;
  }
  const change = changeForEntity(entity, timeframe);
  return Number((entity.buzzScore * (1 + change / 400)).toFixed(2));
}

export function heatForTimeframe(entity: RankingEntity, timeframe: Timeframe): number {
  const change = changeForEntity(entity, timeframe);
  const volume = volumeForTimeframe(entity, timeframe);
  return Math.abs(change) * Math.sqrt(Math.max(volume, 1));
}

export function getTimeframeSeries(
  entity: RankingEntity,
  timeframe: Timeframe,
): SeriesPoint[] {
  const count = COUNTS[timeframe];
  const change = changeForEntity(entity, timeframe);
  const end = entity.buzzScore;
  const start = end / (1 + change / 100);
  const rand = mulberry(hash(`${entity.id}:series:${timeframe}`));
  const points: SeriesPoint[] = [];
  let value = start;

  for (let i = 0; i < count; i += 1) {
    const progress = i / Math.max(count - 1, 1);
    const drift = start + (end - start) * progress;
    const noise = (rand() - 0.48) * Math.max(Math.abs(end), 1) * (timeframe === "1m" ? 0.018 : 0.01);
    value = drift * 0.72 + value * 0.28 + noise;
    points.push({ t: labelFor(timeframe, i, count), v: Number(value.toFixed(2)) });
  }

  points[0] = { t: points[0]?.t ?? labelFor(timeframe, 0, count), v: Number(start.toFixed(2)) };
  points[points.length - 1] = {
    t: points[points.length - 1]?.t ?? "지금",
    v: Number(end.toFixed(2)),
  };
  return points;
}

export function changeForSeries(points: SeriesPoint[]): number {
  const first = points[0]?.v ?? 0;
  const last = points[points.length - 1]?.v ?? first;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return 0;
  return Number((((last - first) / first) * 100).toFixed(2));
}

export function changeForEntity(entity: RankingEntity, timeframe: Timeframe): number {
  const live = entity.metrics?.[timeframe]?.changeRate;
  if (metricsAreDistinct(entity.metrics) && Number.isFinite(live)) return live as number;
  return horizonChange(entity, timeframe);
}

export function timeframeLabel(id: Timeframe): string {
  return TIMEFRAMES.find((item) => item.id === id)?.label ?? id;
}

export function buildTimeframeMetrics(entity: RankingEntity): TimeframeMetrics {
  const metrics = {} as TimeframeMetrics;
  for (const option of TIMEFRAMES) {
    const changeRate = horizonChange(entity, option.id);
    metrics[option.id] = {
      buzzScore: Number((entity.buzzScore * (1 + changeRate / 400)).toFixed(2)),
      changeRate,
      volume: Math.max(1, Math.round(entity.volume * VOLUME_SCALE[option.id])),
    };
  }
  return metrics;
}

export function attachTimeframeMetrics(entity: RankingEntity): RankingEntity {
  if (metricsAreDistinct(entity.metrics)) return entity;
  return { ...entity, metrics: buildTimeframeMetrics(entity) };
}

export function rankItemsForTimeframe(
  items: RankingEntity[],
  timeframe: Timeframe,
): RankingEntity[] {
  return [...items]
    .map(attachTimeframeMetrics)
    .sort((a, b) => {
      const heat = heatForTimeframe(b, timeframe) - heatForTimeframe(a, timeframe);
      if (heat !== 0) return heat;
      const score = scoreForTimeframe(b, timeframe) - scoreForTimeframe(a, timeframe);
      if (score !== 0) return score;
      return a.rank - b.rank;
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      previousRank: item.rank,
    }));
}

export function parseTimeframeParam(raw?: string | string[]): Timeframe | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  if (value === "monthly") return "1mo";
  if (value === "2h") return "120m";
  return TIMEFRAMES.some((item) => item.id === value) ? (value as Timeframe) : undefined;
}
