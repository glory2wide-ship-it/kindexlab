/**
 * Display-name → Naver Finance symbol for 증시·주요 종목 heatmap quotes.
 * Theme keywords (코스피, 이차전지 …) are intentionally omitted.
 */

export type StockMarket = "kr" | "us";

export interface StockSymbol {
  market: StockMarket;
  /** KR: 6-digit code. US: Reuters-style code for api.stock.naver.com (e.g. NVDA.O). */
  code: string;
}

const BY_NAME: Record<string, StockSymbol> = {
  삼성전자: { market: "kr", code: "005930" },
  SK하이닉스: { market: "kr", code: "000660" },
  현대차: { market: "kr", code: "005380" },
  기아: { market: "kr", code: "000270" },
  네이버: { market: "kr", code: "035420" },
  NAVER: { market: "kr", code: "035420" },
  카카오: { market: "kr", code: "035720" },
  셀트리온: { market: "kr", code: "068270" },
  LG에너지솔루션: { market: "kr", code: "373220" },
  한화에어로스페이스: { market: "kr", code: "012450" },
  삼성바이오로직스: { market: "kr", code: "207940" },
  POSCO홀딩스: { market: "kr", code: "005490" },
  포스코홀딩스: { market: "kr", code: "005490" },
  KB금융: { market: "kr", code: "105560" },
  신한지주: { market: "kr", code: "055550" },
  카카오뱅크: { market: "kr", code: "323410" },
  에코프로: { market: "kr", code: "086520" },
  알테오젠: { market: "kr", code: "196170" },
  엔비디아: { market: "us", code: "NVDA.O" },
  테슬라: { market: "us", code: "TSLA.O" },
  애플: { market: "us", code: "AAPL.O" },
  TSMC: { market: "us", code: "TSM.N" },
};

/** Normalize board row names before lookup (strip qualifiers / whitespace). */
export function normalizeStockName(name: string): string {
  return name
    .trim()
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\s+/g, "");
}

export function stockSymbolForName(name: string): StockSymbol | undefined {
  const raw = name.trim();
  if (!raw) return undefined;
  const compact = normalizeStockName(raw);
  return BY_NAME[raw] ?? BY_NAME[compact] ?? BY_NAME[raw.replace(/\s+/g, "")];
}

export const KOSPI_STOCK_BOARD_SLUG = "kospi-fomo-index";
