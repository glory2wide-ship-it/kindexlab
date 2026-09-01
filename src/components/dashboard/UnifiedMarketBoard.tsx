"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MarketWorkspace } from "@/components/dashboard/MarketWorkspace";
import { TickerTape } from "@/components/ticker/TickerTape";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import type { MarketStatus, RankingEntity } from "@/lib/types";

const HEATMAP_PANEL_TITLE = "실시간 지수";

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
        {items.length ? <TickerTape items={items} /> : null}
      </div>
      <MarketWorkspace
        items={items}
        initialView="treemap"
        hideCategoryTabs
        title={HEATMAP_PANEL_TITLE}
        subtitle="등락률·버즈·거래량을 히트맵과 리스트로 읽습니다."
        remainingSec={remainingSec}
        refreshing={pending}
      />
    </div>
  );
}
