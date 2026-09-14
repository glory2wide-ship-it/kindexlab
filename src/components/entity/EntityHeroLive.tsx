"use client";

import { useEffect, useState } from "react";
import { EntityHero } from "@/components/entity/EntityHero";
import {
  detailFactsAreStale,
  resolveDetailFacts,
} from "@/lib/boards/detail-facts";
import { TYPE_LABEL } from "@/lib/format";
import { isNaverStockMeasurement } from "@/lib/market/naver-finance-format";
import type { RankingEntity } from "@/lib/types";

/**
 * Detail hero that paints immediately from the RSC payload, then refreshes
 * the Naver quote in the background so soft-nav never waits on Finance.
 */
export function EntityHeroLive({
  entity,
  hydrateQuote,
  kicker,
}: {
  entity: RankingEntity;
  hydrateQuote: boolean;
  kicker?: string;
}) {
  const [current, setCurrent] = useState(entity);

  useEffect(() => {
    setCurrent(entity);
  }, [entity]);

  useEffect(() => {
    if (!hydrateQuote) return;
    let cancelled = false;
    const controller = new AbortController();

    void fetch(`/api/market-quote?slug=${encodeURIComponent(entity.slug)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          data: {
            measurement?: RankingEntity["measurement"];
            fluctuationRate?: number;
            summary?: string;
            metrics?: RankingEntity["metrics"];
          } | null,
        ) => {
          if (cancelled || !data?.measurement) return;
          setCurrent((prev) => ({
            ...prev,
            measurement: data.measurement,
            fluctuationRate: data.fluctuationRate ?? prev.fluctuationRate,
            summary: data.summary ?? prev.summary,
            metrics: data.metrics ?? prev.metrics,
          }));
        },
      )
      .catch(() => undefined);

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hydrateQuote, entity.slug]);

  if (hydrateQuote && !isNaverStockMeasurement(current.measurement)) {
    return <MarketQuotePendingHero entity={current} kicker={kicker} />;
  }

  return <EntityHero entity={current} kicker={kicker} />;
}

function MarketQuotePendingHero({
  entity,
  kicker,
}: {
  entity: RankingEntity;
  kicker?: string;
}) {
  const boardHint =
    entity.heatmapGroup === "해외 주식"
      ? "해외 주식"
      : entity.heatmapGroup === "원자재·환율"
        ? "원자재·환율"
        : entity.heatmapGroup === "주식" || entity.heatmapGroup === "증시·주요 종목"
          ? "국내 주식"
          : TYPE_LABEL[entity.type];

  const detailFacts = resolveDetailFacts(entity);
  const detailFactsStale = detailFacts ? detailFactsAreStale(detailFacts) : false;
  const refreshLabel = detailFacts?.refresh === "daily" ? "일 1회 점검" : "주 1회 점검";

  return (
    <section className="rounded-2xl border border-line bg-panel p-[18px] md:p-8">
      <p className="text-xs text-muted">{kicker ?? boardHint}</p>
      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-3 md:mt-2 md:gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{entity.name}</h1>
          {entity.nameEn ? <p className="mt-1 text-sm text-muted">{entity.nameEn}</p> : null}
        </div>
        <div className="text-right">
          <p className="font-sans text-sm text-muted">현재가</p>
          <p className="mt-1.5 font-sans text-sm text-muted md:mt-2">시세 불러오는 중…</p>
        </div>
      </div>
      {detailFacts ? (
        <div className="mt-3 space-y-3 border-t border-line pt-3 md:mt-4 md:pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-wide text-soft">종목 프로필</p>
            <p className="text-[10px] text-muted">
              정보 점검 {detailFacts.checkedAt.slice(0, 10)}
              {detailFactsStale ? " · 갱신 필요" : ` · ${refreshLabel}`}
            </p>
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
          {detailFacts.synopsis ? (
            <p className="text-sm leading-6 text-ink/90">{detailFacts.synopsis}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
