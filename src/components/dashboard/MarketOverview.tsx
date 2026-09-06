"use client";

import Link from "next/link";
import { FlipBoardNumber } from "@/components/dashboard/FlipBoardNumber";
import { formatKst, formatPoints, formatRate } from "@/lib/format";
import { COMPOSITE_INDEX_ID, withIndexPoints } from "@/lib/ingestion/composite";
import { indexPath } from "@/lib/indices";
import {
  DEFAULT_TRENDS_REVALIDATE_SEC,
  formatRefreshClock,
  formatRefreshCountdown,
} from "@/lib/refresh";
import type { MarketIndex, MarketStatus } from "@/lib/types";

export function MarketStatusBar({
  updatedAt,
  status,
  remainingSec = DEFAULT_TRENDS_REVALIDATE_SEC,
  refreshing = false,
}: {
  updatedAt: string;
  status: MarketStatus;
  remainingSec?: number;
  refreshing?: boolean;
}) {
  const countdownLabel = refreshing
    ? "Updating…"
    : `${formatRefreshClock(remainingSec)} · ${formatRefreshCountdown(remainingSec)}`;

  return (
    <div className="border-y border-line bg-panel px-5 py-2 font-sans text-[12.65px] font-medium leading-5 text-muted">
      {status === "open" ? "실시간 집계 중" : "집계 마감"} · 기준 {formatKst(updatedAt)} KST
      {status === "open" ? (
        <>
          {" "}
          ·{" "}
          <span className="refresh-countdown text-accent tabular-nums" suppressHydrationWarning>
            {countdownLabel}
          </span>
        </>
      ) : null}{" "}
      · 등락 색상은 히트맵과 같습니다(상승 초록 / 하락 빨강)
    </div>
  );
}

export function MarketOverview({
  indices: indicesProp,
  flashNonce = 0,
  selectedId,
}: {
  indices: MarketIndex[];
  flashNonce?: number;
  selectedId?: string;
}) {
  const indices = Array.isArray(indicesProp) ? indicesProp : [];

  return (
    <section className="index-gothic grid grid-cols-2 gap-3 font-sans sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 xl:gap-2">
      {indices.map((index) => {
        const resolved = withIndexPoints(index);
        const up = resolved.changeRate > 0;
        const down = resolved.changeRate < 0;
        const composite = resolved.id === COMPOSITE_INDEX_ID || resolved.id === selectedId;
        const points = resolved.changePoints ?? 0;
        return (
          <Link
            key={`${index.id}-${resolved.value}-${resolved.changeRate}`}
            href={index.href ?? indexPath(index.id)}
            aria-label={`${index.label} ${resolved.value.toFixed(2)} ${formatRate(Number(resolved.changeRate))}`}
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
    </section>
  );
}
