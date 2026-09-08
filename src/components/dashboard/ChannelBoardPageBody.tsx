import { TREEMAP_FRAME_CLASS } from "@/components/dashboard/treemap-config";
import { Suspense } from "react";
import { ChannelBriefingPage } from "@/components/briefing/ChannelBriefingPage";
import { ChannelMarketDesk } from "@/components/dashboard/ChannelMarketDesk";
import { loadChannelDeskData } from "@/lib/boards/channel-page-data";
import type { PostChannel } from "@/lib/posts/types";

function DeskFallback() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-10 animate-pulse rounded bg-line/50" />
      <div className="h-12 animate-pulse rounded-lg bg-line/40" />
      <div className={`${TREEMAP_FRAME_CLASS} animate-pulse rounded-2xl border border-line/60 bg-panel`} />
    </div>
  );
}

function BriefingFallback() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-8 w-48 animate-pulse rounded bg-line/70" />
      <div className="h-40 animate-pulse rounded-2xl bg-line/40" />
    </div>
  );
}

/** Streams after layout H1 — boards + quotes only. */
async function ChannelDeskSection({ channel }: { channel: PostChannel }) {
  const { boards, liveMarket, initialItems, initialQuotedByBoard } =
    await loadChannelDeskData(channel);
  return (
    <ChannelMarketDesk
      channel={channel}
      boards={boards}
      liveMarket={liveMarket}
      initialItems={initialItems}
      initialQuotedByBoard={initialQuotedByBoard}
    />
  );
}

/**
 * Channel board body shared by `/[category]` and `/politics`.
 *
 * `CategoryChrome` already streams the H1. This page must not await desk data
 * at the top level or soft-nav waits on boards/quotes before painting chrome.
 */
export function ChannelBoardPageBody({ channel }: { channel: PostChannel }) {
  return (
    <div className="space-y-8">
      <Suspense fallback={<DeskFallback />}>
        <ChannelDeskSection channel={channel} />
      </Suspense>
      <section className="border-t border-line pt-8">
        <Suspense fallback={<BriefingFallback />}>
          <ChannelBriefingPage channel={channel} titleLevel={2} />
        </Suspense>
      </section>
    </div>
  );
}
