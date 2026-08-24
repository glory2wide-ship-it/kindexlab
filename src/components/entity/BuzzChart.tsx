"use client";

import { useMemo, useState } from "react";
import { TimeframeChart } from "@/components/charts/TimeframeChart";
import { TIMEFRAMES } from "@/lib/categories";
import { changeForEntity, getTimeframeSeries, timeframeLabel } from "@/lib/timeframes";
import type { RankingEntity, Timeframe } from "@/lib/types";

export function BuzzChart({ entity }: { entity: RankingEntity }) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const series = useMemo(
    () => getTimeframeSeries(entity, timeframe),
    [entity, timeframe],
  );
  const change = changeForEntity(entity, timeframe);
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{timeframeLabel(timeframe)} 차트</h2>
          <p className="font-mono text-xs text-muted">시가 {entity.openScore.toFixed(2)}</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-board p-1">
          {TIMEFRAMES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTimeframe(option.id)}
              className={`rounded-md px-3 py-1.5 font-mono text-[11px] font-medium ${
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
      <div className="mt-4 text-muted">
        <TimeframeChart points={series} positive={change >= 0} />
      </div>
    </section>
  );
}
