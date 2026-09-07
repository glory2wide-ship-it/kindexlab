import { getChannelBriefingEdition, getRankings, splitChannelEdition } from "@/lib/api";
import { buildHeatmapItems, stripBoardDemographics, type HeatmapBoardPayload } from "@/lib/boards/heatmap";
import { channelLiveMarket, loadChannelHeatmapPayloads, toTileEntity } from "@/lib/boards/heatmap-server";
import { channelUsesBoardHeatmap } from "@/lib/boards/limits";
import { slimBriefingForCard, slimBriefingsForCards } from "@/lib/briefing/card-dto";
import { COMMODITIES_FX_BOARD_SLUG } from "@/lib/market/market-index-codes";
import {
  attachKospiStockQuotes,
  isMarketQuoteBoardSlug,
} from "@/lib/market/kospi-quotes";
import {
  KOSPI_STOCK_BOARD_SLUG,
  OVERSEAS_STOCK_BOARD_SLUG,
} from "@/lib/market/stock-codes";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

/** Boards that must paint Naver quotes on first frame (never KinDex-only). */
export const MARKET_QUOTE_BOARD_SLUGS = [
  KOSPI_STOCK_BOARD_SLUG,
  OVERSEAS_STOCK_BOARD_SLUG,
  COMMODITIES_FX_BOARD_SLUG,
] as const;

export { isMarketQuoteBoardSlug };

/** Heatmap rows for one board (or channel 종합) — quotes applied in a later batch. */
function rawHeatmapItems(
  channel: PostChannel,
  boards: HeatmapBoardPayload[],
  liveItems: RankingEntity[],
  board?: string,
): RankingEntity[] {
  const boardDriven = channelUsesBoardHeatmap(channel) && boards.length > 0;
  return buildHeatmapItems({
    boards,
    liveItems,
    board,
    gender: "all",
    age: "all",
    preferLive: !boardDriven && !board,
  });
}

/**
 * Preload 종합 + 주식/해외/원자재·환율 so tab switches never flash KinDex scores.
 * Key `""` is the channel composite.
 *
 * Builds every board's rows first, then one Naver quote pass over unique
 * entities — avoids N parallel quote crawls that serialized on the finance host.
 */
async function loadQuotedItemsByBoard(
  channel: PostChannel,
  boards: HeatmapBoardPayload[],
  liveItems: RankingEntity[],
): Promise<Record<string, RankingEntity[]>> {
  const quoteBoards = MARKET_QUOTE_BOARD_SLUGS.filter((slug) =>
    boards.some((board) => board.slug === slug),
  );
  const keys = quoteBoards.length ? (["", ...quoteBoards] as string[]) : [""];
  const rawEntries = keys.map((key) => {
    const rows = rawHeatmapItems(channel, boards, liveItems, key || undefined);
    return [key, rows] as const;
  });

  const unique = [
    ...new Map(rawEntries.flatMap(([, rows]) => rows).map((row) => [row.id, row])).values(),
  ];
  const quoted = unique.length ? await attachKospiStockQuotes(unique) : [];
  const byId = new Map(quoted.map((row) => [row.id, row]));

  const map: Record<string, RankingEntity[]> = {};
  for (const [key, rows] of rawEntries) {
    if (!rows.length) continue;
    map[key] = rows.map((row) => toTileEntity(byId.get(row.id) ?? row));
  }
  return map;
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
  const initialQuotedByBoard = await loadQuotedItemsByBoard(channel, boards, liveMarket.items);
  const initialItems = initialQuotedByBoard[""] ?? [];

  return {
    boards,
    liveMarket,
    initialItems,
    initialQuotedByBoard,
    main: split.main ? slimBriefingForCard(split.main) : undefined,
    dives: slimBriefingsForCards(split.dives ?? []),
  };
}

/** Desk-only bootstrap when briefing loads in a separate Suspense boundary. */
export async function loadChannelDeskData(channel: PostChannel) {
  const boards = stripBoardDemographics(await loadChannelHeatmapPayloads(channel));
  if (channelUsesBoardHeatmap(channel) && boards.length > 0) {
    const liveMarket = emptyLiveMarket();
    const initialQuotedByBoard = await loadQuotedItemsByBoard(channel, boards, liveMarket.items);
    return {
      boards,
      liveMarket,
      initialItems: initialQuotedByBoard[""] ?? [],
      initialQuotedByBoard,
    };
  }
  const market = await getRankings().catch(() => EMPTY_MARKET());
  const liveMarket = channelLiveMarket(market, channel, boards);
  const initialQuotedByBoard = await loadQuotedItemsByBoard(channel, boards, liveMarket.items);
  return {
    boards,
    liveMarket,
    initialItems: initialQuotedByBoard[""] ?? [],
    initialQuotedByBoard,
  };
}
