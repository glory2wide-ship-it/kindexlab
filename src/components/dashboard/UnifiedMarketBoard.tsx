"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MarketStatusBar } from "@/components/dashboard/MarketOverview";
import { MarketWorkspace } from "@/components/dashboard/MarketWorkspace";
import { TickerTape } from "@/components/ticker/TickerTape";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import type { MarketStatus, RankingEntity } from "@/lib/types";

/**
 * Landing board for the cross-category heatmap.
 *
 * The channel boards refresh themselves from `/api/heatmap`, which answers for
 * one channel at a time and so cannot serve a merged view. Rather than add a
 * second merge path on the client, the countdown re-runs the server component
 * that assembled the tiles — one source of truth for the merge, and the desk
 * cards below refresh in step with the heatmap above them.
 */
export function UnifiedMarketBoard({
  items,
  updatedAt,
  status,
  refreshIntervalSec = DEFAULT_TRENDS_REVALIDATE_SEC,
}: {
  items: RankingEntity[];
  updatedAt: string;
  status: MarketStatus;
  refreshIntervalSec?: number;
}) {
  const router = useRouter();
  const [remainingSec, setRemainingSec] = useState(refreshIntervalSec);
  const [pending, startTransition] = useTransition();
  const deadlineRef = useRef(0);

  useEffect(() => {
    const intervalMs = Math.max(1, refreshIntervalSec) * 1000;
    deadlineRef.current = Date.now() + intervalMs;
    const tick = window.setInterval(() => {
      const remainingMs = deadlineRef.current - Date.now();
      setRemainingSec(Math.max(0, Math.ceil(remainingMs / 1000)));
      if (remainingMs > 0) return;
      deadlineRef.current = Date.now() + intervalMs;
      startTransition(() => router.refresh());
    }, 250);
    return () => window.clearInterval(tick);
  }, [refreshIntervalSec, router]);

  return (
    <div className="space-y-3">
      <div className="-mx-4">
        <MarketStatusBar
          updatedAt={updatedAt}
          status={status}
          remainingSec={remainingSec}
          refreshing={pending}
        />
        {items.length ? <TickerTape items={items} /> : null}
      </div>
      <MarketWorkspace
        items={items}
        initialView="treemap"
        hideCategoryTabs
        title="종합 지수(INDEX)"
        subtitle="엔터·정치·경제·문화 데스크를 한 판에 올린 통합 히트맵입니다. 타일 우측 상단이 출처 데스크입니다."
      />
    </div>
  );
}
