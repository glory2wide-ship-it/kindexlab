"use client";

import { useMemo, useState } from "react";
import { TimeframeChart } from "@/components/charts/TimeframeChart";
import { TIMEFRAMES } from "@/lib/categories";
import { formatCompact, formatRate, formatScore, metricLabel } from "@/lib/format";
import {
  changeForEntity,
  getTimeframeSeries,
  scoreForTimeframe,
  seriesOhlc,
  timeframeLabel,
  volumeForTimeframe,
} from "@/lib/timeframes";
import type { RankingEntity, Timeframe } from "@/lib/types";

export function BuzzChart({
  entity,
  initialTimeframe = "5m",
}: {
  entity: RankingEntity;
  initialTimeframe?: Timeframe;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const series = useMemo(
    () => getTimeframeSeries(entity, timeframe),
    [entity, timeframe],
  );
  const change = changeForEntity(entity, timeframe);
  const ohlc = useMemo(() => seriesOhlc(series), [series]);
  const score = scoreForTimeframe(entity, timeframe);
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

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="px-3 py-3 text-muted md:px-5">
            <TimeframeChart points={series} positive={change >= 0} />
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
      </div>

    </section>
  );
}
