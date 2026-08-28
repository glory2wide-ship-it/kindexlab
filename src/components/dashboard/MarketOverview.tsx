"use client";

import Link from "next/link";
import { FlipBoardNumber } from "@/components/dashboard/FlipBoardNumber";
import { formatKst, formatPoints, formatRate } from "@/lib/format";
import { COMPOSITE_INDEX_ID } from "@/lib/ingestion/composite";
import { indexPath } from "@/lib/indices";
import {
  DEFAULT_TRENDS_REVALIDATE_SEC,
  formatRefreshClock,
  formatRefreshCountdown,
} from "@/lib/refresh";
import type { MarketIndex, MarketStatus } from "@/lib/types";

export function MarketOverview({
  indices,
  updatedAt,
  status,
  remainingSec = DEFAULT_TRENDS_REVALIDATE_SEC,
  refreshing = false,
  flashNonce = 0,
}: {
  indices: MarketIndex[];
  updatedAt: string;
  status: MarketStatus;
  remainingSec?: number;
  refreshing?: boolean;
  flashNonce?: number;
}) {
  const countdownLabel = refreshing
    ? "Updating…"
    : `${formatRefreshClock(remainingSec)} · ${formatRefreshCountdown(remainingSec)}`;

  return (
    <section className="index-gothic grid grid-cols-2 gap-3 font-sans sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 xl:gap-2">
      {indices.map((index) => {
        const up = index.changeRate > 0;
        const down = index.changeRate < 0;
        const composite = index.id === COMPOSITE_INDEX_ID;
        const points = index.changePoints ?? 0;
        return (
          <Link
            key={index.id}
            href={indexPath(index.id)}
            aria-label={`${index.label} 상세 차트`}
            className={`relative min-w-0 overflow-hidden rounded-xl border bg-panel p-3 shadow-sm transition-colors hover:border-accent/50 @container ${
              composite ? "border-accent/50 ring-1 ring-accent/25" : "border-line"
            }`}
          >
            {flashNonce > 0 ? (
              <span
                key={flashNonce}
                className="market-live-flash pointer-events-none absolute inset-0 rounded-xl ring-1 ring-accent/35"
              />
            ) : null}
            <div className="relative z-[1] flex items-start justify-between gap-2 text-xs text-muted">
              <span className="min-w-0 truncate">{index.label}</span>
              <span
                className={`shrink-0 whitespace-nowrap font-sans tabular-nums ${
                  up ? "text-up" : down ? "text-down" : "text-muted"
                }`}
              >
                {formatRate(Number(index.changeRate))} {formatPoints(points)}
              </span>
            </div>
            <p className="kpi-score mt-2 font-sans font-semibold tracking-tight">
              <FlipBoardNumber value={index.value} playToken={flashNonce} />
            </p>
            <p className="mt-1 truncate text-[11px] text-muted">{index.note}</p>
          </Link>
        );
      })}
      <p className="col-span-2 font-sans text-[12.65px] font-medium leading-5 text-muted sm:col-span-3 lg:col-span-4 xl:col-span-6">
        {status === "open" ? "실시간 집계 중" : "집계 마감"} · 기준 {formatKst(updatedAt)}{" "}
        KST
        {status === "open" ? (
          <>
            {" "}
            ·{" "}
            <span
              className="refresh-countdown text-accent tabular-nums"
              suppressHydrationWarning
            >
              {countdownLabel}
            </span>
          </>
        ) : null}{" "}
        · 등락 색상은 국내 시세판 관례(상승 빨강 / 하락 파랑)
      </p>
    </section>
  );
}
