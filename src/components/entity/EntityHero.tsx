import { TIMEFRAMES } from "@/lib/categories";
import { TYPE_LABEL, formatCompact, formatRate, formatScore, metricLabel, scoreLabel } from "@/lib/format";
import {
  formatNaverMeasurement,
  isNaverStockMeasurement,
} from "@/lib/market/naver-finance-format";
import { buildTimeframeMetrics } from "@/lib/timeframes";
import type { RankingEntity } from "@/lib/types";

/** Ratings and star scores read wrong when abbreviated; counts read wrong when not. */
function formatMeasurement(value: number, unit: string): string {
  if (unit === "원" || unit === "KRW" || unit === "USD" || unit.startsWith("USD") || unit.startsWith("USc") || unit === "원/g") {
    return formatNaverMeasurement({ value, unit: unit === "KRW" ? "원" : unit });
  }
  const shown =
    unit === "%" || unit === "점"
      ? value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })
      : formatCompact(value);
  return `${shown}${unit}`;
}

function formatObservedAt(iso?: string): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function EntityHero({
  entity,
  kicker,
}: {
  entity: RankingEntity;
  kicker?: string;
}) {
  const stockQuote = isNaverStockMeasurement(entity.measurement) ? entity.measurement : undefined;
  const change = stockQuote?.changeRate ?? entity.fluctuationRate;
  const up = change > 0;
  const down = change < 0;
  const tone = up ? "text-up" : down ? "text-down" : "text-muted";
  const metrics = buildTimeframeMetrics(entity);
  const observedLabel = formatObservedAt(stockQuote?.observedAt);

  return (
    <section className="rounded-2xl border border-line bg-panel p-6 md:p-8">
      <p className="text-xs text-muted">
        {kicker ?? `${TYPE_LABEL[entity.type]} · 전일 ${entity.previousRank}위`}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{entity.name}</h1>
          <p className="mt-1 text-sm text-muted">{entity.nameEn}</p>
        </div>
        {/* Metrics read in sans with tabular figures: the gothic face is easier
            to scan at a glance and lining digits keep the columns aligned. */}
        <div className="text-right">
          {stockQuote ? (
            <>
              <p className="font-sans text-sm text-muted">네이버금융 현재가</p>
              <p className="font-sans text-4xl font-semibold tabular-nums tracking-tight">
                {formatMeasurement(stockQuote.value, stockQuote.unit)}
              </p>
              <p className={`mt-1 font-sans text-lg font-semibold tabular-nums ${tone}`}>
                {up ? "▲" : down ? "▼" : "–"} 전일 대비 {formatRate(change)}
              </p>
            </>
          ) : (
            <>
              <p className="font-sans text-sm text-muted">{scoreLabel(entity.type)}</p>
              <p className="font-sans text-4xl font-semibold tabular-nums tracking-tight">
                {formatScore(entity.buzzScore)}
              </p>
              <p className={`mt-1 font-sans text-lg font-semibold tabular-nums ${tone}`}>
                {up ? "▲" : down ? "▼" : "–"} {formatRate(entity.fluctuationRate)}
              </p>
            </>
          )}
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">현재 순위</dt>
          <dd className="mt-1 font-sans text-lg tabular-nums">{entity.rank}위</dd>
        </div>
        <div>
          <dt className="text-muted">{stockQuote ? "화제 지수" : "시가(오픈)"}</dt>
          <dd className="mt-1 font-sans text-lg tabular-nums">
            {stockQuote ? formatScore(entity.buzzScore) : formatScore(entity.openScore)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{metricLabel(entity.type)}</dt>
          <dd className="mt-1 font-sans text-lg tabular-nums">{formatCompact(entity.volume)}</dd>
        </div>
        <div>
          <dt className="text-muted">태그</dt>
          <dd className="mt-1">{entity.tags.join(" · ")}</dd>
        </div>
      </dl>
      {/* The one figure on this page that can be quoted as a fact: the source's
          own number in the source's own unit. Everything above it is derived. */}
      {stockQuote ? (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 px-4 py-4">
          <p className="text-[11px] text-muted">
            {stockQuote.source} · {stockQuote.label}
            {observedLabel ? ` · ${observedLabel} 기준` : ""} · 약 3분마다 갱신
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <p className="font-sans text-3xl font-semibold tabular-nums tracking-tight md:text-4xl">
              {formatMeasurement(stockQuote.value, stockQuote.unit)}
            </p>
            <p className={`font-sans text-xl font-semibold tabular-nums ${tone}`}>
              {up ? "▲" : down ? "▼" : "–"} 전일 대비 {formatRate(change)}
            </p>
          </div>
        </div>
      ) : entity.measurement ? (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
          <p className="text-[11px] text-muted">
            {entity.measurement.source} 발표 · {entity.measurement.label}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="font-sans text-2xl font-semibold tabular-nums">
              {formatMeasurement(entity.measurement.value, entity.measurement.unit)}
            </span>
            {entity.measurement.changeRate !== undefined ? (
              <span
                className={`font-sans text-sm font-semibold tabular-nums ${
                  entity.measurement.changeRate > 0
                    ? "text-up"
                    : entity.measurement.changeRate < 0
                      ? "text-down"
                      : "text-muted"
                }`}
              >
                직전 관측 대비 {formatRate(entity.measurement.changeRate)}
              </span>
            ) : null}
          </p>
        </div>
      ) : null}
      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm sm:grid-cols-5 lg:grid-cols-9">
        {TIMEFRAMES.map((option) => {
          const row = metrics[option.id];
          const rateTone =
            row.changeRate > 0 ? "text-up" : row.changeRate < 0 ? "text-down" : "text-muted";
          return (
            <div key={option.id} className="rounded-xl border border-line bg-board px-2.5 py-2">
              <dt className="text-[11px] text-muted">{option.label}</dt>
              <dd className={`mt-1 font-sans text-xs font-semibold tabular-nums ${rateTone}`}>
                {formatRate(row.changeRate)}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/85">{entity.summary}</p>
    </section>
  );
}
