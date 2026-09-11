import { TYPE_LABEL, formatCompact, formatRate, formatScore, metricLabel } from "@/lib/format";
import {
  formatNaverMeasurement,
  isNaverStockMeasurement,
} from "@/lib/market/naver-finance-format";
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

/**
 * 주식 / 해외 주식 / 원자재·환율 detail: Naver Finance quote only.
 * KinDex buzz score, rank tiles, and timeframe index rates are omitted so they
 * are not confused with the live market change rate.
 */
function MarketQuoteHero({
  entity,
  quote,
  kicker,
}: {
  entity: RankingEntity;
  quote: {
    source: string;
    changeRate: number;
    value: number;
    unit: string;
    label: string;
    observedAt?: string;
    marketCap?: string;
    high52Week?: string;
    low52Week?: string;
  };
  kicker?: string;
}) {
  const change = quote.changeRate;
  const up = change > 0;
  const down = change < 0;
  const tone = up ? "text-up" : down ? "text-down" : "text-muted";
  const observedLabel = formatObservedAt(quote.observedAt);
  const boardHint =
    entity.heatmapGroup === "해외 주식"
      ? "해외 주식"
      : entity.heatmapGroup === "원자재·환율"
        ? "원자재·환율"
        : entity.heatmapGroup === "주식" || entity.heatmapGroup === "증시·주요 종목"
          ? "국내 주식"
          : TYPE_LABEL[entity.type];
  const showFundamentals = Boolean(quote.marketCap || quote.high52Week || quote.low52Week);

  return (
    <section className="rounded-2xl border border-line bg-panel p-[18px] md:p-8">
      <p className="text-xs text-muted">{kicker ?? boardHint}</p>
      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-3 md:mt-2 md:gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{entity.name}</h1>
          {entity.nameEn ? <p className="mt-1 text-sm text-muted">{entity.nameEn}</p> : null}
          {showFundamentals ? (
            <dl className="mt-3 grid grid-cols-1 gap-2 text-[1.00625rem] sm:grid-cols-3 sm:gap-3">
              {quote.marketCap ? (
                <div>
                  <dt className="text-[12.65px] text-muted">시가총액</dt>
                  <dd className="mt-0.5 font-sans tabular-nums text-ink">{quote.marketCap}</dd>
                </div>
              ) : null}
              {quote.high52Week ? (
                <div>
                  <dt className="text-[12.65px] text-muted">52주 최고가</dt>
                  <dd className="mt-0.5 font-sans tabular-nums text-ink">{quote.high52Week}</dd>
                </div>
              ) : null}
              {quote.low52Week ? (
                <div>
                  <dt className="text-[12.65px] text-muted">52주 최저가</dt>
                  <dd className="mt-0.5 font-sans tabular-nums text-ink">{quote.low52Week}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
        <div className="text-right">
          <p className="font-sans text-sm text-muted">현재가</p>
          <p className="font-sans text-4xl font-semibold tabular-nums tracking-tight">
            {formatMeasurement(quote.value, quote.unit)}
          </p>
          <p className={`mt-1 font-sans text-lg font-semibold tabular-nums ${tone}`}>
            {up ? "▲" : down ? "▼" : "–"} 전일 대비 {formatRate(change)}
          </p>
        </div>
      </div>
      <p className="mt-[1.125rem] text-[11px] text-muted md:mt-6">
        {quote.label}
        {observedLabel ? ` · ${observedLabel} 기준` : ""} · 약 3분마다 갱신 · 킨덱스 지수는 표시하지 않습니다
      </p>
    </section>
  );
}

export function EntityHero({
  entity,
  kicker,
}: {
  entity: RankingEntity;
  kicker?: string;
}) {
  const stockQuote = isNaverStockMeasurement(entity.measurement) ? entity.measurement : undefined;
  if (stockQuote) {
    return <MarketQuoteHero entity={entity} quote={stockQuote} kicker={kicker} />;
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-[18px] md:p-8">
      <p className="text-xs text-muted">
        {kicker ?? `${TYPE_LABEL[entity.type]} · 전일 ${entity.previousRank}위`}
      </p>
      <div className="mt-1.5 md:mt-2">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{entity.name}</h1>
        {entity.nameEn ? <p className="mt-1 text-sm text-muted">{entity.nameEn}</p> : null}
      </div>
      <dl className="mt-[1.125rem] grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm sm:grid-cols-4 md:mt-6 md:gap-4 md:pt-4">
        <div>
          <dt className="text-muted">현재 순위</dt>
          <dd className="mt-0.5 font-sans text-lg tabular-nums md:mt-1">{entity.rank}위</dd>
        </div>
        <div>
          <dt className="text-muted">시가(오픈)</dt>
          <dd className="mt-0.5 font-sans text-lg tabular-nums md:mt-1">{formatScore(entity.openScore)}</dd>
        </div>
        <div>
          <dt className="text-muted">{metricLabel(entity.type)}</dt>
          <dd className="mt-0.5 font-sans text-lg tabular-nums md:mt-1">{formatCompact(entity.volume)}</dd>
        </div>
        <div>
          <dt className="text-muted">태그</dt>
          <dd className="mt-0.5 md:mt-1">{entity.tags.join(" · ")}</dd>
        </div>
      </dl>
      {entity.measurement ? (
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 md:mt-4 md:py-3">
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
      <p className="mt-[0.9375rem] max-w-3xl text-sm leading-7 text-ink/85 max-md:leading-[0.984rem] md:mt-5">
        {entity.summary}
      </p>
    </section>
  );
}
