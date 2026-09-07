"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { ChartStyle } from "@/components/charts/TradingViewChart";
import { TIMEFRAMES } from "@/lib/categories";
import { formatRate } from "@/lib/format";
import { formatNaverMeasurement } from "@/lib/market/naver-finance-format";
import type { MarketChartInstrument } from "@/lib/market/naver-chart";
import { candlesWindowOhlc, timeframeLabel } from "@/lib/timeframes";
import type { CandlePoint, RankingEntity, Timeframe } from "@/lib/types";

const TradingViewChart = dynamic(
  () => import("@/components/charts/TradingViewChart").then((mod) => mod.TradingViewChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-line/60 bg-panel text-xs text-muted">
        차트 불러오는 중…
      </div>
    ),
  },
);

function formatPrice(value: number, unit: string): string {
  return formatNaverMeasurement({ value, unit: unit === "KRW" ? "원" : unit });
}

function instrumentQuery(instrument: MarketChartInstrument, timeframe: Timeframe): string {
  const params = new URLSearchParams({
    kind: instrument.kind,
    name: instrument.name,
    code: instrument.code,
    tf: timeframe,
    unit: instrument.unit,
  });
  if (instrument.kind === "stock") params.set("market", instrument.market);
  if (instrument.kind === "index") params.set("category", instrument.category);
  return params.toString();
}

export function MarketPriceChart({
  entity,
  instrument,
  initialTimeframe = "1d",
}: {
  entity: RankingEntity;
  instrument: MarketChartInstrument;
  initialTimeframe?: Timeframe;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>(
    initialTimeframe === "3m" ? "1d" : initialTimeframe,
  );
  const [chartStyle, setChartStyle] = useState<ChartStyle>("candle");
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [unit, setUnit] = useState(instrument.unit);
  const [precision, setPrecision] = useState(2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch(`/api/market-chart?${instrumentQuery(instrument, timeframe)}`)
      .then(async (response) => {
        const payload = (await response.json()) as {
          ok?: boolean;
          candles?: CandlePoint[];
          unit?: string;
          precision?: number;
          error?: string;
        };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "시세 차트를 불러오지 못했습니다.");
        }
        if (cancelled) return;
        setCandles(payload.candles ?? []);
        setUnit(payload.unit || instrument.unit);
        setPrecision(typeof payload.precision === "number" ? payload.precision : 2);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCandles([]);
        setError(err instanceof Error ? err.message : "시세 차트를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instrument, timeframe]);

  const ohlc = useMemo(() => candlesWindowOhlc(candles), [candles]);
  const change = ohlc.change;
  const tone = change > 0 ? "text-up" : change < 0 ? "text-down" : "text-muted";
  const linePath = useMemo(() => candles.map((bar) => bar.c), [candles]);
  const isIndex = instrument.kind === "index";
  const subtitle =
    instrument.kind === "stock"
      ? instrument.market === "us"
        ? "해외 주식 · 네이버금융 시세"
        : "국내 주식 · 네이버금융 시세"
      : `원자재·환율 · 네이버금융 (${unit})`;

  const quote = [
    { label: "시가", value: formatPrice(ohlc.open, unit) },
    { label: "고가", value: formatPrice(ohlc.high, unit) },
    { label: "저가", value: formatPrice(ohlc.low, unit) },
    { label: "현재", value: formatPrice(ohlc.close, unit) },
    { label: "등락", value: formatRate(change), className: tone },
    {
      label: isIndex ? "단위" : "거래량",
      value: isIndex
        ? unit
        : ohlc.volume > 0
          ? Math.round(ohlc.volume).toLocaleString("ko-KR")
          : "—",
    },
  ];

  return (
    <section id="chart" className="scroll-mt-24 space-y-4">
      <div className="overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 py-4 md:px-7">
          <div>
            <p className="text-xs text-muted">
              {entity.name} · {subtitle} · {timeframeLabel(timeframe)}
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <h2 className="font-sans text-2xl font-semibold tabular-nums tracking-tight">
                {candles.length ? formatPrice(ohlc.close, unit) : "—"}
              </h2>
              <p className={`font-sans text-lg font-semibold tabular-nums ${tone}`}>
                {change > 0 ? "▲" : change < 0 ? "▼" : "–"} {formatRate(change)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-board p-1">
              {(
                [
                  { id: "line" as const, label: "라인" },
                  { id: "candle" as const, label: "캔들" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setChartStyle(option.id)}
                  className={`rounded-md px-2.5 py-1.5 font-sans text-[11px] font-medium ${
                    chartStyle === option.id
                      ? "bg-ink text-board"
                      : "text-muted hover:bg-panel hover:text-ink"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg bg-board p-1">
              {TIMEFRAMES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTimeframe(option.id)}
                  className={`rounded-md px-2.5 py-1.5 font-sans text-[11px] font-medium sm:px-3 ${
                    timeframe === option.id
                      ? "bg-ink text-board"
                      : "text-muted hover:bg-panel hover:text-ink"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="px-3 py-3 md:px-5">
            {loading ? (
              <div className="flex h-[400px] items-center justify-center rounded-lg border border-line/60 bg-panel text-xs text-muted">
                네이버금융 시세 불러오는 중…
              </div>
            ) : candles.length >= 2 ? (
              <TradingViewChart
                candles={candles}
                linePath={linePath}
                timeframe={timeframe}
                style={chartStyle}
                positive={change >= 0}
                pricePrecision={precision}
              />
            ) : (
              <div className="flex h-[400px] flex-col items-center justify-center gap-2 rounded-lg border border-line/60 bg-panel px-6 text-center text-sm text-muted">
                <p>{error || "이 종목의 시세 차트를 아직 불러오지 못했습니다."}</p>
                <p className="text-xs">네이버금융에 공개된 시계열이 없는 항목일 수 있습니다.</p>
              </div>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-px border-t border-line bg-line lg:grid-cols-1 lg:border-l lg:border-t-0">
            {quote.map((item) => (
              <div key={item.label} className="bg-panel px-4 py-3">
                <dt className="text-[11px] text-muted">{item.label}</dt>
                <dd
                  className={`mt-1 font-sans text-sm font-semibold tabular-nums ${item.className ?? ""}`}
                >
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="border-t border-line px-5 py-3 text-[11px] leading-5 text-muted md:px-7">
          TradingView Lightweight Charts · 네이버금융 실제 시세(단위: {unit}). 분봉은 국내 주식은
          분 단위 체결을 집계하고, 해외 주식·원자재·환율은 제공 범위에 따라 일봉으로 대체될 수
          있습니다.
        </p>
      </div>
    </section>
  );
}
