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

const LIST_PAGE_URLS = [
  "https://m.stock.naver.com/marketindex/home/metals",
  "https://m.stock.naver.com/marketindex/home/energy",
  "https://m.stock.naver.com/marketindex/home/agricultural",
] as const;

const LIST_NAME_ALIASES: Record<string, string[]> = {
  알루미늄: ["알루미늄 합금", "알루미늄"],
  철광석: ["철광석"],
  니켈: ["니켈"],
  주석: ["주석"],
  아연: ["아연"],
  납: ["납"],
  팔라듐: ["팔라듐"],
  석탄: ["석탄"],
  팜유: ["팜유"],
};

let listCache: { at: number; byName: Map<string, MarketIndexQuote> } | null = null;

function matchListName(name: string, byName: Map<string, MarketIndexQuote>): MarketIndexQuote | undefined {
  const spaced = name.trim().replace(/\s+/g, " ");
  const compact = spaced.replace(/\s+/g, "");
  const direct = byName.get(spaced) ?? byName.get(compact) ?? byName.get(name.trim());
  if (direct) return direct;
  for (const [key, aliases] of Object.entries(LIST_NAME_ALIASES)) {
    if (spaced === key || compact === key || spaced.includes(key)) {
      for (const alias of aliases) {
        const hit = byName.get(alias);
        if (hit) return hit;
      }
    }
  }
  for (const [listed, quote] of byName) {
    if (listed.includes(spaced) || spaced.includes(listed)) return quote;
  }
  return undefined;
}

async function loadListPageQuotes(): Promise<Map<string, MarketIndexQuote>> {
  const now = Date.now();
  if (listCache && now - listCache.at < QUOTE_TTL_MS) return listCache.byName;

  const byName = new Map<string, MarketIndexQuote>();
  const observedAt = new Date().toISOString();

  await Promise.all(
    LIST_PAGE_URLS.map(async (url) => {
      const { status, contentType, buffer } = await fetchBuffer(url, {
        headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" },
      });
      if (status >= 400) return;
      const html = decodeBody(buffer, contentType || "text/html; charset=utf-8");
      const chunks = html.split(/Table_name__[^>]*>/);
      for (const chunk of chunks.slice(1)) {
        const listed = chunk.match(/^([^<]+)/)?.[1]?.trim();
        if (!listed) continue;
        const price = parseNumber(chunk.match(/<\/td><td>([0-9,.]+)/)?.[1]);
        const changeRate =
          parseNumber(chunk.match(/([+\-]?\d+(?:\.\d+)?)<!-- -->%/)?.[1]) ??
          parseNumber(chunk.match(/>([+\-]?\d+(?:\.\d+)?)<span class="per">%/)?.[1]);
        const unitMatch = chunk.match(
          /Table_unit__[^>]*>[\s\S]*?((?:USD|USc|KRW|원)\/[A-Z]+|USD|KRW|원(?:\/g)?)/i,
        );
        const unit = unitMatch?.[1]?.trim() || "USD";
        if (price == null || changeRate == null) continue;
        const quote: MarketIndexQuote = {
          name: listed,
          category: url.includes("/metals")
            ? "metals"
            : url.includes("/energy")
              ? "energy"
              : "agricultural",
          code: `list:${listed}`,
          price,
          changeRate,
          unit,
          observedAt,
        };
        byName.set(listed, quote);
        byName.set(listed.replace(/\s+/g, ""), quote);
      }
    }),
  );

  listCache = { at: now, byName };
  return byName;
}

/**
 * Fetch Naver marketindex quotes for FX / energy / metals / ag names.
 * Cached ~3m to match heatmap refresh.
 */
export function peekNaverMarketIndexQuoteForName(name: string): MarketIndexQuote | undefined {
  const now = Date.now();
  const symbol = marketIndexSymbolForName(name);
  if (symbol) {
    const hit = quoteCache.get(cacheKey(symbol));
    if (hit && now - hit.at < QUOTE_TTL_MS) return hit.quote;
  }
  if (listCache && now - listCache.at < QUOTE_TTL_MS) {
    return matchListName(name, listCache.byName);
  }
  return undefined;
}

export async function fetchNaverMarketIndexQuotesForNames(
  names: string[],
): Promise<Map<string, MarketIndexQuote>> {
  const byName = new Map<string, MarketIndexQuote>();
  const now = Date.now();
  const pending: { name: string; symbol: MarketIndexSymbol }[] = [];
  const needList: string[] = [];

  for (const name of names) {
    const symbol = marketIndexSymbolForName(name);
    if (!symbol) {
      needList.push(name);
      continue;
    }
    const key = cacheKey(symbol);
    const hit = quoteCache.get(key);
    if (hit && now - hit.at < QUOTE_TTL_MS) {
      byName.set(name, hit.quote);
      continue;
    }
    pending.push({ name, symbol });
  }

  if (pending.length) {
    const settled = await Promise.all(
      pending.map(async (item) => ({
        item,
        quote: await fetchMarketIndexQuote(item.symbol),
      })),
    );
    for (const { item, quote } of settled) {
      if (!quote) {
        needList.push(item.name);
        continue;
      }
      quoteCache.set(cacheKey(item.symbol), { at: now, quote });
      byName.set(item.name, quote);
    }
  }

  const missing = needList.filter((name) => !byName.has(name));
  if (missing.length) {
    const listed = await loadListPageQuotes();
    for (const name of missing) {
      const quote = matchListName(name, listed);
      if (quote) byName.set(name, quote);
    }
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
