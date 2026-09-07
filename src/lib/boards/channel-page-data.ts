import { getChannelBriefingEdition, getRankings, splitChannelEdition } from "@/lib/api";
import { buildHeatmapItems, stripBoardDemographics } from "@/lib/boards/heatmap";
import { channelLiveMarket, loadChannelHeatmapPayloads, toTileEntity } from "@/lib/boards/heatmap-server";
import { channelUsesBoardHeatmap } from "@/lib/boards/limits";
import { slimBriefingForCard, slimBriefingsForCards } from "@/lib/briefing/card-dto";
import { attachKospiStockQuotes } from "@/lib/market/kospi-quotes";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

/** Default 종합 heatmap rows with Naver quotes attached for stock/FX boards. */
async function quotedDefaultHeatmapItems(
  channel: PostChannel,
  boards: Awaited<ReturnType<typeof loadChannelHeatmapPayloads>>,
  liveItems: RankingEntity[],
): Promise<RankingEntity[]> {
  const boardDriven = channelUsesBoardHeatmap(channel) && boards.length > 0;
  const raw = buildHeatmapItems({
    boards,
    liveItems,
    gender: "all",
    age: "all",
    preferLive: !boardDriven,
  });
  return (await attachKospiStockQuotes(raw)).map(toTileEntity);
}

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

  const liveMarket = boardDriven
    ? emptyLiveMarket()
    : channelLiveMarket(market, channel, boards);
  const initialItems = await quotedDefaultHeatmapItems(channel, boards, liveMarket.items);

  return {
    boards,
    liveMarket,
    initialItems,
    main: split.main ? slimBriefingForCard(split.main) : undefined,
    dives: slimBriefingsForCards(split.dives ?? []),
  };
}

/** Desk-only bootstrap when briefing loads in a separate Suspense boundary. */
export async function loadChannelDeskData(channel: PostChannel) {
  const boards = stripBoardDemographics(await loadChannelHeatmapPayloads(channel));
  if (channelUsesBoardHeatmap(channel) && boards.length > 0) {
    const liveMarket = emptyLiveMarket();
    const initialItems = await quotedDefaultHeatmapItems(channel, boards, liveMarket.items);
    return { boards, liveMarket, initialItems };
  }
  const market = await getRankings().catch(() => EMPTY_MARKET());
  const liveMarket = channelLiveMarket(market, channel, boards);
  const initialItems = await quotedDefaultHeatmapItems(channel, boards, liveMarket.items);
  return {
    boards,
    liveMarket,
    initialItems,
  };
}
