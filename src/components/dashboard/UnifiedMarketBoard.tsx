"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MarketWorkspace } from "@/components/dashboard/MarketWorkspace";
import { TickerTape } from "@/components/ticker/TickerTape";
import { LANDING_HEATMAP_TIMEFRAME } from "@/lib/boards/composite-desk";
import { LIVE_INDEX_LABEL } from "@/lib/posts/channels";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import type { MarketStatus, RankingEntity } from "@/lib/types";

/**
 * Landing board for the cross-category heatmap.
 *
 * Countdown lives inside HeatmapCountdown so this tree does not re-render
 * every second. Expire triggers a cheap ISR refresh of the landing RSC.
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
  const [pending, startTransition] = useTransition();

  return (
    /*
     * One flex column so ticker→heatmap spacing does not depend on the landing
     * page Suspense/client boundary (which can swallow parent gap-* between
     * fragment siblings). Mobile gap-3 matches CategoryChrome ticker→채널 옵션.
     * Desktop keeps md:gap-4 to stay aligned with category chrome.
     */
    <div className="order-2 flex flex-col gap-3 md:gap-4">
      <div className="-mx-4">
        {items.length ? <TickerTape items={items} /> : null}
      </div>
      <div className="space-y-3">
        <MarketWorkspace
          items={items}
          initialView="treemap"
          initialTimeframe={LANDING_HEATMAP_TIMEFRAME}
          hideCategoryTabs
          showChannelTags
          title={LIVE_INDEX_LABEL}
          subtitle="등락률·시세·버즈를 히트맵과 리스트로 읽습니다. 주식·해외 주식·원자재·환율 타일은 현재가(단위)를 표시합니다."
          refreshIntervalSec={refreshIntervalSec}
          refreshing={pending}
          onRefresh={() => startTransition(() => router.refresh())}
        />
      </div>
    </div>
  );
}
