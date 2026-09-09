import { cache } from "react";
import { computeBoardIndex } from "@/lib/boards/board-index";
import { deriveDemographics } from "@/lib/boards/demographics";
import {
  toHeatmapPayload,
  type HeatmapBoardPayload,
} from "@/lib/boards/heatmap";
import { liveEntityTypesForBoard } from "@/lib/boards/entity-type";
import { rankLimitForBoard } from "@/lib/boards/limits";
import { menuBoardsForChannel, isHeadlineNewsBoard } from "@/lib/boards/registry";
import { seedBoardIfMissing } from "@/lib/boards/seed";
import type { BoardDefinition, BoardRankEntry, CachedBoard } from "@/lib/boards/types";
import { COMPOSITE_INDEX_ID } from "@/lib/ingestion/composite";
import { snapshotToPayload } from "@/lib/ingestion/compose";
import { readPersistedSnapshot } from "@/lib/ingestion/job";
import { itemsForChannel } from "@/lib/posts/channels";
import { isPoliticsIndex } from "@/lib/politics/types";
import type { ChannelLiveMarket } from "@/components/dashboard/ChannelMarketDesk";
import type { PostChannel } from "@/lib/posts/types";
import { attachTimeframeMetrics } from "@/lib/timeframes";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

/** Process-local board payload memo (survives across RSC requests in `next dev`). */
const CHANNEL_BOARD_MEMO = new Map<string, { at: number; payloads: HeatmapBoardPayload[] }>();
const CHANNEL_BOARD_TTL_MS = 180_000;

/** Minimum live rows before a board seed list is replaced. */
const MIN_LIVE_BOARD_ROWS = 3;

/**
 * Prefer live ingest chart rows for boards that map to snapshot entity types,
 * or board-slug-tagged live-chart rows (tickets, bestsellers, etc.).
 * Server-only — keeps fs-backed snapshot reads out of client bundles.
 */
function liveRankingForBoard(
  def: BoardDefinition,
  snapshot: ReturnType<typeof readPersistedSnapshot>,
): BoardRankEntry[] | undefined {
  if (!snapshot?.items?.length) return undefined;
  const limit = rankLimitForBoard(def);

  const boardTagged = snapshot.items
    .filter(
      (item) =>
        item.tags?.includes(def.slug) &&
        (item.tags.includes("live-chart") || item.slug.startsWith(`${def.slug}--`)),
    )
    .sort((a, b) => a.rank - b.rank || b.buzzScore - a.buzzScore);
  if (boardTagged.length >= MIN_LIVE_BOARD_ROWS) {
    const seen = new Set<string>();
    return boardTagged
      .filter((item) => {
        const key = (item.name ?? "").replace(/\s+/g, "").toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
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
  }

  const types = liveEntityTypesForBoard(def.slug);
  if (!types.length) return undefined;
  const typeSet = new Set(types);
  const seen = new Set<string>();
  const rows = snapshot.items
    .filter((item) => typeSet.has(item.type))
    .sort((a, b) => a.rank - b.rank || b.buzzScore - a.buzzScore)
    .filter((item) => {
      const key = (item.name ?? "").replace(/\s+/g, "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
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
  return rows.length >= MIN_LIVE_BOARD_ROWS ? rows : undefined;
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

/**
 * Ingest snapshot as a rankings payload for heatmap assembly.
 * Prefer this over getRankings() so heatmaps track committed crawls even when
 * TRENDS_DATA_SOURCE=mock locally.
 */
export function loadHeatmapLivePayload(): RankingsPayload | undefined {
  const snapshot = readPersistedSnapshot();
  if (!snapshot?.items?.length) return undefined;
  return {
    ...snapshotToPayload(snapshot),
    items: snapshot.items.map(attachTimeframeMetrics),
  };
}

async function loadChannelHeatmapPayloadsUncached(
  channel: PostChannel,
): Promise<HeatmapBoardPayload[]> {
  const defs = menuBoardsForChannel(channel).filter(
    (board) => !board.deskKind && !isHeadlineNewsBoard(board.slug),
  );
  const snapshot = readPersistedSnapshot();
  const payloads: HeatmapBoardPayload[] = [];
  // Seed boards in parallel — sequential await was a major homepage cost.
  const settled = await Promise.all(
    defs.map(async (def) => {
      try {
        const cached = await seedBoardIfMissing(def);
        return withLiveChartOverlay(def, cached, snapshot);
      } catch {
        return null;
      }
    }),
  );
  for (const row of settled) {
    if (row) payloads.push(row);
  }
  return payloads;
}

export const loadChannelHeatmapPayloads = cache(async (channel: PostChannel): Promise<HeatmapBoardPayload[]> => {
  const hit = CHANNEL_BOARD_MEMO.get(channel);
  if (hit && Date.now() - hit.at < CHANNEL_BOARD_TTL_MS) {
    return hit.payloads;
  }
  const payloads = await loadChannelHeatmapPayloadsUncached(channel);
  CHANNEL_BOARD_MEMO.set(channel, { at: Date.now(), payloads });
  return payloads;
});

/**
 * Drops the fields a heatmap tile never reads.
 *
 * `analysis` is a full paragraph and `products` a three-card affiliate shelf,
 * both written for `/ranking/[slug]`. Desk tiles only need name, score, rate,
 * a short summary, and enough sparkline for hover — ship those only.
 */
export function toTileEntity(entity: RankingEntity): RankingEntity {
  const metric3m = entity.metrics?.["3m"];
  return {
    id: entity.id,
    slug: entity.slug,
    name: entity.name,
    nameEn: entity.nameEn || "",
    type: entity.type,
    rank: entity.rank,
    previousRank: entity.previousRank,
    buzzScore: entity.buzzScore,
    openScore: entity.openScore,
    fluctuationRate: entity.fluctuationRate,
    volume: entity.volume,
    sparkline: Array.isArray(entity.sparkline) ? entity.sparkline.slice(-8) : [],
    history: [],
    tags: Array.isArray(entity.tags) ? entity.tags.slice(0, 4) : [],
    summary: entity.summary ? entity.summary.slice(0, 96) : "",
    metrics: metric3m ? ({ "3m": metric3m } as RankingEntity["metrics"]) : undefined,
    measurement: entity.measurement,
    href: entity.href,
    heatmapGroup: entity.heatmapGroup,
    platform: entity.platform,
    region: entity.region,
    sourceChannel: entity.sourceChannel,
  };
}

/**
 * Cuts the live rankings down to what the desk actually paints.
 *
 * Board-driven desks still receive live items when the ingest snapshot has
 * coverage for that channel — composite heatmaps prefer them; board tabs keep
 * seed shells with live overlays applied in `loadChannelHeatmapPayloads`.
 */
export function channelLiveMarket(
  payload: RankingsPayload,
  channel: PostChannel,
  _boards: HeatmapBoardPayload[] = [],
): ChannelLiveMarket {
  const indices =
    channel === "politics"
      ? [
          ...payload.indices.filter((index) => index.id === COMPOSITE_INDEX_ID),
          ...payload.indices.filter(isPoliticsIndex),
        ]
      : payload.indices.filter((index) => !isPoliticsIndex(index));

  return {
    updatedAt: payload.updatedAt,
    status: payload.status,
    items: itemsForChannel(payload.items ?? [], channel).map(toTileEntity),
    indices,
  };
}

/** Drop process memo (tests / after ingest). */
export function clearChannelHeatmapMemo(): void {
  CHANNEL_BOARD_MEMO.clear();
}
