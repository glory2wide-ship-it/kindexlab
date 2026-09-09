"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { ChartStyle } from "@/components/charts/TradingViewChart";
import { TIMEFRAMES } from "@/lib/categories";
import { formatRate } from "@/lib/format";
import {
  formatNaverMeasurement,
  isNaverStockMeasurement,
} from "@/lib/market/naver-finance-format";
import type { MarketChartInstrument } from "@/lib/market/naver-chart";
import { candlesWindowOhlc, chartDisplayBarCount, timeframeLabel } from "@/lib/timeframes";
import type { CandlePoint, RankingEntity, Timeframe } from "@/lib/types";

const TradingViewChart = dynamic(
  () => import("@/components/charts/TradingViewChart").then((mod) => mod.TradingViewChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-line/60 bg-panel text-xs text-muted md:h-[400px]">
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

  const ohlc = useMemo(() => {
    const count = chartDisplayBarCount(timeframe === "3m" ? "1d" : timeframe);
    const window = candles.length > count ? candles.slice(-count) : candles;
    return candlesWindowOhlc(window);
  }, [candles, timeframe]);
  const naverQuote = isNaverStockMeasurement(entity.measurement) ? entity.measurement : undefined;
  // Prefer Naver day change for the quote panel. Candle-window % (e.g. full 일봉
  // range) looks like a KinDex/index move and confuses readers next to 전일 대비.
  const dayChange = naverQuote?.changeRate;
  const dayTone =
    dayChange == null
      ? "text-muted"
      : dayChange > 0
        ? "text-up"
        : dayChange < 0
          ? "text-down"
          : "text-muted";
  const linePath = useMemo(() => candles.map((bar) => bar.c), [candles]);
  const initialVisibleBars = chartDisplayBarCount(timeframe === "3m" ? "1d" : timeframe);
  const isIndex = instrument.kind === "index";
  const subtitle =
    instrument.kind === "stock"
      ? instrument.market === "us"
        ? "해외 주식 시세"
        : "국내 주식 시세"
      : `원자재·환율 (${unit})`;

  const quote = [
    { label: "시가", value: formatPrice(ohlc.open, unit) },
    { label: "고가", value: formatPrice(ohlc.high, unit) },
    { label: "저가", value: formatPrice(ohlc.low, unit) },
    { label: "현재", value: formatPrice(ohlc.close, unit) },
    {
      label: "전일 대비",
      value: dayChange == null ? "—" : formatRate(dayChange),
      className: dayTone,
    },
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
    <section id="chart" className="scroll-mt-28 space-y-4 md:scroll-mt-24">
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
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-col items-stretch gap-2 md:w-auto md:flex-row md:flex-wrap md:items-center">
            <div className="flex w-fit gap-1 rounded-lg bg-board p-1">
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
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-board px-2 py-1 [-ms-overflow-style:none] [scrollbar-width:none] md:flex-wrap [&::-webkit-scrollbar]:hidden">
              {TIMEFRAMES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTimeframe(option.id)}
                  className={`shrink-0 rounded-md px-2 py-1.5 font-sans text-[11px] font-medium md:px-3 ${
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
              <div className="flex h-[240px] items-center justify-center rounded-lg border border-line/60 bg-panel text-xs text-muted md:h-[400px]">
                시세 불러오는 중…
              </div>
            ) : candles.length >= 2 ? (
              <TradingViewChart
                candles={candles}
                linePath={linePath}
                timeframe={timeframe}
                style={chartStyle}
                positive={(dayChange ?? ohlc.change) >= 0}
                pricePrecision={precision}
                initialVisibleBars={initialVisibleBars}
              />
            ) : (
              <div className="flex h-[240px] flex-col items-center justify-center gap-2 rounded-lg border border-line/60 bg-panel px-6 text-center text-sm text-muted md:h-[400px]">
                <p>{error || "이 종목의 시세 차트를 아직 불러오지 못했습니다."}</p>
                <p className="text-xs">공개된 시계열이 없는 항목일 수 있습니다.</p>
              </div>
            )}
          </div>
          <dl className="grid grid-cols-3 gap-px border-t border-line bg-line lg:grid-cols-1 lg:border-l lg:border-t-0">
            {quote.map((item) => (
              <div key={item.label} className="bg-panel px-3 py-2.5 max-md:py-1.5 md:px-4 md:py-3">
                <dt className="text-[11px] leading-[0.9375rem] text-muted max-md:leading-[0.703rem] md:leading-normal">
                  {item.label}
                </dt>
                <dd
                  className={`mt-1 font-sans text-sm font-semibold tabular-nums leading-[1.05rem] max-md:mt-0.5 max-md:leading-[0.788rem] md:leading-normal ${item.className ?? ""}`}
                >
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="border-t border-line px-5 py-3 text-[11px] leading-5 text-muted max-md:leading-4 md:px-7">
          TradingView Lightweight Charts · 실제 시세(단위: {unit}). 차트를 좌우로 끌어
          이전 시간대도 확인할 수 있습니다. 분봉은 국내 주식은 분 단위 체결을 집계하고, 해외
          주식·원자재·환율은 제공 범위에 따라 일봉으로 대체될 수 있습니다.
        </p>
      </div>
    </section>
  );
}
