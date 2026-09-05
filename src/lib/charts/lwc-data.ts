import type { CandlePoint, Timeframe } from "@/lib/types";
import type { UTCTimestamp } from "lightweight-charts";

const MINUTE_STEP_SEC: Partial<Record<Timeframe, number>> = {
  "1m": 60,
  "3m": 180,
  "5m": 300,
  "10m": 600,
  "30m": 1800,
  "60m": 3600,
  "120m": 7200,
};

export type LwcCandle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type LwcVolume = {
  time: UTCTimestamp;
  value: number;
  color: string;
};

export type LwcArea = {
  time: UTCTimestamp;
  value: number;
};

/** US-style candle colors (up green / down red). */
export const HTS_UP = "#16a34a";
export const HTS_DOWN = "#dc2626";

/** Volume tinted by candle direction (US convention). */
export const VOL_UP = "rgba(22, 163, 74, 0.35)";
export const VOL_DOWN = "rgba(220, 38, 38, 0.32)";
export const VOL_GRAY = "rgba(100, 116, 139, 0.22)";
export const VOL_GRAY_SOFT = "rgba(100, 116, 139, 0.14)";

function stepSeconds(timeframe: Timeframe): number {
  if (MINUTE_STEP_SEC[timeframe]) return MINUTE_STEP_SEC[timeframe]!;
  if (timeframe === "1d") return 86_400;
  if (timeframe === "1w") return 86_400 * 7;
  return 86_400 * 30;
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

/** Format a chart timestamp in Asia/Seoul for the axis / crosshair. */
export function formatKstChartLabel(
  timeSec: number,
  timeframe: Timeframe,
  endSec: number,
): string {
  const parts = kstParts(new Date(timeSec * 1000));
  const end = kstParts(new Date(endSec * 1000));
  const clock = `${pad2(parts.hour)}:${pad2(parts.minute)}`;

  if (MINUTE_STEP_SEC[timeframe]) {
    const sameDay =
      parts.year === end.year && parts.month === end.month && parts.day === end.day;
    if (sameDay) return clock;
    return `${parts.month}월${parts.day}일 ${clock}`;
  }

  if (timeframe === "1d") {
    const sameDay =
      parts.year === end.year && parts.month === end.month && parts.day === end.day;
    if (sameDay) return "오늘";
    return `${parts.month}월${parts.day}일`;
  }

  if (timeframe === "1w") {
    return `${parts.month}월${parts.day}일`;
  }

  return `${parts.year}년${parts.month}월`;
}

function uniqueAscendingTimes(
  count: number,
  start: number,
  end: number,
): UTCTimestamp[] {
  if (count <= 1) return [start as UTCTimestamp];
  const times: number[] = [];
  for (let i = 0; i < count; i += 1) {
    let t = Math.round(start + ((end - start) * i) / (count - 1));
    if (times.length && t <= times[times.length - 1]!) {
      t = times[times.length - 1]! + 1;
    }
    times.push(t);
  }
  return times as UTCTimestamp[];
}

/**
 * Map synthetic candles onto ascending UTC seconds so Lightweight Charts
 * can render them with TradingView-style scales / crosshair / volume pane.
 *
 * @param linePath - denser closes for the area/line series (preferred).
 */
export function toLwcSeries(
  candles: CandlePoint[],
  timeframe: Timeframe,
  linePath?: number[],
): {
  ohlc: LwcCandle[];
  volume: LwcVolume[];
  area: LwcArea[];
  labelByTime: Map<number, string>;
  priceMin: number;
  priceMax: number;
} {
  const step = stepSeconds(timeframe);
  const end = Math.floor(Date.now() / 1000);
  const start = end - Math.max(candles.length - 1, 0) * step;
  const labelByTime = new Map<number, string>();
  const maxVol = Math.max(...candles.map((bar) => bar.v), 1);

  const ohlc: LwcCandle[] = [];
  const volume: LwcVolume[] = [];

  candles.forEach((bar, index) => {
    const time = (start + index * step) as UTCTimestamp;
    labelByTime.set(time as number, formatKstChartLabel(time as number, timeframe, end));
    ohlc.push({
      time,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
    });
    const hot = bar.v / maxVol > 0.72;
    const up = bar.c >= bar.o;
    volume.push({
      time,
      value: Math.max(1, bar.v),
      color: up ? (hot ? VOL_UP : "rgba(22, 163, 74, 0.22)") : hot ? VOL_DOWN : "rgba(220, 38, 38, 0.2)",
    });
  });

  const path =
    linePath && linePath.length >= 2 ? linePath : candles.map((bar) => bar.c);
  const areaTimes = uniqueAscendingTimes(path.length, start, start + Math.max(candles.length - 1, 0) * step);
  const area: LwcArea[] = path.map((value, index) => ({
    time: areaTimes[index]!,
    value,
  }));

  // Label a few area points from nearest candle labels for the crosshair.
  area.forEach((point, index) => {
    if (labelByTime.has(point.time as number)) return;
    labelByTime.set(
      point.time as number,
      formatKstChartLabel(point.time as number, timeframe, end),
    );
  });

  const highs = candles.map((bar) => bar.h);
  const lows = candles.map((bar) => bar.l);
  const priceMin = Math.min(...lows, ...path);
  const priceMax = Math.max(...highs, ...path);

  return { ohlc, volume, area, labelByTime, priceMin, priceMax };
}

export function priceAutoscaleProvider(minValue: number, maxValue: number) {
  const span = Math.max(maxValue - minValue, Math.abs(maxValue) * 0.01, 0.6);
  const pad = span * 0.1;
  const lo = minValue - pad;
  const hi = maxValue + pad;
  // LWC AreaSeries defaults to including 0 — always override that range.
  return (_original?: () => { priceRange: { minValue: number; maxValue: number } | null } | null) => ({
    priceRange: {
      minValue: lo,
      maxValue: hi,
    },
    margins: {
      above: 6,
      below: 6,
    },
  });
}

export function priceVisibleRange(minValue: number, maxValue: number): { from: number; to: number } {
  const span = Math.max(maxValue - minValue, Math.abs(maxValue) * 0.01, 0.6);
  const pad = span * 0.1;
  return { from: minValue - pad, to: maxValue + pad };
}

export function formatLwcTime(time: unknown, labelByTime: Map<number, string>): string {
  if (typeof time === "number") {
    return labelByTime.get(time) ?? "";
  }
  if (time && typeof time === "object" && "timestamp" in (time as object)) {
    const ts = Number((time as { timestamp: number }).timestamp);
    return labelByTime.get(ts) ?? "";
  }
  return "";
}
