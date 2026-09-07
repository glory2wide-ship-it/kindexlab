import { NextResponse } from "next/server";
import {
  chartPricePrecision,
  fetchMarketChartCandles,
  resolveMarketChartInstrument,
  type MarketChartInstrument,
} from "@/lib/market/naver-chart";
import { ALL_TIMEFRAMES } from "@/lib/categories";
import type { Timeframe } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTimeframe(raw: string | null): Timeframe {
  const hit = ALL_TIMEFRAMES.find((item) => item.id === raw);
  return hit?.id ?? "1d";
}

function instrumentFromQuery(params: URLSearchParams): MarketChartInstrument | null {
  const kind = params.get("kind");
  const name = params.get("name")?.trim() || "";
  if (kind === "stock") {
    const market = params.get("market") === "us" ? "us" : "kr";
    const code = params.get("code")?.trim();
    if (!code) return null;
    return {
      kind: "stock",
      market,
      code,
      name: name || code,
      unit: market === "us" ? "USD" : "원",
    };
  }
  if (kind === "index") {
    const categoryRaw = params.get("category")?.trim() || "";
    const code = params.get("code")?.trim();
    const unit = params.get("unit")?.trim() || "USD";
    if (!code) return null;
    if (
      categoryRaw !== "exchange" &&
      categoryRaw !== "energy" &&
      categoryRaw !== "metals" &&
      categoryRaw !== "agricultural"
    ) {
      return null;
    }
    return {
      kind: "index",
      category: categoryRaw,
      code,
      name: name || code,
      unit,
    };
  }

  // Fallback: resolve from display name + board hints.
  const board = params.get("board")?.trim() || "";
  const entity = {
    name,
    slug: board ? `${board}--${name}` : name,
    heatmapGroup:
      board === "kospi-fomo-index"
        ? "주식"
        : board === "overseas-stock-index"
          ? "해외 주식"
          : board === "commodities-fx-index"
            ? "원자재·환율"
            : undefined,
  };
  return name ? resolveMarketChartInstrument(entity) : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const timeframe = parseTimeframe(params.get("tf"));
  const instrument = instrumentFromQuery(params);
  if (!instrument) {
    return NextResponse.json({ ok: false, error: "instrument required" }, { status: 400 });
  }

  try {
    const candles = await fetchMarketChartCandles(instrument, timeframe);
    return NextResponse.json({
      ok: true,
      instrument,
      timeframe,
      unit: instrument.unit,
      precision: chartPricePrecision(instrument.unit),
      count: candles.length,
      candles,
      source: "네이버금융",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "chart fetch failed",
      },
      { status: 502 },
    );
  }
}
