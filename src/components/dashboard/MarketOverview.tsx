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
  hideOnMobileIds,
  enlargeDesktopTitleScore = false,
  enlargeDesktopScoreExtra = false,
}: {
  indices: MarketIndex[];
  flashNonce?: number;
  selectedId?: string;
  /** Index ids hidden below the `md` breakpoint (desktop keeps them). */
  hideOnMobileIds?: readonly string[];
  /** Desktop-only +25% on menu label + KPI score (엔터·경제·정치·문화). */
  enlargeDesktopTitleScore?: boolean;
  /** Desktop-only extra +25% on KPI score only (엔터·경제·문화). */
  enlargeDesktopScoreExtra?: boolean;
}) {
  const indices = Array.isArray(indicesProp) ? indicesProp : [];
  const mobileHidden = hideOnMobileIds?.length ? new Set(hideOnMobileIds) : null;
  const labelClass = enlargeDesktopTitleScore
    ? "truncate text-[10px] text-muted sm:text-xs md:text-[18px]"
    : "truncate text-[10px] text-muted sm:text-xs md:text-[14.4px]";
  const scoreClass = enlargeDesktopScoreExtra
    ? "kpi-score mt-1.5 font-sans font-semibold tracking-tight sm:mt-2 md:[font-size:clamp(1.7625rem,calc(100cqi/3.824),3.0375rem)]"
    : enlargeDesktopTitleScore
      ? "kpi-score mt-1.5 font-sans font-semibold tracking-tight sm:mt-2 md:[font-size:clamp(1.41rem,calc(100cqi/4.78),2.43rem)]"
      : "kpi-score mt-1.5 font-sans font-semibold tracking-tight sm:mt-2 md:[font-size:clamp(1.128rem,calc(100cqi/5.975),1.944rem)]";

  return (
    <section className="index-gothic grid grid-cols-3 gap-2 font-sans sm:gap-3 md:flex md:flex-nowrap md:gap-2">
      {indices.map((index) => {
        const resolved = withIndexPoints(index);
        const up = resolved.changeRate > 0;
        const down = resolved.changeRate < 0;
        const composite = resolved.id === COMPOSITE_INDEX_ID || resolved.id === selectedId;
        const points = resolved.changePoints ?? 0;
        const hideOnMobile = mobileHidden?.has(index.id);
        return (
          <Link
            key={`${index.id}-${resolved.value}-${resolved.changeRate}`}
            href={index.href ?? indexPath(index.id)}
            aria-label={`${index.label} ${resolved.value.toFixed(2)} ${formatRate(Number(resolved.changeRate))}`}
            className={`relative min-w-0 overflow-hidden rounded-xl border bg-panel p-2 shadow-sm transition-colors hover:border-accent/50 @container sm:p-3 md:flex-1 ${
              composite ? "border-accent/50 ring-1 ring-accent/25" : "border-line"
            }${hideOnMobile ? " max-md:hidden" : ""}`}
          >
            {flashNonce > 0 ? (
              <span
                key={flashNonce}
                className="market-live-flash pointer-events-none absolute inset-0 rounded-xl ring-1 ring-accent/35"
              />
            ) : null}
            <div className="relative z-[1]">
              <p className={labelClass}>{index.label}</p>
              <p className={scoreClass}>
                <FlipBoardNumber value={index.value} playToken={flashNonce} />
              </p>
              <p
                className={`mt-1 flex flex-col gap-0.5 font-sans text-[10px] font-semibold tabular-nums leading-tight sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-1.5 sm:text-[11px] md:text-[13.2px] ${
                  up ? "text-up" : down ? "text-down" : "text-muted"
                }`}
              >
                <span>{formatRate(Number(index.changeRate))}</span>
                <span className="sm:opacity-90">{formatPoints(points)}</span>
              </p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
