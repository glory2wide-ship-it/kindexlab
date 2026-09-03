"use client";

import { useState } from "react";
import { ChannelBriefingLayout } from "@/components/briefing/ChannelBriefingLayout";
import {
  ChannelMarketDesk,
  type ChannelLiveMarket,
} from "@/components/dashboard/ChannelMarketDesk";
import type { HeatmapBoardPayload } from "@/lib/boards/heatmap";
import type { PostChannel } from "@/lib/posts/types";
import type { BriefingArticle } from "@/lib/types";

/**
 * Shares ranking-board tab selection with the deep-dive grid so the lower menu
 * list stays in sync with the active 랭킹·지수 보드 tab.
 */
export function ChannelDeskWithBriefing({
  channel,
  boards,
  liveMarket,
  main,
  dives,
  titleLevel = 2,
}: {
  channel: PostChannel;
  boards: HeatmapBoardPayload[];
  liveMarket: ChannelLiveMarket;
  main?: BriefingArticle;
  dives: BriefingArticle[];
  titleLevel?: 1 | 2;
}) {
  const [activeDeskId, setActiveDeskId] = useState("");

  return (
    <div className="space-y-8">
      <ChannelMarketDesk
        channel={channel}
        boards={boards}
        liveMarket={liveMarket}
        onBoardChange={setActiveDeskId}
      />
      <section className="border-t border-line pt-8">
        <ChannelBriefingLayout
          channel={channel}
          main={main}
          dives={dives}
          titleLevel={titleLevel}
          activeDeskId={activeDeskId || undefined}
        />
      </section>
    </div>
  );
}
