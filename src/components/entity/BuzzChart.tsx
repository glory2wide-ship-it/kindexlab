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
  const rows = useMemo(
    () =>
      TIMEFRAMES.map((option) => {
        const points = getTimeframeSeries(entity, option.id);
        const stats = seriesOhlc(points);
        return {
          ...option,
          ...stats,
          change: changeForEntity(entity, option.id),
          score: scoreForTimeframe(entity, option.id),
          volume: volumeForTimeframe(entity, option.id),
        };
      }),
    [entity],
  );

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
              <h2 className="text-2xl font-semibold tracking-tight">{formatScore(score)}</h2>
              <p className={`font-mono text-lg font-semibold ${tone}`}>
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
                className={`rounded-md px-2.5 py-1.5 font-mono text-[11px] font-medium sm:px-3 ${
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
                <dd className={`mt-1 font-mono text-sm font-semibold ${item.className ?? ""}`}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="border-b border-line px-5 py-3">
          <h3 className="text-sm font-semibold">타임프레임 상세 통계</h3>
          <p className="mt-0.5 text-xs text-muted">
            1분·5분·10분·30분·60분·120분·일봉·주봉·월봉 등락과 시가·고가·저가·현재를 한 표에서 대조합니다.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-board text-left text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">봉</th>
                <th className="px-3 py-2.5 text-right font-medium">등락</th>
                <th className="px-3 py-2.5 text-right font-medium">버즈</th>
                <th className="px-3 py-2.5 text-right font-medium">시가</th>
                <th className="px-3 py-2.5 text-right font-medium">고가</th>
                <th className="px-3 py-2.5 text-right font-medium">저가</th>
                <th className="px-3 py-2.5 text-right font-medium">현재</th>
                <th className="px-4 py-2.5 text-right font-medium">{metricLabel(entity.type)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const active = row.id === timeframe;
                const rowTone =
                  row.change > 0 ? "text-up" : row.change < 0 ? "text-down" : "text-muted";
                return (
                  <tr
                    key={row.id}
                    className={`cursor-pointer border-t border-line/80 ${
                      active ? "bg-board/80" : "hover:bg-board/60"
                    }`}
                    onClick={() => setTimeframe(row.id)}
                  >
                    <td className="px-4 py-2.5 font-medium">{row.label}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold ${rowTone}`}>
                      {row.change > 0 ? "▲" : row.change < 0 ? "▼" : "–"} {formatRate(row.change)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatScore(row.score)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatScore(row.open)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatScore(row.high)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatScore(row.low)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatScore(row.close)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted">
                      {formatCompact(row.volume)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
