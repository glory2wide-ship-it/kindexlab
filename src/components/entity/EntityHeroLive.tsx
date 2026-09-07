"use client";

import { useEffect, useState } from "react";
import { EntityHero } from "@/components/entity/EntityHero";
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
      .then((data: {
        measurement?: RankingEntity["measurement"];
        fluctuationRate?: number;
        summary?: string;
        metrics?: RankingEntity["metrics"];
      } | null) => {
        if (cancelled || !data?.measurement) return;
        setCurrent((prev) => ({
          ...prev,
          measurement: data.measurement,
          fluctuationRate: data.fluctuationRate ?? prev.fluctuationRate,
          summary: data.summary ?? prev.summary,
          metrics: data.metrics ?? prev.metrics,
        }));
      })
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

  return (
    <section className="rounded-2xl border border-line bg-panel p-6 md:p-8">
      <p className="text-xs text-muted">{kicker ?? boardHint}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{entity.name}</h1>
          {entity.nameEn ? <p className="mt-1 text-sm text-muted">{entity.nameEn}</p> : null}
        </div>
        <div className="text-right">
          <p className="font-sans text-sm text-muted">현재가</p>
          <p className="mt-2 font-sans text-sm text-muted">시세 불러오는 중…</p>
        </div>
      </div>
    </section>
  );
}
