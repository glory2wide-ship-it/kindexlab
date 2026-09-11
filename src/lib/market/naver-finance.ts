import { decodeBody } from "@/lib/ingestion/decode";
import { fetchBuffer, fetchJson } from "@/lib/ingestion/http";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import {
  stockSymbolForName,
  type StockMarket,
  type StockSymbol,
} from "@/lib/market/stock-codes";

export { formatStockPrice, isNaverStockMeasurement, NAVER_FINANCE_SOURCE } from "@/lib/market/naver-finance-format";

/** ISR-safe fetch — must not use no-store on page renders. */
const QUOTE_FETCH = { next: { revalidate: DEFAULT_TRENDS_REVALIDATE_SEC } } as const;

export interface StockQuote {
  name: string;
  market: StockMarket;
  code: string;
  /** Last traded price in market currency. */
  price: number;
  /** Day change vs previous close, percent. */
  changeRate: number;
  currency: "KRW" | "USD";
  observedAt: string;
  /** Naver integration extras (KR domestic stocks). */
  marketCap?: string;
  high52Week?: string;
  low52Week?: string;
}

export interface StockFundamentals {
  marketCap?: string;
  high52Week?: string;
  low52Week?: string;
}

interface CacheEntry {
  at: number;
  quote: StockQuote;
}

interface FundamentalsCacheEntry {
  at: number;
  fundamentals: StockFundamentals;
}

/** Align with heatmap client refresh (DEFAULT_TRENDS_REVALIDATE_SEC = 180). */
const QUOTE_TTL_MS = 180_000;
const quoteCache = new Map<string, CacheEntry>();
const fundamentalsCache = new Map<string, FundamentalsCacheEntry>();

function cacheKey(symbol: StockSymbol): string {
  return `${symbol.market}:${symbol.code}`;
}

function parseNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function formatKrPriceLabel(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const cleaned = raw.replace(/원/g, "").trim();
  if (!cleaned) return undefined;
  return `${cleaned}원`;
}

/**
 * Market cap + 52-week range from Naver mobile stock integration (KR only).
 */
export async function fetchKrStockFundamentals(code: string): Promise<StockFundamentals | null> {
  const key = `kr:${code}`;
  const hit = fundamentalsCache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < QUOTE_TTL_MS) return hit.fundamentals;

  try {
    const data = await fetchJson<{
      totalInfos?: Array<{ code?: string; key?: string; value?: string }>;
    }>(`https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/integration`, {
      ...QUOTE_FETCH,
      headers: { Accept: "application/json" },
    });
    const infos = data.totalInfos ?? [];
    const pick = (field: string) =>
      infos.find((row) => row.code === field)?.value?.trim() || undefined;
    const fundamentals: StockFundamentals = {
      marketCap: pick("marketValue"),
      high52Week: formatKrPriceLabel(pick("highPriceOf52Weeks")),
      low52Week: formatKrPriceLabel(pick("lowPriceOf52Weeks")),
    };
    if (!fundamentals.marketCap && !fundamentals.high52Week && !fundamentals.low52Week) {
      return null;
    }
    fundamentalsCache.set(key, { at: now, fundamentals });
    return fundamentals;
  } catch {
    return null;
  }
}

export function peekKrStockFundamentals(code: string): StockFundamentals | undefined {
  const hit = fundamentalsCache.get(`kr:${code}`);
  if (!hit) return undefined;
  if (Date.now() - hit.at >= QUOTE_TTL_MS) return undefined;
  return hit.fundamentals;
}

/** Attach fundamentals onto a cached/live KR quote when available. */
export async function withKrStockFundamentals(quote: StockQuote): Promise<StockQuote> {
  if (quote.market !== "kr") return quote;
  if (quote.marketCap || quote.high52Week || quote.low52Week) return quote;
  const fundamentals = await fetchKrStockFundamentals(quote.code);
  if (!fundamentals) return quote;
  const next = { ...quote, ...fundamentals };
  const key = cacheKey({ market: "kr", code: quote.code });
  const cached = quoteCache.get(key);
  if (cached) quoteCache.set(key, { at: cached.at, quote: next });
  return next;
}

async function fetchKrQuotes(codes: string[]): Promise<Map<string, StockQuote>> {
  const out = new Map<string, StockQuote>();
  const unique = [...new Set(codes.filter(Boolean))];
  if (!unique.length) return out;

  // Batch endpoint returns every code; the older `?query=SERVICE_ITEM:…` path
  // only echoed the first item when several were comma-joined.
  const url = `https://polling.finance.naver.com/api/realtime/domestic/stock/${unique.join(",")}`;
  const { status, contentType, buffer } = await fetchBuffer(url, {
    ...QUOTE_FETCH,
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent": "Mozilla/5.0",
    },
  });
  if (status >= 400) return out;

  const text = decodeBody(buffer, contentType || "application/json; charset=utf-8");

  let payload: {
    datas?: Record<string, unknown>[];
  };
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    return out;
  }

  const observedAt = new Date().toISOString();
  for (const row of payload.datas ?? []) {
    const code = String(row.itemCode ?? row.symbolCode ?? "");
    const price =
      parseNumber(row.closePriceRaw) ??
      parseNumber(row.closePrice) ??
      parseNumber(row.lastSalePrice);
    const changeRate =
      parseNumber(row.fluctuationsRatioRaw) ?? parseNumber(row.fluctuationsRatio);
    if (!code || price == null || changeRate == null) continue;
    out.set(code, {
      name: String(row.stockName ?? code),
      market: "kr",
      code,
      price,
      changeRate,
      currency: "KRW",
      observedAt,
    });
  }
  return out;
}

async function fetchUsQuote(code: string): Promise<StockQuote | null> {
  const url = `https://api.stock.naver.com/stock/${encodeURIComponent(code)}/basic`;
  try {
    const data = await fetchJson<Record<string, unknown>>(url, {
      ...QUOTE_FETCH,
      headers: { Accept: "application/json" },
    });
    const price = parseNumber(data.closePrice);
    const changeRate = parseNumber(data.fluctuationsRatio);
    if (price == null || changeRate == null) return null;
    return {
      name: String(data.stockName ?? code),
      market: "us",
      code,
      price,
      changeRate,
      currency: "USD",
      observedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch Naver Finance quotes for display names. Cached ~3m so heatmap
 * refreshes stay cheap while still tracking market moves.
 */
export function peekNaverQuoteForName(name: string): StockQuote | undefined {
  const symbol = stockSymbolForName(name);
  if (!symbol) return undefined;
  const hit = quoteCache.get(cacheKey(symbol));
  if (!hit) return undefined;
  if (Date.now() - hit.at >= QUOTE_TTL_MS) return undefined;
  return hit.quote;
}

export async function fetchNaverQuotesForNames(names: string[]): Promise<Map<string, StockQuote>> {
  const byName = new Map<string, StockQuote>();
  const now = Date.now();
  const pendingKr: { name: string; code: string }[] = [];
  const pendingUs: { name: string; code: string }[] = [];

  for (const name of names) {
    const symbol = stockSymbolForName(name);
    if (!symbol) continue;
    const key = cacheKey(symbol);
    const hit = quoteCache.get(key);
    if (hit && now - hit.at < QUOTE_TTL_MS) {
      byName.set(name, hit.quote);
      continue;
    }
    if (symbol.market === "kr") pendingKr.push({ name, code: symbol.code });
    else pendingUs.push({ name, code: symbol.code });
  }

  if (pendingKr.length) {
    const kr = await fetchKrQuotes(pendingKr.map((item) => item.code));
    for (const item of pendingKr) {
      const quote = kr.get(item.code);
      if (!quote) continue;
      quoteCache.set(cacheKey({ market: "kr", code: item.code }), { at: now, quote });
      byName.set(item.name, quote);
    }
  }

  if (pendingUs.length) {
    const settled = await Promise.all(
      pendingUs.map(async (item) => ({ item, quote: await fetchUsQuote(item.code) })),
    );
    for (const { item, quote } of settled) {
      if (!quote) continue;
      quoteCache.set(cacheKey({ market: "us", code: item.code }), { at: now, quote });
      byName.set(item.name, quote);
    }
  }

  return byName;
}
