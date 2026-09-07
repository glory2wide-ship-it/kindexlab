import { decodeBody } from "@/lib/ingestion/decode";
import { fetchBuffer, fetchJson } from "@/lib/ingestion/http";
import {
  stockSymbolForName,
  type StockMarket,
  type StockSymbol,
} from "@/lib/market/stock-codes";

export { formatStockPrice, isNaverStockMeasurement, NAVER_FINANCE_SOURCE } from "@/lib/market/naver-finance-format";

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
}

interface CacheEntry {
  at: number;
  quote: StockQuote;
}

const QUOTE_TTL_MS = 60_000;
const quoteCache = new Map<string, CacheEntry>();

function cacheKey(symbol: StockSymbol): string {
  return `${symbol.market}:${symbol.code}`;
}

function parseNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

async function fetchKrQuotes(codes: string[]): Promise<Map<string, StockQuote>> {
  const out = new Map<string, StockQuote>();
  const unique = [...new Set(codes.filter(Boolean))];
  if (!unique.length) return out;

  const query = unique.map((code) => `SERVICE_ITEM:${code}`).join(",");
  const url = `https://polling.finance.naver.com/api/realtime?query=${encodeURIComponent(query)}`;
  const { status, contentType, buffer } = await fetchBuffer(url, {
    headers: { Accept: "application/json,text/plain,*/*" },
  });
  if (status >= 400) return out;

  const text = decodeBody(buffer, contentType || "application/json; charset=euc-kr");

  let payload: {
    result?: {
      areas?: { datas?: Record<string, unknown>[] }[];
    };
  };
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    return out;
  }

  const observedAt = new Date().toISOString();
  for (const area of payload.result?.areas ?? []) {
    for (const row of area.datas ?? []) {
      const code = String(row.cd ?? "");
      const price = parseNumber(row.nv);
      const changeRate = parseNumber(row.cr);
      if (!code || price == null || changeRate == null) continue;
      out.set(code, {
        name: String(row.nm ?? code),
        market: "kr",
        code,
        price,
        changeRate,
        currency: "KRW",
        observedAt,
      });
    }
  }
  return out;
}

async function fetchUsQuote(code: string): Promise<StockQuote | null> {
  const url = `https://api.stock.naver.com/stock/${encodeURIComponent(code)}/basic`;
  try {
    const data = await fetchJson<Record<string, unknown>>(url, {
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
 * Fetch Naver Finance quotes for display names. Cached ~60s so heatmap
 * refreshes stay cheap while still tracking market moves.
 */
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
