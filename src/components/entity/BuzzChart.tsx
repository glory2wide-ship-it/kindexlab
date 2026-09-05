"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { ChartStyle } from "@/components/charts/TradingViewChart";
import { TIMEFRAMES } from "@/lib/categories";
import { formatCompact, formatRate, formatScore, metricLabel } from "@/lib/format";
import {
  candlesWindowOhlc,
  getTimeframeCandles,
  getTimeframeLinePath,
  timeframeLabel,
  volumeForTimeframe,
} from "@/lib/timeframes";
import type { RankingEntity, Timeframe } from "@/lib/types";

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

export function BuzzChart({
  entity,
  initialTimeframe = "3m",
}: {
  entity: RankingEntity;
  initialTimeframe?: Timeframe;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [chartStyle, setChartStyle] = useState<ChartStyle>("line");
  const candles = useMemo(
    () => getTimeframeCandles(entity, timeframe),
    [entity, timeframe],
  );
  const linePath = useMemo(
    () => getTimeframeLinePath(entity, timeframe),
    [entity, timeframe],
  );
  const ohlc = useMemo(() => candlesWindowOhlc(candles), [candles]);
  const score = ohlc.close;
  const change = ohlc.change;
  const volume = volumeForTimeframe(entity, timeframe);
  const tone = change > 0 ? "text-up" : change < 0 ? "text-down" : "text-muted";

  const quote = [
    { label: "시가", value: formatScore(ohlc.open) },
    { label: "고가", value: formatScore(ohlc.high) },
    { label: "저가", value: formatScore(ohlc.low) },
    { label: "현재", value: formatScore(ohlc.close) },
    { label: "등락", value: formatRate(change), className: tone },
    { label: metricLabel(entity.type), value: formatCompact(volume) },
  ];

  return (
    <section id="chart" className="scroll-mt-24 space-y-4">
      <div className="overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 py-4 md:px-7">
          <div>
            <p className="text-xs text-muted">종목 차트 분석 · {timeframeLabel(timeframe)}</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <h2 className="font-sans text-2xl font-semibold tabular-nums tracking-tight">
                {formatScore(score)}
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
            <TradingViewChart
              candles={candles}
              linePath={linePath}
              timeframe={timeframe}
              style={chartStyle}
              positive={change >= 0}
            />
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
          TradingView Lightweight Charts 기반 · 라인은 종가 곡선(그라데이션·현재가 점), 캔들은
          미국식(상승 초록 / 하락 빨강)입니다. 거래량 수치는 우측 시세란을 참고하세요. 실측 시세
          이력은 아닙니다.
        </p>
      </div>
    </section>
  );
}
