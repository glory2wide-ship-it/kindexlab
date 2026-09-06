import { ChannelMarketDesk } from "@/components/dashboard/ChannelMarketDesk";
import { DeskEyebrow } from "@/components/ui/DeskEyebrow";
import { loadChannelDeskData } from "@/lib/boards/channel-page-data";
import type { RegionSegment } from "@/lib/boards/types";
import {
  TRAVEL_REGION_BOARD_NAV,
  travelRegionLabel,
  type TravelRegionBoardKey,
} from "@/lib/constants/nav";

export async function TravelRegionDeskPage({
  boardKey,
  region,
}: {
  boardKey: Extract<TravelRegionBoardKey, "domestic" | "outing">;
  region: RegionSegment;
}) {
  const meta = TRAVEL_REGION_BOARD_NAV[boardKey];
  const { boards, liveMarket } = await loadChannelDeskData("travel");

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
      <ChannelMarketDesk
        channel="travel"
        boards={boards}
        liveMarket={liveMarket}
        initialBoardSlug={meta.slug}
        initialRegion={region}
      />
    </div>
  );
}
