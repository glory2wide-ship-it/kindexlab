import { decodeBody } from "@/lib/ingestion/decode";
import { fetchBuffer } from "@/lib/ingestion/http";
import {
  marketIndexSymbolForName,
  type MarketIndexSymbol,
} from "@/lib/market/market-index-codes";
import { NAVER_FINANCE_SOURCE } from "@/lib/market/naver-finance-format";

export interface MarketIndexQuote {
  name: string;
  category: MarketIndexSymbol["category"];
  code: string;
  price: number;
  changeRate: number;
  /** Display unit from Naver, e.g. KRW, USD/BBL, 원/g */
  unit: string;
  observedAt: string;
}

interface CacheEntry {
  at: number;
  quote: MarketIndexQuote;
}

const QUOTE_TTL_MS = 180_000;
const quoteCache = new Map<string, CacheEntry>();

function cacheKey(symbol: MarketIndexSymbol): string {
  return `${symbol.category}:${symbol.code}`;
}

function parseNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function pickInfo(payload: Record<string, unknown>): Record<string, unknown> | null {
  for (const key of [
    "result",
    "exchangeInfo",
    "energyInfo",
    "metalsInfo",
    "agriculturalInfo",
    "marketIndexInfo",
  ]) {
    const value = payload[key];
    if (value && typeof value === "object") return value as Record<string, unknown>;
  }
  if (payload.closePrice != null || payload.closePriceRaw != null) return payload;
  return null;
}

async function fetchMarketIndexQuote(symbol: MarketIndexSymbol): Promise<MarketIndexQuote | null> {
  const url = `https://api.stock.naver.com/marketindex/${symbol.category}/${encodeURIComponent(symbol.code)}`;
  const { status, contentType, buffer } = await fetchBuffer(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });
  if (status >= 400) return null;

  const text = decodeBody(buffer, contentType || "application/json; charset=utf-8");
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }

  const info = pickInfo(payload);
  if (!info) return null;

  const price = parseNumber(info.closePriceRaw) ?? parseNumber(info.closePrice);
  const changeRate =
    parseNumber(info.fluctuationsRatioRaw) ?? parseNumber(info.fluctuationsRatio);
  if (price == null || changeRate == null) return null;

  const unitRaw = String(info.unit ?? "").trim();
  const unit =
    unitRaw ||
    (symbol.category === "exchange" && symbol.code.startsWith("FX_") ? "KRW" : "USD");

  return {
    name: String(info.name ?? info.stockName ?? symbol.code),
    category: symbol.category,
    code: symbol.code,
    price,
    changeRate,
    unit,
    observedAt: new Date().toISOString(),
  };
}

/**
 * Fetch Naver marketindex quotes for FX / energy / metals / ag names.
 * Cached ~3m to match heatmap refresh.
 */
export async function fetchNaverMarketIndexQuotesForNames(
  names: string[],
): Promise<Map<string, MarketIndexQuote>> {
  const byName = new Map<string, MarketIndexQuote>();
  const now = Date.now();
  const pending: { name: string; symbol: MarketIndexSymbol }[] = [];

  for (const name of names) {
    const symbol = marketIndexSymbolForName(name);
    if (!symbol) continue;
    const key = cacheKey(symbol);
    const hit = quoteCache.get(key);
    if (hit && now - hit.at < QUOTE_TTL_MS) {
      byName.set(name, hit.quote);
      continue;
    }
    pending.push({ name, symbol });
  }

  if (!pending.length) return byName;

  const settled = await Promise.all(
    pending.map(async (item) => ({
      item,
      quote: await fetchMarketIndexQuote(item.symbol),
    })),
  );

  for (const { item, quote } of settled) {
    if (!quote) continue;
    quoteCache.set(cacheKey(item.symbol), { at: now, quote });
    byName.set(item.name, quote);
  }

  return byName;
}

export function formatMarketIndexPrice(quote: Pick<MarketIndexQuote, "price" | "unit">): string {
  const unit = quote.unit.trim();
  const price = quote.price;

  if (unit === "KRW" || unit === "원") {
    if (Number.isInteger(price)) {
      return `${Math.round(price).toLocaleString("ko-KR")}원`;
    }
    return `${price.toLocaleString("ko-KR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}원`;
  }

  if (unit === "원/g") {
    return `${Math.round(price).toLocaleString("ko-KR")}원/g`;
  }

  if (unit === "USD" || unit.startsWith("USD")) {
    const money = `$${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: price >= 100 ? 2 : 4,
    })}`;
    return unit === "USD" ? money : `${money}`;
  }

  if (unit.startsWith("USc")) {
    return `${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}¢`;
  }

  return `${price.toLocaleString("en-US", {
    maximumFractionDigits: 4,
  })} ${unit}`.trim();
}

export { NAVER_FINANCE_SOURCE };
