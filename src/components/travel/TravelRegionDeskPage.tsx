import { Suspense } from "react";
import { ChannelMarketDesk } from "@/components/dashboard/ChannelMarketDesk";
import { DeskEyebrow } from "@/components/ui/DeskEyebrow";
import { loadChannelDeskData } from "@/lib/boards/channel-page-data";
import type { RegionSegment } from "@/lib/boards/types";
import {
  TRAVEL_REGION_BOARD_NAV,
  travelRegionLabel,
  type TravelRegionBoardKey,
} from "@/lib/constants/nav";

function TravelDeskFallback() {
  return (
    <div
      className="h-[460px] animate-pulse rounded-2xl border border-line/60 bg-panel md:h-[640px]"
      aria-hidden
    />
  );
}

async function TravelDeskBody({
  boardKey,
  region,
}: {
  boardKey: Extract<TravelRegionBoardKey, "domestic" | "outing">;
  region: RegionSegment;
}) {
  const meta = TRAVEL_REGION_BOARD_NAV[boardKey];
  const { boards, liveMarket, initialItems, initialQuotedByBoard } =
    await loadChannelDeskData("travel");

  return (
    <ChannelMarketDesk
      channel="travel"
      boards={boards}
      liveMarket={liveMarket}
      initialItems={initialItems}
      initialQuotedByBoard={initialQuotedByBoard}
      initialBoardSlug={meta.slug}
      initialRegion={region}
    />
  );
}

export async function TravelRegionDeskPage({
  boardKey,
  region,
}: {
  boardKey: Extract<TravelRegionBoardKey, "domestic" | "outing">;
  region: RegionSegment;
}) {
  const meta = TRAVEL_REGION_BOARD_NAV[boardKey];

  return (
    <div className="space-y-4">
      <header className="space-y-1 px-1">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-sans text-sm font-semibold text-accent">{travelRegionLabel(region)}</span>
          <DeskEyebrow as="span" variant="sans">
            TRAVEL & FOOD DESK
          </DeskEyebrow>
        </p>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{meta.shortTitle}</h1>
        <p className="text-sm text-muted">
          {travelRegionLabel(region)} 지역 필터가 적용된 히트맵입니다. 아래 탭에서 다른 시/도로 바꿀 수
          있습니다.
        </p>
      </header>
      <Suspense fallback={<TravelDeskFallback />}>
        <TravelDeskBody boardKey={boardKey} region={region} />
      </Suspense>
    </div>
  );
}
