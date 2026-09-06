"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FlipBoardNumber } from "@/components/dashboard/FlipBoardNumber";
import { formatPoints, formatRate } from "@/lib/format";
import { COMPOSITE_INDEX_ID, withIndexPoints } from "@/lib/ingestion/composite";
import { fetchTrendsSnapshot } from "@/lib/liveTrends";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import type { MarketIndex } from "@/lib/types";

function toneClass(value: number): string {
  if (value > 0) return "text-up";
  if (value < 0) return "text-down";
  return "text-muted";
}

function arrow(value: number): string {
  if (value > 0) return "▲";
  if (value < 0) return "▼";
  return "–";
}

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
  const up = resolved.changeRate > 0;
  const down = resolved.changeRate < 0;
  const points = resolved.changePoints ?? 0;

  return (
    <div className="index-gothic sticky top-14 z-30 border-b border-line bg-panel/95 font-sans backdrop-blur-md">
      <div className="mx-auto flex h-10 max-w-7xl items-center justify-between gap-3 overflow-hidden px-4">
        <Link href="/#heatmap" className="flex min-w-0 items-center gap-3 font-sans">
          <span className="shrink-0 font-sans text-[11px] font-semibold tracking-[0.14em] text-accent">
            KINDEXLAB 종합지수
          </span>
          <span
            className={`relative font-sans text-base font-semibold tabular-nums tracking-tight ${toneClass(index.changeRate)}`}
          >
            {flashNonce > 0 ? (
              <span
                key={flashNonce}
                className="market-live-flash pointer-events-none absolute inset-0 rounded"
              />
            ) : null}
            <FlipBoardNumber value={index.value} playToken={flashNonce} />
          </span>
          <span
            className={`shrink-0 font-sans text-xs font-semibold tabular-nums ${toneClass(index.changeRate)}`}
          >
            {arrow(index.changeRate)} {formatRate(index.changeRate)} {formatPoints(points)}
          </span>
        </Link>
        <p className="hidden min-w-0 truncate text-[11px] text-muted sm:block">
          {index.note} · 전일 대비 {up ? "상승" : down ? "하락" : "보합"} · 상승 초록 / 하락 빨강
        </p>
      </div>
    </div>
  );
}
