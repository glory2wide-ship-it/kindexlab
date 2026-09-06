"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatRate } from "@/lib/format";
import { stripRowQualifier } from "@/lib/boards/heatmap";
import type { ChannelDesk } from "@/lib/boards/composite-desk";
import { entityHref } from "@/lib/slugs";
import { changeForEntity } from "@/lib/timeframes";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";

function rateClass(rate: number): string {
  if (rate > 0.25) return "text-up";
  if (rate < -0.25) return "text-down";
  return "text-muted";
}

/**
 * Channel desk cards under the unified heatmap — five categories in one row.
 * Polls `/api/unified-desks` on the same 3-minute cadence as the heatmap countdown.
 */
export function CategoryDeskGrid({
  desks: initialDesks,
  refreshIntervalSec = DEFAULT_TRENDS_REVALIDATE_SEC,
}: {
  desks: ChannelDesk[];
  refreshIntervalSec?: number;
}) {
  const [desks, setDesks] = useState(initialDesks);
  const inFlightRef = useRef(false);
  const intervalMs = Math.max(1, refreshIntervalSec) * 1000;

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const response = await fetch(`/api/unified-desks`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { desks?: ChannelDesk[] };
      if (Array.isArray(payload.desks) && payload.desks.length) {
        setDesks(payload.desks);
      }
    } catch {
      /* keep last good desks */
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    setDesks(initialDesks);
  }, [initialDesks]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => window.clearInterval(tick);
  }, [intervalMs, refresh]);

  if (!desks.length) return null;

  return (
    <section aria-labelledby="desk-grid-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="desk-grid-heading" className="text-xl font-semibold tracking-tight">
            LIVE KinDex
          </h2>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="flex min-w-[56rem] gap-3 sm:min-w-0">
          {desks.map((desk) => (
            <article
              key={desk.channel}
              className="flex min-w-0 flex-1 basis-0 flex-col rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-accent/50"
            >
              <h3 className="text-sm font-semibold leading-6 tracking-tight">
                <Link href={desk.href} prefetch className="hover:text-accent">
                  {desk.label}
                </Link>
              </h3>

              <ol className="mt-3 flex-1 space-y-2">
                {desk.top.length ? (
                  desk.top.map((item, index) => {
                    const rate = changeForEntity(item, "3m");
                    return (
                      <li key={item.id}>
                        <Link
                          href={entityHref(item)}
                          className="flex items-baseline gap-2 rounded-md px-1 py-1 text-sm hover:bg-board/60"
                        >
                          <span className="font-sans text-[11px] font-semibold tabular-nums text-muted">
                            {index + 1}
                          </span>
                          <span className="flex-1 truncate font-medium" title={item.name}>
                            {stripRowQualifier(item.name)}
                          </span>
                          <span
                            className={`font-sans text-[11px] font-semibold tabular-nums ${rateClass(rate)}`}
                          >
                            {formatRate(rate)}
                          </span>
                        </Link>
                      </li>
                    );
                  })
                ) : (
                  <li className="px-1 py-1 text-xs text-muted">집계 준비 중</li>
                )}
              </ol>

              <Link
                href={desk.href}
                prefetch
                className="mt-4 inline-flex items-center justify-center rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
              >
                {desk.label} 지수 바로가기 →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
