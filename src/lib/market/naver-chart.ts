import { decodeBody } from "@/lib/ingestion/decode";
import { fetchBuffer, fetchJson } from "@/lib/ingestion/http";
import {
  marketIndexSymbolForName,
  type MarketIndexCategory,
  type MarketIndexSymbol,
} from "@/lib/market/market-index-codes";
import {
  isCommoditiesFxEntity,
  isKospiStockEntity,
  isOverseasStockEntity,
} from "@/lib/market/kospi-quotes";
import { stockSymbolForName, type StockSymbol } from "@/lib/market/stock-codes";
import type { CandlePoint, RankingEntity, Timeframe } from "@/lib/types";

export type MarketChartInstrument =
  | {
      kind: "stock";
      market: StockSymbol["market"];
      code: string;
      name: string;
      unit: "원" | "USD";
    }
  | {
      kind: "index";
      category: MarketIndexCategory;
      code: string;
      name: string;
      unit: string;
    };

export interface MarketChartPayload {
  instrument: MarketChartInstrument;
  timeframe: Timeframe;
  candles: CandlePoint[];
  unit: string;
  source: string;
}

function parseNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function kstStampToUnix(stamp: string): number {
  const s = stamp.replace(/\D/g, "");
  if (s.length >= 14) {
    const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}+09:00`;
    return Math.floor(Date.parse(iso) / 1000);
  }
  if (s.length >= 12) {
    const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:00+09:00`;
    return Math.floor(Date.parse(iso) / 1000);
  }
  if (s.length >= 8) {
    const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00+09:00`;
    return Math.floor(Date.parse(iso) / 1000);
  }
  return Math.floor(Date.now() / 1000);
}

function toCandle(input: {
  t: string | number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}): CandlePoint {
  const t =
    typeof input.t === "number"
      ? String(Math.floor(input.t))
      : /^\d{10,13}$/.test(input.t)
        ? input.t
        : String(kstStampToUnix(input.t));
  return {
    t,
    o: input.o,
    h: input.h,
    l: input.l,
    c: input.c,
    v: Math.max(0, input.v ?? 0),
  };
}

function ensureAscending(candles: CandlePoint[]): CandlePoint[] {
  const sorted = [...candles].sort((a, b) => Number(a.t) - Number(b.t));
  const out: CandlePoint[] = [];
  for (const bar of sorted) {
    const time = Number(bar.t);
    if (!Number.isFinite(time)) continue;
    if (out.length && time <= Number(out[out.length - 1]!.t)) {
      out.push({ ...bar, t: String(Number(out[out.length - 1]!.t) + 1) });
    } else {
      out.push(bar);
    }
  }
  return out;
}

function resampleMinutes(bars: CandlePoint[], bucketMinutes: number): CandlePoint[] {
  if (bucketMinutes <= 1) return bars;
  const bucketSec = bucketMinutes * 60;
  const groups = new Map<number, CandlePoint[]>();
  for (const bar of bars) {
    const key = Math.floor(Number(bar.t) / bucketSec) * bucketSec;
    const list = groups.get(key) ?? [];
    list.push(bar);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, list]) => {
      const first = list[0]!;
      const last = list[list.length - 1]!;
      return toCandle({
        t: key,
        o: first.o,
        h: Math.max(...list.map((item) => item.h)),
        l: Math.min(...list.map((item) => item.l)),
        c: last.c,
        v: list.reduce((sum, item) => sum + item.v, 0),
      });
    });
}

function minuteBucket(timeframe: Timeframe): number | null {
  if (timeframe === "3m") return 3;
  if (timeframe === "5m") return 5;
  if (timeframe === "10m") return 10;
  if (timeframe === "30m") return 30;
  if (timeframe === "60m") return 60;
  if (timeframe === "1m") return 1;
  return null;
}

function parseFchart(text: string): CandlePoint[] {
  const rows = [
    ...text.matchAll(
      /\["(\d+)",\s*([\d.]+|null),\s*([\d.]+|null),\s*([\d.]+|null),\s*([\d.]+|null),\s*([\d.]+|null)/g,
    ),
  ];
  return ensureAscending(
    rows
      .map((match) => {
        const c = parseNumber(match[5]);
        if (c == null) return null;
        const o = parseNumber(match[2]) ?? c;
        const h = parseNumber(match[3]) ?? Math.max(o, c);
        const l = parseNumber(match[4]) ?? Math.min(o, c);
        const v = parseNumber(match[6]) ?? 0;
        return toCandle({ t: match[1]!, o, h, l, c, v });
      })
      .filter((row): row is CandlePoint => Boolean(row)),
  );
}

async function fetchKrMinutes(code: string, count = 400): Promise<CandlePoint[]> {
  const url = `https://api.stock.naver.com/chart/domestic/item/${encodeURIComponent(code)}/minute?range=1&count=${count}`;
  const rows = await fetchJson<Record<string, unknown>[]>(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
  }).catch(() => []);
  if (!Array.isArray(rows)) return [];
  return ensureAscending(
    rows
      .map((row) => {
        const stamp = String(row.localDateTime ?? "");
        const c = parseNumber(row.currentPrice) ?? parseNumber(row.closePrice);
        if (!stamp || c == null) return null;
        const o = parseNumber(row.openPrice) ?? c;
        const h = parseNumber(row.highPrice) ?? Math.max(o, c);
        const l = parseNumber(row.lowPrice) ?? Math.min(o, c);
        const v = parseNumber(row.accumulatedTradingVolume) ?? 0;
        return toCandle({ t: stamp, o, h, l, c, v });
      })
      .filter((row): row is CandlePoint => Boolean(row)),
  );
}

async function fetchKrFchart(code: string, timeframe: "day" | "week" | "month"): Promise<CandlePoint[]> {
  const url = `https://fchart.stock.naver.com/siseJson.naver?symbol=${encodeURIComponent(code)}&requestType=0&timeframe=${timeframe}&count=120&startTime=&endTime=`;
  const { status, contentType, buffer } = await fetchBuffer(url, {
    headers: { Accept: "text/plain,*/*", "User-Agent": "Mozilla/5.0" },
  });
  if (status >= 400) return [];
  const text = decodeBody(buffer, contentType || "text/plain; charset=euc-kr");
  return parseFchart(text);
}

async function fetchUsDailyPages(code: string, pages = 4, pageSize = 40): Promise<CandlePoint[]> {
  const out: CandlePoint[] = [];
  for (let page = 1; page <= pages; page += 1) {
    const url = `https://api.stock.naver.com/stock/${encodeURIComponent(code)}/price?page=${page}&pageSize=${pageSize}`;
    const rows = await fetchJson<Record<string, unknown>[]>(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    }).catch(() => null);
    if (!Array.isArray(rows) || !rows.length) break;
    for (const row of rows) {
      const c = parseNumber(row.closePrice);
      if (c == null) continue;
      const o = parseNumber(row.openPrice) ?? c;
      const h = parseNumber(row.highPrice) ?? Math.max(o, c);
      const l = parseNumber(row.lowPrice) ?? Math.min(o, c);
      const traded = String(row.localTradedAt ?? "");
      const unix = traded ? Math.floor(Date.parse(traded) / 1000) : Date.now() / 1000;
      out.push(
        toCandle({
          t: Math.floor(unix),
          o,
          h,
          l,
          c,
          v: parseNumber(row.accumulatedTradingVolume) ?? 0,
        }),
      );
    }
    if (rows.length < pageSize) break;
  }
  return ensureAscending(out);
}

async function fetchUsMinutes(code: string, count = 200): Promise<CandlePoint[]> {
  const url = `https://api.stock.naver.com/chart/foreign/item/${encodeURIComponent(code)}/minute?range=1&count=${count}`;
  const rows = await fetchJson<Record<string, unknown>[]>(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
  }).catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return [];
  return ensureAscending(
    rows
      .map((row) => {
        const stamp = String(row.localDateTime ?? row.localDate ?? "");
        const c = parseNumber(row.currentPrice) ?? parseNumber(row.closePrice);
        if (!stamp || c == null) return null;
        const o = parseNumber(row.openPrice) ?? c;
        const h = parseNumber(row.highPrice) ?? Math.max(o, c);
        const l = parseNumber(row.lowPrice) ?? Math.min(o, c);
        return toCandle({
          t: stamp,
          o,
          h,
          l,
          c,
          v: parseNumber(row.accumulatedTradingVolume) ?? 0,
        });
      })
      .filter((row): row is CandlePoint => Boolean(row)),
  );
}

function aggregateDaily(
  daily: CandlePoint[],
  bucketDays: number,
): CandlePoint[] {
  if (bucketDays <= 1) return daily;
  const groups = new Map<number, CandlePoint[]>();
  for (const bar of daily) {
    const day = Math.floor(Number(bar.t) / 86_400);
    const key = Math.floor(day / bucketDays) * bucketDays * 86_400;
    const list = groups.get(key) ?? [];
    list.push(bar);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, list]) => {
      const first = list[0]!;
      const last = list[list.length - 1]!;
      return toCandle({
        t: key,
        o: first.o,
        h: Math.max(...list.map((item) => item.h)),
        l: Math.min(...list.map((item) => item.l)),
        c: last.c,
        v: list.reduce((sum, item) => sum + item.v, 0),
      });
    });
}

async function fetchIndexHistory(
  symbol: MarketIndexSymbol,
  maxBars = 90,
): Promise<CandlePoint[]> {
  const pageSize = 60;
  const pages = Math.max(1, Math.ceil(maxBars / pageSize));
  const out: CandlePoint[] = [];

  for (let page = 1; page <= pages; page += 1) {
    const url = `https://m.stock.naver.com/front-api/marketIndex/prices?category=${symbol.category}&reutersCode=${encodeURIComponent(symbol.code)}&page=${page}&pageSize=${pageSize}`;
    const { status, contentType, buffer } = await fetchBuffer(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    });
    if (status >= 400) break;
    const text = decodeBody(buffer, contentType || "application/json; charset=utf-8");
    let payload: { result?: Record<string, unknown>[] };
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      break;
    }
    const rows = payload.result;
    if (!Array.isArray(rows) || !rows.length) break;

    for (const row of rows) {
      const c = parseNumber(row.closePrice);
      if (c == null) continue;
      const o = parseNumber(row.openPrice) ?? c;
      const h = parseNumber(row.highPrice) ?? Math.max(o, c);
      const l = parseNumber(row.lowPrice) ?? Math.min(o, c);
      const traded = String(row.localTradedAt ?? "");
      const unix = traded.includes("T")
        ? Math.floor(Date.parse(traded) / 1000)
        : kstStampToUnix(traded.replace(/-/g, ""));
      if (!Number.isFinite(unix)) continue;
      out.push(toCandle({ t: Math.floor(unix), o, h, l, c, v: 0 }));
    }
    if (rows.length < pageSize) break;
  }

  return ensureAscending(out);
}

export function resolveMarketChartInstrument(
  entity: Pick<RankingEntity, "name" | "slug" | "heatmapGroup" | "measurement">,
): MarketChartInstrument | null {
  if (isKospiStockEntity(entity) || isOverseasStockEntity(entity)) {
    const symbol = stockSymbolForName(entity.name);
    if (!symbol) return null;
    return {
      kind: "stock",
      market: symbol.market,
      code: symbol.code,
      name: entity.name,
      unit: symbol.market === "us" ? "USD" : "원",
    };
  }
  if (isCommoditiesFxEntity(entity)) {
    const symbol = marketIndexSymbolForName(entity.name);
    if (!symbol) return null;
    const unit =
      entity.measurement?.unit && entity.measurement.source === "네이버금융"
        ? entity.measurement.unit
        : symbol.category === "exchange" && symbol.code.startsWith("FX_")
          ? "원"
          : "USD";
    return {
      kind: "index",
      category: symbol.category,
      code: symbol.code,
      name: entity.name,
      unit,
    };
  }
  return null;
}

export function isMarketChartEntity(
  entity: Pick<RankingEntity, "slug" | "heatmapGroup">,
): boolean {
  return (
    isKospiStockEntity(entity) ||
    isOverseasStockEntity(entity) ||
    isCommoditiesFxEntity(entity)
  );
}

async function candlesForStock(
  instrument: Extract<MarketChartInstrument, { kind: "stock" }>,
  timeframe: Timeframe,
): Promise<CandlePoint[]> {
  const bucket = minuteBucket(timeframe);

  if (instrument.market === "kr") {
    if (bucket != null) {
      const minutes = await fetchKrMinutes(instrument.code, Math.min(480, bucket * 120));
      return resampleMinutes(minutes, bucket);
    }
    if (timeframe === "1d") return fetchKrFchart(instrument.code, "day");
    if (timeframe === "1w") return fetchKrFchart(instrument.code, "week");
    if (timeframe === "1mo") return fetchKrFchart(instrument.code, "month");
    return fetchKrFchart(instrument.code, "day");
  }

  // US / overseas
  if (bucket != null) {
    const minutes = await fetchUsMinutes(instrument.code, Math.min(400, bucket * 100));
    if (minutes.length >= 8) return resampleMinutes(minutes, bucket);
    // Outside US hours the minute feed is often empty — fall back to daily.
    return fetchUsDailyPages(instrument.code, 3, 40);
  }
  const daily = await fetchUsDailyPages(instrument.code, timeframe === "1mo" ? 8 : 5, 40);
  if (timeframe === "1w") return aggregateDaily(daily, 5);
  if (timeframe === "1mo") return aggregateDaily(daily, 21);
  return daily;
}

async function candlesForIndex(
  instrument: Extract<MarketChartInstrument, { kind: "index" }>,
  timeframe: Timeframe,
): Promise<CandlePoint[]> {
  const history = await fetchIndexHistory(
    { category: instrument.category, code: instrument.code },
    timeframe === "1mo" ? 180 : 120,
  );
  if (!history.length) return [];
  if (timeframe === "1w") return aggregateDaily(history, 5);
  if (timeframe === "1mo") return aggregateDaily(history, 21);
  // Intraday history is not published for marketindex — show daily series.
  return history;
}

export async function fetchMarketChartCandles(
  instrument: MarketChartInstrument,
  timeframe: Timeframe,
): Promise<CandlePoint[]> {
  const candles =
    instrument.kind === "stock"
      ? await candlesForStock(instrument, timeframe)
      : await candlesForIndex(instrument, timeframe);
  return ensureAscending(candles).slice(-180);
}

export function chartPricePrecision(unit: string): number {
  if (unit === "원" || unit === "KRW") return 2;
  if (unit === "원/g") return 0;
  if (unit.startsWith("USc")) return 2;
  if (unit.startsWith("USD")) return unit.includes("/") ? 2 : 2;
  return 2;
}
