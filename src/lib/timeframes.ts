import type { CandlePoint, RankingEntity, SeriesPoint, Timeframe, TimeframeMetrics } from "@/lib/types";
import { ALL_TIMEFRAMES, TIMEFRAMES } from "@/lib/categories";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";

/** Compressed trading-day length in synthetic 1-minute bars (divisible by 3…120). */
const MINS_PER_DAY = 120;
/** Daily history depth — enough for 26 weeks (×5) and 12 months (×20). */
const HISTORY_DAYS = 260;

/** Bars shown per timeframe (intraday derived from WINDOW_HOURS). */
const DISPLAY_COUNTS: Record<Timeframe, number> = {
  "1m": 360,
  "3m": 240,
  "5m": 288,
  "10m": 288,
  "30m": 240,
  "60m": 240,
  "120m": 240,
  "1d": 30,
  "1w": 26,
  "1mo": 12,
};

/**
 * Wall-clock hours covered by the intraday chart.
 * 3m → 12h; higher minute bars stretch the window further.
 */
const WINDOW_HOURS: Partial<Record<Timeframe, number>> = {
  "1m": 6,
  "3m": 12,
  "5m": 24,
  "10m": 48,
  "30m": 5 * 24,
  "60m": 10 * 24,
  "120m": 20 * 24,
};

const VOLUME_SCALE: Record<Timeframe, number> = {
  "1m": 0.03,
  "3m": 0.045,
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
  "3m": 3,
  "5m": 5,
  "10m": 10,
  "30m": 30,
  "60m": 60,
  "120m": 120,
};

const WEEK_DAYS = 5;
const MONTH_DAYS = 20;

/** Cheap per-TF scales for list/heatmap metrics (no 31k-point path). */
const LIGHT_CHANGE_SCALE: Record<Timeframe, number> = {
  "1m": 0.42,
  "3m": 0.5,
  "5m": 0.58,
  "10m": 0.74,
  "30m": 0.92,
  "60m": 1.08,
  "120m": 1.14,
  "1d": 1.2,
  "1w": 1.85,
  "1mo": 2.45,
};

const LIGHT_JITTER: Record<Timeframe, number> = {
  "1m": 7.4,
  "3m": 6.6,
  "5m": 5.8,
  "10m": 4.6,
  "30m": 3.4,
  "60m": 2.8,
  "120m": 2.2,
  "1d": 1.6,
  "1w": 3.8,
  "1mo": 5.2,
};

const baseMinuteCache = new Map<string, number[]>();
const BASE_CACHE_LIMIT = 400;

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

function refreshBucket(): number {
  return Math.floor(Date.now() / (DEFAULT_TRENDS_REVALIDATE_SEC * 1000));
}

function safeBuzz(entity: RankingEntity): number {
  return Number.isFinite(entity.buzzScore) && entity.buzzScore > 0 ? entity.buzzScore : 1;
}

function storedChange(entity: RankingEntity): number {
  return Number.isFinite(entity.fluctuationRate) ? entity.fluctuationRate : 0;
}

function sparklineChange(entity: RankingEntity): number {
  const series = (entity.sparkline ?? []).filter((value) => Number.isFinite(value));
  if (series.length < 2) return 0;
  const first = series[0] ?? 0;
  const last = series[series.length - 1] ?? first;
  if (!first || first === last) return 0;
  return ((last - first) / first) * 100;
}

/** Overall move across the shared history window (feeds the single base path). */
function masterPathChange(entity: RankingEntity): number {
  const stored = storedChange(entity);
  const spark = sparklineChange(entity);
  const rawBase = stored !== 0 ? stored : spark;
  const base = Math.max(-18, Math.min(18, rawBase));
  const bucket = refreshBucket();
  const rand = mulberry(hash(`${entity.id}:${entity.slug}:master:v6:${bucket}`));
  const jitter = (rand() - 0.5) * 3.2;
  const wave = Math.sin(entity.rank * 0.41 + (hash(`${entity.id}:${bucket}`) % 360) * (Math.PI / 180));
  const floor = Math.max(Math.abs(base), 2.4);
  let value = base * 1.35 + floor * wave * 0.55 + jitter;
  // Mild session trend — enough to read, not a seismograph.
  if (Math.abs(value) < 3.5) {
    value = value >= 0 ? 3.5 + rand() * 2.5 : -(3.5 + rand() * 2.5);
  }
  return Number(Math.max(-22, Math.min(22, value)).toFixed(2));
}

/**
 * Stock-like path: daily anchors + smooth intraday session shape.
 * Each compressed day has a readable 1–3% range without high-frequency chaos.
 * Ends at `end` (current buzzScore).
 */
function buildPath(count: number, start: number, end: number, seed: string): number[] {
  const rand = mulberry(hash(seed));
  const amp = Math.max(Math.abs(end), Math.abs(start), 1);
  const days = Math.max(1, Math.ceil(count / MINS_PER_DAY));

  const dayCloses: number[] = [];
  for (let d = 0; d < days; d += 1) {
    const t = (d + 1) / days;
    const drift = start + (end - start) * t;
    const gap = (rand() - 0.5) * amp * 0.01;
    dayCloses.push(Math.max(amp * 0.25, drift + gap));
  }
  dayCloses[days - 1] = end;

  const points: number[] = [];
  let prevClose = start;

  for (let d = 0; d < days; d += 1) {
    const dayEnd = dayCloses[d]!;
    const dayStart = d === 0 ? start : prevClose;
    const mid = (dayStart + dayEnd) / 2;
    // Typical equity session range (~1.6–3.5%), occasional hotter session.
    const dayRange = mid * (0.016 + rand() * 0.019) * (rand() > 0.86 ? 1.55 : 1);
    let morningBias = (rand() - 0.5) * 2;
    if (Math.abs(morningBias) < 0.5) {
      morningBias = morningBias >= 0 ? 0.5 + rand() * 0.4 : -(0.5 + rand() * 0.4);
    }
    const midday = (rand() - 0.4) * (0.6 + rand() * 0.4);
    const dayLen = Math.min(MINS_PER_DAY, count - points.length);
    let residual = 0;

    for (let m = 0; m < dayLen; m += 1) {
      const u = m / Math.max(dayLen - 1, 1);
      const base = dayStart + (dayEnd - dayStart) * (u * u * (3 - 2 * u));
      const excursion =
        Math.sin(u * Math.PI) * dayRange * 0.7 * morningBias +
        Math.sin(u * Math.PI * 2) * dayRange * 0.28 * midday;
      residual = residual * 0.9 + (rand() - 0.5) * dayRange * 0.04;
      const settle = u > 0.92 ? (1 - u) / 0.08 : 1;
      let value = base + excursion * settle + residual * settle;
      if (m === 0) value = dayStart;
      if (m === dayLen - 1) value = dayEnd;
      points.push(round2(Math.max(amp * 0.2, value)));
    }
    prevClose = dayEnd;
  }

  while (points.length < count) points.push(round2(end));
  if (points.length > count) points.length = count;
  points[0] = round2(start);
  points[points.length - 1] = round2(end);
  return points;
}

function baseCacheKey(entity: RankingEntity): string {
  return `${entity.id}:${entity.slug}:v6:${safeBuzz(entity)}:${refreshBucket()}`;
}

/**
 * Single 1-minute close path spanning HISTORY_DAYS compressed sessions.
 * Every higher timeframe is derived from this series (HTS-style nesting).
 */
export function getBaseMinuteCloses(entity: RankingEntity): number[] {
  const key = baseCacheKey(entity);
  const cached = baseMinuteCache.get(key);
  if (cached) return cached;

  const end = safeBuzz(entity);
  const change = masterPathChange(entity);
  const start = end / (1 + change / 100);
  const count = MINS_PER_DAY * HISTORY_DAYS;
  const points = buildPath(count, start, end, `${entity.id}:series:base:v6:${refreshBucket()}`);

  if (baseMinuteCache.size >= BASE_CACHE_LIMIT) {
    const first = baseMinuteCache.keys().next().value;
    if (first !== undefined) baseMinuteCache.delete(first);
  }
  baseMinuteCache.set(key, points);
  return points;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/** Aggregate close samples into OHLC candles (open = first, close = last). */
function bucketCandles(
  values: number[],
  size: number,
  volumeSeed: string,
  barVolumeBase: number,
): Array<Omit<CandlePoint, "t">> {
  const rand = mulberry(hash(volumeSeed));
  const out: Array<Omit<CandlePoint, "t">> = [];
  const step = Math.max(1, size);

  for (let i = 0; i < values.length; i += step) {
    const slice = values.slice(i, Math.min(i + step, values.length));
    if (!slice.length) break;
    const o = slice[0]!;
    const c = slice[slice.length - 1]!;
    // Wicks stay close to the path high/low — HTS candles, not random spikes.
    const mid = (o + c) / 2;
    const bodySpan = Math.abs(c - o);
    const sampleSpan = Math.max(...slice) - Math.min(...slice);
    const wickPad = Math.max(sampleSpan * 0.06, Math.abs(mid) * 0.0002) * (0.15 + rand() * 0.55);
    const h = Math.max(...slice, o, c) + wickPad;
    const l = Math.min(...slice, o, c) - wickPad;
    const swing = bodySpan + (h - l) * 0.2;
    const intensity = 1 + (swing / Math.max(Math.abs(c), 1)) * 4;
    // Volume correlated but smoothed — avoids spiky “bar chart” silhouettes.
    const v = Math.max(
      1,
      Math.round(barVolumeBase * (0.55 + rand() * 0.55) * (0.85 + intensity * 0.15)),
    );
    out.push({ o: round2(o), h: round2(h), l: round2(l), c: round2(c), v });
  }

  if (out.length && values.length) {
    out[out.length - 1] = {
      ...out[out.length - 1]!,
      c: round2(values[values.length - 1]!),
      h: round2(Math.max(out[out.length - 1]!.h, values[values.length - 1]!)),
      l: round2(Math.min(out[out.length - 1]!.l, values[values.length - 1]!)),
    };
  }
  return out;
}

/** Aggregate already-formed candles (daily → weekly/monthly) keeping true OHLC. */
function bucketFromCandles(
  candles: Array<Omit<CandlePoint, "t">>,
  size: number,
  volumeSeed: string,
  barVolumeBase: number,
): Array<Omit<CandlePoint, "t">> {
  const rand = mulberry(hash(volumeSeed));
  const out: Array<Omit<CandlePoint, "t">> = [];
  const step = Math.max(1, size);
  for (let i = 0; i < candles.length; i += step) {
    const slice = candles.slice(i, Math.min(i + step, candles.length));
    if (!slice.length) break;
    const o = slice[0]!.o;
    const c = slice[slice.length - 1]!.c;
    const h = Math.max(...slice.map((bar) => bar.h));
    const l = Math.min(...slice.map((bar) => bar.l));
    const volSum = slice.reduce((sum, bar) => sum + bar.v, 0);
    const v = Math.max(1, Math.round(volSum || barVolumeBase * (0.5 + rand() * 0.7)));
    out.push({ o: round2(o), h: round2(h), l: round2(l), c: round2(c), v });
  }
  if (out.length && candles.length) {
    const last = candles[candles.length - 1]!;
    out[out.length - 1] = {
      ...out[out.length - 1]!,
      c: last.c,
      h: round2(Math.max(out[out.length - 1]!.h, last.h)),
      l: round2(Math.min(out[out.length - 1]!.l, last.l)),
    };
  }
  return out;
}

function takeLastCandles(
  candles: Array<Omit<CandlePoint, "t">>,
  count: number,
): Array<Omit<CandlePoint, "t">> {
  if (candles.length <= count) return candles;
  return candles.slice(candles.length - count);
}

function kstParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Axis / crosshair label in KST — clock today, `M월D일` when the day changes. */
function labelFor(tf: Timeframe, index: number, count: number, nowMs = Date.now()): string {
  const step = MINUTE_STEP[tf];
  const barsFromEnd = Math.max(0, count - 1 - index);

  if (step) {
    const at = new Date(nowMs - barsFromEnd * step * 60_000);
    const parts = kstParts(at);
    const end = kstParts(new Date(nowMs));
    const clock = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
    const sameDay =
      parts.year === end.year && parts.month === end.month && parts.day === end.day;
    if (sameDay) return clock;
    return `${parts.month}월${parts.day}일 ${clock}`;
  }

  if (tf === "1d") {
    const at = new Date(nowMs - barsFromEnd * 86_400_000);
    const parts = kstParts(at);
    if (barsFromEnd === 0) return "오늘";
    return `${parts.month}월${parts.day}일`;
  }

  if (tf === "1w") {
    const at = new Date(nowMs - barsFromEnd * 7 * 86_400_000);
    const parts = kstParts(at);
    if (barsFromEnd === 0) return "이번주";
    return `${parts.month}월${parts.day}일`;
  }

  const at = new Date(nowMs - barsFromEnd * 30 * 86_400_000);
  const parts = kstParts(at);
  if (barsFromEnd === 0) return "이번달";
  return `${parts.year}년${parts.month}월`;
}

function candlesForTimeframe(
  minutes: number[],
  timeframe: Timeframe,
  volumeSeed: string,
  windowVolume: number,
): CandlePoint[] {
  const step = MINUTE_STEP[timeframe];
  let raw: Array<Omit<CandlePoint, "t">>;

  if (step) {
    const hours = WINDOW_HOURS[timeframe] ?? 12;
    const windowMins = hours * 60;
    const display = Math.max(1, Math.round(windowMins / step));
    const slice = minutes.slice(-windowMins);
    const approxBars = Math.max(1, Math.ceil(slice.length / step));
    const barBase = windowVolume / approxBars;
    raw = takeLastCandles(bucketCandles(slice, step, `${volumeSeed}:${timeframe}`, barBase), display);
  } else {
    const display = DISPLAY_COUNTS[timeframe];
    const daily = bucketCandles(minutes, MINS_PER_DAY, `${volumeSeed}:daily`, windowVolume / HISTORY_DAYS);
    if (timeframe === "1d") {
      raw = takeLastCandles(daily, display);
    } else if (timeframe === "1w") {
      const weekVol = windowVolume / Math.max(1, Math.ceil(daily.length / WEEK_DAYS));
      raw = takeLastCandles(
        bucketFromCandles(daily, WEEK_DAYS, `${volumeSeed}:1w-ohlc`, weekVol),
        display,
      );
    } else {
      const monthVol = windowVolume / Math.max(1, Math.ceil(daily.length / MONTH_DAYS));
      raw = takeLastCandles(
        bucketFromCandles(daily, MONTH_DAYS, `${volumeSeed}:1mo-ohlc`, monthVol),
        display,
      );
    }
  }

  return raw.map((bar, index) => ({
    ...bar,
    t: labelFor(timeframe, index, raw.length),
  }));
}

function metricsCoverAllWindows(metrics?: TimeframeMetrics): boolean {
  if (!metrics) return false;
  return ALL_TIMEFRAMES.every((option) => Number.isFinite(metrics[option.id]?.changeRate));
}

function metricsAreDistinct(metrics?: TimeframeMetrics): boolean {
  if (!metricsCoverAllWindows(metrics)) return false;
  const rates = ALL_TIMEFRAMES.map((option) => metrics?.[option.id]?.changeRate);
  const first = rates[0];
  return rates.some((rate) => rate !== first);
}

/** Pre-HTS synthetics stored a different adjusted score per timeframe. */
function metricsLookLegacySynthetic(entity: RankingEntity): boolean {
  if (!metricsCoverAllWindows(entity.metrics)) return false;
  const buzz = safeBuzz(entity);
  const scores = ALL_TIMEFRAMES.map((option) => entity.metrics?.[option.id]?.buzzScore ?? 0);
  const distinctScores = scores.some((score) => Math.abs(score - (scores[0] ?? 0)) > 0.05);
  const offCurrent = scores.some((score) => Math.abs(score - buzz) > 0.05);
  return distinctScores || offCurrent;
}

export function volumeForTimeframe(entity: RankingEntity, timeframe: Timeframe): number {
  const stored = entity.metrics?.[timeframe]?.volume;
  if (
    metricsAreDistinct(entity.metrics) &&
    !metricsLookLegacySynthetic(entity) &&
    Number.isFinite(stored) &&
    (stored as number) > 0
  ) {
    return stored as number;
  }
  return Math.max(1, Math.round(entity.volume * VOLUME_SCALE[timeframe]));
}

/** Current price — identical across timeframes (HTS quote). */
export function scoreForTimeframe(entity: RankingEntity, _timeframe: Timeframe): number {
  return Number(safeBuzz(entity).toFixed(2));
}

export function heatForTimeframe(entity: RankingEntity, timeframe: Timeframe): number {
  const change = changeForEntity(entity, timeframe);
  const volume = volumeForTimeframe(entity, timeframe);
  return Math.abs(change) * Math.sqrt(Math.max(volume, 1));
}

/**
 * OHLC candles nested from one base 1-minute path:
 * minutes → intraday buckets; minutes → daily → weekly / monthly.
 */
export function getTimeframeCandles(
  entity: RankingEntity,
  timeframe: Timeframe,
): CandlePoint[] {
  const minutes = getBaseMinuteCloses(entity);
  const windowVolume = volumeForTimeframe(entity, timeframe);
  return candlesForTimeframe(
    minutes,
    timeframe,
    `${entity.id}:vol:${refreshBucket()}`,
    windowVolume,
  );
}

/**
 * Line/area path that walks each candle open→wick→close so visible swings
 * match the 시/고/저/종 quote (candle wicks are not collapsed to a flat close).
 */
export function getTimeframeLinePath(
  entity: RankingEntity,
  timeframe: Timeframe,
): number[] {
  const candles = getTimeframeCandles(entity, timeframe);
  if (candles.length < 1) return [];

  const path: number[] = [];
  for (const bar of candles) {
    path.push(bar.o);
    if (bar.c >= bar.o) {
      path.push(bar.l, bar.h, bar.c);
    } else {
      path.push(bar.h, bar.l, bar.c);
    }
  }
  return path;
}

/**
 * Close series for sparklines / compact previews (last price of each candle).
 */
export function getTimeframeSeries(
  entity: RankingEntity,
  timeframe: Timeframe,
): SeriesPoint[] {
  return getTimeframeCandles(entity, timeframe).map((bar) => ({ t: bar.t, v: bar.c }));
}

export function changeForSeries(points: SeriesPoint[]): number {
  const first = points[0]?.v ?? 0;
  const last = points[points.length - 1]?.v ?? first;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return 0;
  return Number((((last - first) / first) * 100).toFixed(2));
}

export function changeForCandles(candles: CandlePoint[]): number {
  const open = candles[0]?.o ?? 0;
  const close = candles[candles.length - 1]?.c ?? open;
  if (!Number.isFinite(open) || !Number.isFinite(close) || open === 0) return 0;
  return Number((((close - open) / open) * 100).toFixed(2));
}

export function seriesOhlc(points: SeriesPoint[]): {
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
} {
  const values = points.map((point) => point.v).filter((value) => Number.isFinite(value));
  const open = values[0] ?? 0;
  const close = values[values.length - 1] ?? open;
  const high = values.length ? Math.max(...values) : open;
  const low = values.length ? Math.min(...values) : open;
  return {
    open: round2(open),
    high: round2(high),
    low: round2(low),
    close: round2(close),
    change: changeForSeries(points),
  };
}

/** Window quote from true candle OHLC (시가 = first open, 현재 = last close). */
export function candlesWindowOhlc(candles: CandlePoint[]): {
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  volume: number;
} {
  if (!candles.length) {
    return { open: 0, high: 0, low: 0, close: 0, change: 0, volume: 0 };
  }
  const open = candles[0]!.o;
  const close = candles[candles.length - 1]!.c;
  const high = Math.max(...candles.map((bar) => bar.h));
  const low = Math.min(...candles.map((bar) => bar.l));
  const volume = candles.reduce((sum, bar) => sum + bar.v, 0);
  return {
    open: round2(open),
    high: round2(high),
    low: round2(low),
    close: round2(close),
    change: changeForCandles(candles),
    volume,
  };
}

export function changeForEntity(entity: RankingEntity, timeframe: Timeframe): number {
  const live = entity.metrics?.[timeframe]?.changeRate;
  if (metricsAreDistinct(entity.metrics) && !metricsLookLegacySynthetic(entity) && Number.isFinite(live)) {
    return live as number;
  }
  // Prefer cheap synthetic rates for lists — never build the 31k path here.
  return lightHorizonChange(entity, timeframe);
}

export function timeframeLabel(id: Timeframe): string {
  return (
    TIMEFRAMES.find((item) => item.id === id)?.label ??
    ALL_TIMEFRAMES.find((item) => item.id === id)?.label ??
    id
  );
}

/** List/heatmap metrics — O(1) per timeframe, no minute-path generation. */
function lightHorizonChange(entity: RankingEntity, timeframe: Timeframe): number {
  const stored = storedChange(entity);
  const spark = sparklineChange(entity);
  const rawBase = stored !== 0 ? stored : spark;
  const base = Math.max(-28, Math.min(28, rawBase));
  const bucket = refreshBucket();
  const rand = mulberry(hash(`${entity.id}:${entity.slug}:${timeframe}:light:${bucket}`));
  const scale = LIGHT_CHANGE_SCALE[timeframe];
  const jitter = (rand() - 0.5) * LIGHT_JITTER[timeframe];
  const wave = Math.sin(
    entity.rank * 0.41 + (hash(`${entity.id}:${bucket}`) % 360) * (Math.PI / 180) + rand() * 0.15,
  );
  const floor = Math.max(Math.abs(base), 3.2);
  const value = base * scale * 0.4 + floor * scale * wave * 0.55 + jitter;
  return Number(Math.max(-89, Math.min(89, value)).toFixed(2));
}

export function buildTimeframeMetrics(entity: RankingEntity): TimeframeMetrics {
  const buzzScore = Number(safeBuzz(entity).toFixed(2));
  const metrics = {} as TimeframeMetrics;
  for (const option of ALL_TIMEFRAMES) {
    const changeRate = lightHorizonChange(entity, option.id);
    metrics[option.id] = {
      buzzScore,
      changeRate,
      volume: Math.max(1, Math.round(entity.volume * VOLUME_SCALE[option.id])),
    };
  }
  return metrics;
}

export function attachTimeframeMetrics(entity: RankingEntity): RankingEntity {
  if (metricsAreDistinct(entity.metrics) && !metricsLookLegacySynthetic(entity)) return entity;
  return { ...entity, metrics: buildTimeframeMetrics(entity) };
}

/** Shared treemap/list sort: heat, then score, then volume, then existing rank. */
export function compareEntitiesForTimeframe(
  a: RankingEntity,
  b: RankingEntity,
  timeframe: Timeframe,
): number {
  const heat = heatForTimeframe(b, timeframe) - heatForTimeframe(a, timeframe);
  if (heat !== 0) return heat;
  const score = scoreForTimeframe(b, timeframe) - scoreForTimeframe(a, timeframe);
  if (score !== 0) return score;
  const volume = volumeForTimeframe(b, timeframe) - volumeForTimeframe(a, timeframe);
  if (volume !== 0) return volume;
  return a.rank - b.rank || a.name.localeCompare(b.name, "ko");
}

export function rankItemsForTimeframe(
  items: RankingEntity[],
  timeframe: Timeframe,
): RankingEntity[] {
  const safe = (Array.isArray(items) ? items : []).filter((item) => item && typeof item.name === "string");
  return [...safe]
    .map((item) => attachTimeframeMetrics({ ...item, sparkline: Array.isArray(item.sparkline) ? item.sparkline : [] }))
    .sort((a, b) => compareEntitiesForTimeframe(a, b, timeframe))
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
  // Legacy ?tf=1m still resolves; UI minimum candle is 3m.
  return ALL_TIMEFRAMES.some((item) => item.id === value) ? (value as Timeframe) : undefined;
}
