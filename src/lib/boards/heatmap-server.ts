import { menuBoardsForChannel } from "@/lib/boards/registry";
import { toHeatmapPayload, type HeatmapBoardPayload } from "@/lib/boards/heatmap";
import { channelUsesBoardHeatmap } from "@/lib/boards/limits";
import { seedBoardIfMissing } from "@/lib/boards/seed";
import { itemsForChannel } from "@/lib/posts/channels";
import { isPoliticsIndex } from "@/lib/politics/types";
import { COMPOSITE_INDEX_ID } from "@/lib/ingestion/composite";
import type { ChannelLiveMarket } from "@/components/dashboard/ChannelMarketDesk";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

export async function loadChannelHeatmapPayloads(
  channel: PostChannel,
): Promise<HeatmapBoardPayload[]> {
  const defs = menuBoardsForChannel(channel).filter((board) => !board.deskKind);
  const payloads: HeatmapBoardPayload[] = [];
  for (const def of defs) {
    try {
      const cached = await seedBoardIfMissing(def);
      payloads.push(toHeatmapPayload(def, cached));
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
