import { getChannelBriefingEdition, getRankings, splitChannelEdition } from "@/lib/api";
import { stripBoardDemographics } from "@/lib/boards/heatmap";
import { channelLiveMarket, loadChannelHeatmapPayloads } from "@/lib/boards/heatmap-server";
import { slimBriefingForCard, slimBriefingsForCards } from "@/lib/briefing/card-dto";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingsPayload } from "@/lib/types";

const EMPTY_MARKET = (): RankingsPayload => ({
  updatedAt: new Date().toISOString(),
  status: "open",
  indices: [],
  items: [],
});

/**
 * Parallel desk bootstrap for `/{channel}` navigations.
 *
 * Was: rankings → seedMissingBoards (all ~52 boards) → channel boards → briefing.
 * Channel board loading already seeds its own menus, so the global scan was
 * pure latency. Fetching the three real inputs together cuts soft-nav TTFB.
 */
export async function loadChannelPageData(channel: PostChannel) {
  const [market, boards, edition] = await Promise.all([
    getRankings().catch(() => EMPTY_MARKET()),
    loadChannelHeatmapPayloads(channel),
    getChannelBriefingEdition(channel).catch(() => undefined),
  ]);

  const slimBoards = stripBoardDemographics(boards);
  const split = edition
    ? splitChannelEdition(edition)
    : { main: undefined, dives: [] };

  return {
    boards: slimBoards,
    liveMarket: channelLiveMarket(market, channel, boards),
    main: split.main ? slimBriefingForCard(split.main) : undefined,
    dives: slimBriefingsForCards(split.dives ?? []),
  };
}

/** Desk-only bootstrap when briefing loads in a separate Suspense boundary. */
export async function loadChannelDeskData(channel: PostChannel) {
  const [market, boards] = await Promise.all([
    getRankings().catch(() => EMPTY_MARKET()),
    loadChannelHeatmapPayloads(channel),
  ]);
  return {
    boards: stripBoardDemographics(boards),
    liveMarket: channelLiveMarket(market, channel, boards),
  };
}
