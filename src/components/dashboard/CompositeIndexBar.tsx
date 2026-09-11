"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FlipBoardNumber } from "@/components/dashboard/FlipBoardNumber";
import { COMPOSITE_INDEX_ID, withIndexPoints } from "@/lib/ingestion/composite";
import { fetchTrendsSnapshot } from "@/lib/liveTrends";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import type { MarketIndex } from "@/lib/types";

export function CompositeIndexBar({
  initial,
}: {
  initial: MarketIndex;
  updatedAt?: string;
}) {
  const [index, setIndex] = useState(initial);
  const [flashNonce, setFlashNonce] = useState(0);

  useEffect(() => {
    const tick = window.setInterval(async () => {
      const next = await fetchTrendsSnapshot();
      const row = next?.indices.find((item) => item.id === COMPOSITE_INDEX_ID);
      if (!row) return;
      setIndex(row);
      setFlashNonce((value) => value + 1);
    }, Math.max(15, DEFAULT_TRENDS_REVALIDATE_SEC) * 1000);
    return () => window.clearInterval(tick);
  }, []);

  const resolved = withIndexPoints(index);

  return (
    <div className="index-gothic sticky top-14 z-30 border-b border-line bg-panel/95 font-sans backdrop-blur-md">
      <div className="mx-auto flex h-10 max-w-[72rem] items-center justify-between gap-3 overflow-hidden px-4">
        <Link href="/#heatmap" className="flex min-w-0 items-center gap-3 font-sans">
          <span className="shrink-0 font-sans text-[11px] font-semibold tracking-[0.14em] text-accent">
            KINDEXLAB 종합지수
          </span>
          <span className="relative index-gothic font-sans text-base font-semibold tabular-nums tracking-tight">
            {flashNonce > 0 ? (
              <span
                key={flashNonce}
                className="market-live-flash pointer-events-none absolute inset-0 rounded"
              />
            ) : null}
            <FlipBoardNumber value={resolved.value} playToken={flashNonce} />
          </span>
        </Link>
        <p className="hidden min-w-0 truncate text-[11px] text-muted sm:block">{index.note}</p>
      </div>
    </div>
  );
}
