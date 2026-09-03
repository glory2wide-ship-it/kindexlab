import { TimeframeChart } from "@/components/charts/TimeframeChart";
import { TYPE_LABEL, formatCompact, formatRate, formatScore, metricLabel } from "@/lib/format";
import { formatEntityName } from "@/lib/boards/game-platforms";
import { buildTimeframeMetrics, scoreForTimeframe, timeframeLabel, volumeForTimeframe } from "@/lib/timeframes";
import type { RankingEntity, SeriesPoint, Timeframe } from "@/lib/types";

const PREVIEW_FRAMES: Timeframe[] = ["3m", "1d", "1w"];

export function HoverCard({
  entity,
  series,
  change,
  timeframe,
  x,
  y,
}: {
  entity: RankingEntity;
  series: SeriesPoint[];
  change: number;
  timeframe: Timeframe;
  x: number;
  y: number;
}) {
  const up = change > 0;
  const metrics = entity.metrics ?? buildTimeframeMetrics(entity);

  return (
    <div
      className="pointer-events-none fixed z-50 w-72 rounded-xl border border-line bg-panel/95 p-3 shadow-2xl backdrop-blur"
      style={{ left: x, top: y }}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted">
        {entity.heatmapGroup ?? TYPE_LABEL[entity.type]} · {timeframeLabel(timeframe)} · {entity.rank}위
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="font-semibold">{formatEntityName(entity)}</p>
        <p className={`font-mono text-sm ${up ? "text-up" : change < 0 ? "text-down" : "text-muted"}`}>
          {formatRate(change)}
        </p>
      </div>
      <p className="font-mono text-xs text-muted">
        {formatScore(scoreForTimeframe(entity, timeframe))} · {metricLabel(entity.type)} {formatCompact(volumeForTimeframe(entity, timeframe))}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-[10px]">
        {PREVIEW_FRAMES.map((frame) => {
          const rate = metrics[frame].changeRate;
          return (
            <div key={frame} className="rounded bg-board/80 px-1.5 py-1">
              <p className="text-muted">{frame.toUpperCase()}</p>
              <p className={rate > 0 ? "text-up" : rate < 0 ? "text-down" : "text-muted"}>
                {formatRate(rate)}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-muted">
        <TimeframeChart points={series} positive={change >= 0} compact />
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted">{entity.summary}</p>
    </div>
  );
}
