import { computeBoardIndex } from "@/lib/boards/board-index";
import { deriveDemographics } from "@/lib/boards/demographics";
import {
  entityTypeForBoardSlug,
  toHeatmapPayload,
  type HeatmapBoardPayload,
} from "@/lib/boards/heatmap";
import { rankLimitForBoard } from "@/lib/boards/limits";
import { menuBoardsForChannel, isHeadlineNewsBoard } from "@/lib/boards/registry";
import { channelUsesBoardHeatmap } from "@/lib/boards/limits";
import { seedBoardIfMissing } from "@/lib/boards/seed";
import type { BoardDefinition, BoardRankEntry, CachedBoard } from "@/lib/boards/types";
import { COMPOSITE_INDEX_ID } from "@/lib/ingestion/composite";
import { readPersistedSnapshot } from "@/lib/ingestion/job";
import { itemsForChannel } from "@/lib/posts/channels";
import { isPoliticsIndex } from "@/lib/politics/types";
import type { ChannelLiveMarket } from "@/components/dashboard/ChannelMarketDesk";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

/**
 * Prefer live ingest chart rows for music / movie boards so heatmaps track crawls.
 * Server-only — keeps fs-backed snapshot reads out of client bundles.
 */
function liveRankingForBoard(
  def: BoardDefinition,
  snapshot: ReturnType<typeof readPersistedSnapshot>,
): BoardRankEntry[] | undefined {
  const type = entityTypeForBoardSlug(def.slug);
  if (type !== "music_chart" && type !== "movie") return undefined;
  if (!snapshot?.items?.length) return undefined;
  const limit = rankLimitForBoard(def);
  const rows = snapshot.items
    .filter((item) => item.type === type)
    .sort((a, b) => a.rank - b.rank || b.buzzScore - a.buzzScore)
    .slice(0, limit)
    .map((item, index) => ({
      rank: index + 1,
      name: item.name,
      score: Number(
        Math.min(99.5, Math.max(12, item.buzzScore > 120 ? item.buzzScore / 10 : item.buzzScore)).toFixed(
          2,
        ),
      ),
      changeRate: Number((item.fluctuationRate ?? 0).toFixed(2)),
      note: item.summary?.slice(0, 80) || `${def.shortTitle} 실시간 ${index + 1}위`,
    }));
  return rows.length >= 5 ? rows : undefined;
}

function withLiveChartOverlay(
  def: BoardDefinition,
  cached: CachedBoard,
  snapshot: ReturnType<typeof readPersistedSnapshot>,
): HeatmapBoardPayload {
  const live = liveRankingForBoard(def, snapshot);
  if (!live) return toHeatmapPayload(def, cached);
  const overlay: CachedBoard = {
    ...cached,
    ranking: live,
    demographics: deriveDemographics(live, def),
  };
  const index = computeBoardIndex(live, def.slug);
  overlay.indexValue = index.value;
  overlay.indexChangeRate = index.changeRate;
  return toHeatmapPayload(def, overlay);
}

export async function loadChannelHeatmapPayloads(
  channel: PostChannel,
): Promise<HeatmapBoardPayload[]> {
  const defs = menuBoardsForChannel(channel).filter(
    (board) => !board.deskKind && !isHeadlineNewsBoard(board.slug),
  );
  const snapshot = readPersistedSnapshot();
  const payloads: HeatmapBoardPayload[] = [];
  for (const def of defs) {
    try {
      const cached = await seedBoardIfMissing(def);
      payloads.push(withLiveChartOverlay(def, cached, snapshot));
    } catch {
      /* skip a board that cannot be seeded; the rest still render */
    }
  }
  return payloads;
}

/**
 * Drops the fields a heatmap tile never reads.
 *
 * `analysis` is a full paragraph and `products` a three-card affiliate shelf,
 * both written for `/ranking/[slug]`. Nothing under `ChannelMarketDesk` touches
 * either — the tiles need name, score, rate and `summary` for the hover card —
 * so on the desks that do ship entities they were pure transfer cost.
 */
export function toTileEntity({
  analysis: _analysis,
  products: _products,
  ...entity
}: RankingEntity): RankingEntity {
  return entity;
}

/**
 * Cuts the live rankings down to what the desk actually paints.
 *
 * This filtering used to happen inside the client component, which meant the
 * whole cross-channel payload had to be shipped first. Doing it here is the
 * same arithmetic against a payload that never leaves the server.
 *
 * The entity list is dropped outright on the board-driven channels. There
 * `buildHeatmapItems` runs with `preferLive: false` and a non-empty board list,
 * so it returns board rows on every path and never reads `liveItems` — the
 * array was serialised into the RSC stream and discarded on arrival. It is
 * still sent when the boards fail to seed, which is the one case the client
 * falls back to it.
 */
export function channelLiveMarket(
  payload: RankingsPayload,
  channel: PostChannel,
  boards: HeatmapBoardPayload[] = [],
): ChannelLiveMarket {
  const indices =
    channel === "politics"
      ? [
          ...payload.indices.filter((index) => index.id === COMPOSITE_INDEX_ID),
          ...payload.indices.filter(isPoliticsIndex),
        ]
      : payload.indices.filter((index) => !isPoliticsIndex(index));

  const boardDriven = channelUsesBoardHeatmap(channel) && boards.length > 0;

  return {
    updatedAt: payload.updatedAt,
    status: payload.status,
    items: boardDriven ? [] : itemsForChannel(payload.items ?? [], channel).map(toTileEntity),
    indices,
  };
}
