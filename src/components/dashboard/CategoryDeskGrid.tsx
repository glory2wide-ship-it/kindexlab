"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRate } from "@/lib/format";
import { stripRowQualifier } from "@/lib/boards/heatmap";
import type { ChannelDesk } from "@/lib/boards/composite-desk";
import { entityHref } from "@/lib/slugs";
import { changeForEntity } from "@/lib/timeframes";

function rateClass(rate: number): string {
  if (rate > 0.25) return "text-up";
  if (rate < -0.25) return "text-down";
  return "text-muted";
}

/**
 * Channel desk cards under the unified heatmap.
 * Mobile wraps 2–3 cards per row; sm+ keeps five equal columns in one row.
 * Updates come from the landing `router.refresh()` — no second /api/unified-desks
 * poll that duplicated getRankings + board loads every 3 minutes.
 */
export function CategoryDeskGrid({
  desks: initialDesks,
}: {
  desks: ChannelDesk[];
  /** Kept for call-site compatibility; refresh is owned by UnifiedMarketBoard. */
  refreshIntervalSec?: number;
}) {
  const [desks, setDesks] = useState(initialDesks);

  useEffect(() => {
    setDesks(initialDesks);
  }, [initialDesks]);

  if (!desks.length) return null;

  return (
    <section aria-labelledby="desk-grid-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="desk-grid-heading" className="text-xl font-semibold tracking-tight">
            LIVE 킨덱스 랭킹
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 sm:grid-cols-5">
        {desks.map((desk) => (
          <article
            key={desk.channel}
            className="flex min-w-0 flex-col rounded-2xl border border-line bg-panel px-2.5 py-2.5 transition-colors hover:border-accent/50 sm:px-3 sm:py-3"
          >
            <h3 className="text-sm font-semibold leading-5 tracking-tight">
              <Link href={desk.href} prefetch={false} className="hover:text-accent">
                {desk.label}
              </Link>
            </h3>

            <ol className="mt-1.5 flex-1 space-y-0">
              {desk.top.length ? (
                desk.top.map((item, index) => {
                  const rate = changeForEntity(item, "3m");
                  return (
                    <li key={item.id}>
                      <Link
                        href={entityHref(item)}
                        prefetch={false}
                        className="flex items-baseline gap-1.5 rounded-md px-0.5 py-0.5 text-[13px] leading-5 hover:bg-board/60 sm:gap-2 sm:px-1 sm:text-sm sm:leading-5"
                      >
                        <span className="font-sans text-[10px] font-semibold tabular-nums text-muted sm:text-[11px]">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium" title={item.name}>
                          {stripRowQualifier(item.name)}
                        </span>
                        <span
                          className={`shrink-0 font-sans text-[10px] font-semibold tabular-nums sm:text-[11px] ${rateClass(rate)}`}
                        >
                          {formatRate(rate)}
                        </span>
                      </Link>
                    </li>
                  );
                })
              ) : (
                <li className="px-1 py-0.5 text-xs text-muted">집계 준비 중</li>
              )}
            </ol>

            <Link
              href={desk.href}
              prefetch={false}
              className="mt-2 inline-flex items-center justify-center rounded-lg border border-line px-2 py-1.5 text-center text-[11px] font-semibold leading-snug text-ink transition-colors hover:border-accent hover:text-accent sm:mt-2.5 sm:px-3 sm:text-xs sm:py-1.5"
            >
              <span className="sm:hidden">{desk.label} →</span>
              <span className="hidden sm:inline">{desk.label} 지수 바로가기 →</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
