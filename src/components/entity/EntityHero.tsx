import { TYPE_LABEL, formatCompact, formatRate, formatScore, metricLabel, scoreLabel } from "@/lib/format";
import { buildTimeframeMetrics } from "@/lib/timeframes";
import type { RankingEntity, Timeframe } from "@/lib/types";

const HERO_FRAMES: Timeframe[] = ["5m", "1d", "1w"];

export function EntityHero({ entity }: { entity: RankingEntity }) {
  const up = entity.fluctuationRate > 0;
  const down = entity.fluctuationRate < 0;
  const tone = up ? "text-up" : down ? "text-down" : "text-muted";
  const metrics = buildTimeframeMetrics(entity);

  return (
    <section className="rounded-2xl border border-line bg-panel p-6 md:p-8">
      <p className="text-xs text-muted">
        {TYPE_LABEL[entity.type]} · 전일 {entity.previousRank}위
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{entity.name}</h1>
          <p className="mt-1 text-sm text-muted">{entity.nameEn}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm text-muted">{scoreLabel(entity.type)}</p>
          <p className="font-mono text-4xl font-semibold">{formatScore(entity.buzzScore)}</p>
          <p className={`mt-1 font-mono text-lg font-semibold ${tone}`}>
            {up ? "▲" : down ? "▼" : "–"} {formatRate(entity.fluctuationRate)}
          </p>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">현재 순위</dt>
          <dd className="mt-1 font-mono text-lg">{entity.rank}위</dd>
        </div>
        <div>
          <dt className="text-muted">시가(오픈)</dt>
          <dd className="mt-1 font-mono text-lg">{formatScore(entity.openScore)}</dd>
        </div>
        <div>
          <dt className="text-muted">{metricLabel(entity.type)}</dt>
          <dd className="mt-1 font-mono text-lg">{formatCompact(entity.volume)}</dd>
        </div>
        <div>
          <dt className="text-muted">태그</dt>
          <dd className="mt-1">{entity.tags.join(" · ")}</dd>
        </div>
      </dl>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        {HERO_FRAMES.map((frame) => {
          const row = metrics[frame];
          const rateTone =
            row.changeRate > 0 ? "text-up" : row.changeRate < 0 ? "text-down" : "text-muted";
          return (
            <div key={frame} className="rounded-xl border border-line bg-board px-3 py-2">
              <dt className="font-mono text-[11px] uppercase text-muted">{frame}</dt>
              <dd className={`mt-1 font-mono ${rateTone}`}>{formatRate(row.changeRate)}</dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/85">{entity.summary}</p>
    </section>
  );
}
