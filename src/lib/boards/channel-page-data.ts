import { getChannelBriefingEdition, getRankings, splitChannelEdition } from "@/lib/api";
import { stripBoardDemographics } from "@/lib/boards/heatmap";
import { channelLiveMarket, loadChannelHeatmapPayloads } from "@/lib/boards/heatmap-server";
import { channelUsesBoardHeatmap } from "@/lib/boards/limits";
import { slimBriefingForCard, slimBriefingsForCards } from "@/lib/briefing/card-dto";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingsPayload } from "@/lib/types";

const EMPTY_MARKET = (): RankingsPayload => ({
  updatedAt: new Date().toISOString(),
  status: "open",
  indices: [],
  items: [],
});

function emptyLiveMarket() {
  return {
    updatedAt: new Date().toISOString(),
    status: "open" as const,
    items: [] as RankingsPayload["items"],
    indices: [] as RankingsPayload["indices"],
  };
}

/**
 * Parallel desk bootstrap for `/{channel}` navigations.
 *
 * Board-driven channels (엔터·정치·경제·문화·여행) never paint live rankings on
 * first paint — skip getRankings() so soft-nav is not gated on polls + metrics.
 */
export async function loadChannelPageData(channel: PostChannel) {
  const boardsPromise = loadChannelHeatmapPayloads(channel);
  const editionPromise = getChannelBriefingEdition(channel).catch(() => undefined);

  const boards = stripBoardDemographics(await boardsPromise);
  const boardDriven = channelUsesBoardHeatmap(channel) && boards.length > 0;

  const [market, edition] = await Promise.all([
    boardDriven ? Promise.resolve(EMPTY_MARKET()) : getRankings().catch(() => EMPTY_MARKET()),
    editionPromise,
  ]);

  const split = edition
    ? splitChannelEdition(edition)
    : { main: undefined, dives: [] };

  return {
    boards,
    liveMarket: boardDriven ? emptyLiveMarket() : channelLiveMarket(market, channel, boards),
    main: split.main ? slimBriefingForCard(split.main) : undefined,
    dives: slimBriefingsForCards(split.dives ?? []),
  };
}

/** Desk-only bootstrap when briefing loads in a separate Suspense boundary. */
export async function loadChannelDeskData(channel: PostChannel) {
  const boards = stripBoardDemographics(await loadChannelHeatmapPayloads(channel));
  if (channelUsesBoardHeatmap(channel) && boards.length > 0) {
    return { boards, liveMarket: emptyLiveMarket() };
  }
  const market = await getRankings().catch(() => EMPTY_MARKET());
  return {
    boards,
    liveMarket: channelLiveMarket(market, channel, boards),
  };
}
