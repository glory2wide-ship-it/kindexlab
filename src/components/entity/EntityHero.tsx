import type { ReactNode } from "react";
import {
  entityNarrativeSummary,
  isEntityIndexBlurbText,
} from "@/lib/entity/index-blurb";
import { TYPE_LABEL, formatCompact, formatRate, formatScore, metricLabel } from "@/lib/format";
import {
  formatNaverMeasurement,
  isNaverStockMeasurement,
} from "@/lib/market/naver-finance-format";
import {
  detailFactsForHero,
  resolveDetailFacts,
} from "@/lib/boards/detail-facts";
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
  children,
}: {
  entity: RankingEntity;
  children?: ReactNode;
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
      <p className="detail-kicker-120 text-xs text-muted">{kicker ?? boardHint}</p>
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
        {observedLabel ? ` · ${observedLabel} 기준` : ""} · 약 5분마다 갱신 · 킨덱스 지수는 표시하지 않습니다
      </p>
      {children}
    </section>
  );
}

function DetailFactsBlock({
  detailFacts,
}: {
  detailFacts: NonNullable<ReturnType<typeof resolveDetailFacts>>;
}) {
  const synopsis = entityNarrativeSummary(detailFacts.synopsis);
  const showSynopsis = Boolean(synopsis) && !isEntityIndexBlurbText(synopsis);
  return (
    <div className="detail-profile-110 mt-3 space-y-3 border-t border-line pt-3 md:mt-4 md:pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-soft">종목 프로필</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 md:gap-4">
        {detailFacts.rows.map((row) => (
          <div key={row.label}>
            <dt className="text-muted">{row.label}</dt>
            <dd className="mt-0.5 font-medium leading-snug text-ink md:mt-1">
              {row.href ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-line underline-offset-2 hover:text-accent"
                >
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {detailFacts.chips
        ?.filter((chip) => chip.items.length > 0)
        .map((chip) => (
          <div key={chip.label}>
            <p className="text-[11px] font-semibold tracking-wide text-soft">{chip.label}</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {chip.items.map((item) => (
                <li
                  key={item}
                  className="rounded-md border border-line bg-board px-2 py-1 text-xs font-medium text-ink"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      {detailFacts.links && detailFacts.links.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-soft">관련 링크</p>
          <ul className="mt-1.5 space-y-1">
            {detailFacts.links.map((link) => (
              <li key={link.href} className="text-sm">
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline decoration-line underline-offset-2 hover:opacity-80"
                >
                  {link.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {showSynopsis ? <p className="text-sm leading-6 text-ink/90">{synopsis}</p> : null}
      {detailFacts.notice ? (
        <p className="rounded-lg bg-board px-3 py-2 text-[11px] leading-5 text-muted">
          주의: {detailFacts.notice}
        </p>
      ) : null}
    </div>
  );
}

export function EntityHero({
  entity,
  kicker,
}: {
  entity: RankingEntity;
  kicker?: string;
}) {
  const rawDetailFacts = resolveDetailFacts(entity);
  const detailFacts = rawDetailFacts ? detailFactsForHero(rawDetailFacts) : undefined;

  const stockQuote = isNaverStockMeasurement(entity.measurement) ? entity.measurement : undefined;
  if (stockQuote) {
    return (
      <MarketQuoteHero entity={entity} quote={stockQuote} kicker={kicker}>
        {detailFacts ? <DetailFactsBlock detailFacts={detailFacts} /> : null}
      </MarketQuoteHero>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-[18px] md:p-8">
      <p className="detail-kicker-120 text-xs text-muted">
        {kicker ?? `${TYPE_LABEL[entity.type]} · 전일 ${entity.previousRank}위`}
      </p>
      <div className="mt-1.5 md:mt-2">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{entity.name}</h1>
        {entity.nameEn ? <p className="mt-1 text-sm text-muted">{entity.nameEn}</p> : null}
      </div>
      <dl className="detail-metrics-120 mt-[1.125rem] grid grid-cols-3 gap-3 border-t border-line pt-3 text-sm md:mt-6 md:gap-4 md:pt-4">
        <div>
          <dt className="text-muted">현재 순위</dt>
          <dd
            className={`mt-0.5 font-sans text-lg tabular-nums md:mt-1 ${
              entity.rank < entity.previousRank
                ? "text-up"
                : entity.rank > entity.previousRank
                  ? "text-down"
                  : ""
            }`}
          >
            {entity.rank}위
          </dd>
        </div>
        <div>
          <dt className="text-muted">KinDex 시가(오픈)</dt>
          <dd
            className={`mt-0.5 font-sans text-lg tabular-nums md:mt-1 ${
              entity.buzzScore > entity.openScore
                ? "text-up"
                : entity.buzzScore < entity.openScore
                  ? "text-down"
                  : ""
            }`}
          >
            {formatScore(entity.openScore)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">
            {metricLabel(entity.type) === "거래량"
              ? "KinDex 거래량"
              : `KinDex ${metricLabel(entity.type)}`}
          </dt>
          <dd className="mt-0.5 font-sans text-lg tabular-nums md:mt-1">{formatCompact(entity.volume)}</dd>
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
      
      {detailFacts ? <DetailFactsBlock detailFacts={detailFacts} /> : null}
    </section>
  );
}
