import { cache } from "react";
import { computeBoardIndex } from "@/lib/boards/board-index";
import { deriveDemographics, isUnusableRankName } from "@/lib/boards/demographics";
import {
  toHeatmapPayload,
  type HeatmapBoardPayload,
} from "@/lib/boards/heatmap";
import { liveEntityTypesForBoard } from "@/lib/boards/entity-type";
import { isLikelyCelebrityName } from "@/lib/boards/celebrity";
import { matchPoliticsYoutubeSeed } from "@/lib/politics/youtube-seeds";
import {
  isLikelyKpopIdol,
  isLikelyTrotArtist,
  passesKpopTrotBoardFilter,
} from "@/lib/boards/trot";
import { rankLimitForBoard } from "@/lib/boards/limits";
import {
  HEATMAP_SCREEN_LIVE_CAP,
  isNativeChartBoard,
} from "@/lib/boards/live-priority";
import { menuBoardsForChannel, isHeadlineNewsBoard } from "@/lib/boards/registry";
import { seedBoardIfMissing } from "@/lib/boards/seed";
import { normalizeCachedBoard } from "@/lib/boards/store";
import type { BoardDefinition, BoardRankEntry, CachedBoard } from "@/lib/boards/types";
import { COMPOSITE_INDEX_ID } from "@/lib/ingestion/composite";
import { snapshotToPayload } from "@/lib/ingestion/compose";
import { readPersistedSnapshot } from "@/lib/ingestion/job";
import { sanitizeTicketEntityName } from "@/lib/ingestion/sources/tickets";
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

function sanitizeLiveBoardName(slug: string, name: string): string {
  if (
    slug === "performance-ticket-ranking" ||
    slug === "exhibition-popup-ranking" ||
    slug.startsWith("performance-ticket-ranking") ||
    slug.startsWith("exhibition-popup-ranking")
  ) {
    return sanitizeTicketEntityName(name);
  }
  return name;
}

/**
 * Prefer live ingest chart rows for boards that map to snapshot entity types,
 * or board-slug-tagged live-chart rows (tickets, bestsellers, etc.).
 *
 * Native chart boards (music/webtoon/movie/TV/games): typed API rows lead;
 * category-live only fills name gaps. Other boards keep board-tagged live first.
 * Server-only — keeps fs-backed snapshot reads out of client bundles.
 */
function itemToRankEntry(
  def: BoardDefinition,
  item: RankingEntity,
  index: number,
): BoardRankEntry {
  return {
    rank: index + 1,
    name: sanitizeLiveBoardName(def.slug, item.name),
    score: Number(
      Math.min(99.5, Math.max(12, item.buzzScore > 120 ? item.buzzScore / 10 : item.buzzScore)).toFixed(
        2,
      ),
    ),
    changeRate: Number((item.fluctuationRate ?? 0).toFixed(2)),
    note: item.summary?.slice(0, 80) || `${def.shortTitle} 실시간 ${index + 1}위`,
  };
}

function passesBoardLiveFilter(def: BoardDefinition, item: RankingEntity): boolean {
  if (def.slug === "star-reputation-index" || item.type === "celebrity") {
    return isLikelyCelebrityName(item.name);
  }
  if (
    def.slug === "political-pundit-ranking" &&
    matchPoliticsYoutubeSeed(item.name)?.influencer
  ) {
    return false;
  }
  if (def.slug === "trot-kayo-fandom-power" && item.type === "trot") {
    return !isLikelyKpopIdol(item.name) || isLikelyTrotArtist(item.name);
  }
  if (def.slug === "kpop-fandom-power" && item.type === "kpop") {
    return !isLikelyTrotArtist(item.name);
  }
  return passesKpopTrotBoardFilter(def.slug, item.name);
}

function collectTypedLiveItems(
  def: BoardDefinition,
  snapshot: NonNullable<ReturnType<typeof readPersistedSnapshot>>,
): RankingEntity[] {
  const types = liveEntityTypesForBoard(def.slug);
  if (!types.length) return [];
  const typeSet = new Set(types);
  return snapshot.items
    .filter((item) => typeSet.has(item.type))
    .filter((item) => passesBoardLiveFilter(def, item))
    .sort((a, b) => a.rank - b.rank || b.buzzScore - a.buzzScore);
}

function collectBoardTaggedLiveItems(
  def: BoardDefinition,
  snapshot: NonNullable<ReturnType<typeof readPersistedSnapshot>>,
): RankingEntity[] {
  return snapshot.items
    .filter(
      (item) =>
        item.tags?.includes(def.slug) &&
        (item.tags.includes("live-chart") || item.slug.startsWith(`${def.slug}--`)),
    )
    .filter((item) => passesBoardLiveFilter(def, item))
    .sort((a, b) => a.rank - b.rank || b.buzzScore - a.buzzScore);
}

function dedupeLiveItemsToRanking(
  def: BoardDefinition,
  items: RankingEntity[],
  limit: number,
): BoardRankEntry[] {
  const seen = new Set<string>();
  const rows: BoardRankEntry[] = [];
  for (const item of items) {
    if (rows.length >= limit) break;
    const name = sanitizeLiveBoardName(def.slug, item.name);
    if (!name || name.length < 2 || isUnusableRankName(name)) continue;
    const key = name.replace(/\s+/g, "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push(itemToRankEntry(def, item, rows.length));
  }
  return rows;
}

function liveRankingForBoard(
  def: BoardDefinition,
  snapshot: ReturnType<typeof readPersistedSnapshot>,
): BoardRankEntry[] | undefined {
  if (!snapshot?.items?.length) return undefined;
  const limit = rankLimitForBoard(def);
  const typed = collectTypedLiveItems(def, snapshot);
  const tagged = collectBoardTaggedLiveItems(def, snapshot);

  // Native charts: Melon/Naver/KOBIS/Nielsen/games first; category-live fills gaps only.
  if (isNativeChartBoard(def.slug)) {
    const rows = dedupeLiveItemsToRanking(def, [...typed, ...tagged], limit);
    return rows.length >= MIN_LIVE_BOARD_ROWS ? rows : undefined;
  }
  // Non-native with a strong typed pool: typed → tagged gaps (never tagged-only wipe).
  if (typed.length >= MIN_LIVE_BOARD_ROWS) {
    const rows = dedupeLiveItemsToRanking(def, [...typed, ...tagged], limit);
    return rows.length >= MIN_LIVE_BOARD_ROWS ? rows : undefined;
  }

  // Menu boards without native charts: board-tagged live-chart still leads.
  if (tagged.length >= MIN_LIVE_BOARD_ROWS) {
    const rows = dedupeLiveItemsToRanking(def, tagged, limit);
    if (rows.length >= MIN_LIVE_BOARD_ROWS) {
      // P1-5: when tagged head is thin vs screen cap, backfill typed names before seed.
      if (rows.length < HEATMAP_SCREEN_LIVE_CAP && typed.length) {
        return dedupeLiveItemsToRanking(def, [...tagged, ...typed], limit);
      }
      return rows;
    }
  }

  const typedRows = dedupeLiveItemsToRanking(def, typed, limit);
  return typedRows.length >= MIN_LIVE_BOARD_ROWS ? typedRows : undefined;
}

function mergeLiveBoardRanking(
  live: BoardRankEntry[],
  cached: CachedBoard,
  limit: number,
): BoardRankEntry[] {
  const nameKey = (name: string) => name.replace(/\s+/g, "").toLowerCase();
  const seen = new Set<string>();
  const merged: BoardRankEntry[] = [];
  const push = (row: BoardRankEntry) => {
    const name = (row.name ?? "").trim();
    if (!name || isUnusableRankName(name)) return;
    const key = nameKey(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push({ ...row, name, rank: merged.length + 1 });
  };
  for (const row of live) {
    if (merged.length >= limit) break;
    push(row);
  }
  for (const row of cached.ranking ?? []) {
    if (merged.length >= limit) break;
    push(row);
  }
  return merged;
}

function withLiveChartOverlay(
  def: BoardDefinition,
  cached: CachedBoard,
  snapshot: ReturnType<typeof readPersistedSnapshot>,
): HeatmapBoardPayload {
  const live = liveRankingForBoard(def, snapshot);
  if (!live) return toHeatmapPayload(def, cached);
  const limit = rankLimitForBoard(def);
  // Live leads, then pad with cached/seed ranking so heatmaps still fill 20 tiles.
  const merged = mergeLiveBoardRanking(live, cached, limit);
  const overlay = normalizeCachedBoard({
    ...cached,
    ranking: merged,
    demographics: deriveDemographics(merged, def),
  });
  const index = computeBoardIndex(overlay.ranking, def.slug);
  return toHeatmapPayload(def, {
    ...overlay,
    indexValue: index.value,
    indexChangeRate: index.changeRate,
  });
}

/** Process-local slim live tape — avoid re-mapping 1k fat entities per call. */
let livePayloadMemo: { key: string; payload: RankingsPayload } | undefined;

/**
 * Ingest snapshot as a rankings payload for heatmap assembly.
 * Prefer this over getRankings() so heatmaps track committed crawls even when
 * TRENDS_DATA_SOURCE=mock locally.
 *
 * Items are slimmed via `toTileEntity` (no analysis/products/history) and the
 * result is memoized for the snapshot generation so landing/category cold
 * paths do not re-walk ~4MB of fat entity fields on every call.
 */
export function loadHeatmapLivePayload(): RankingsPayload | undefined {
  const snapshot = readPersistedSnapshot();
  if (!snapshot?.items?.length) return undefined;
  const key = `${snapshot.updatedAt}:${snapshot.items.length}`;
  if (livePayloadMemo?.key === key) return livePayloadMemo.payload;
  const payload: RankingsPayload = {
    ...snapshotToPayload(snapshot),
    items: snapshot.items.map((item) => toTileEntity(attachTimeframeMetrics(item))),
  };
  livePayloadMemo = { key, payload };
  return payload;
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
  const name =
    entity.type === "performance" || entity.type === "exhibition"
      ? sanitizeTicketEntityName(entity.name)
      : entity.name;
  // Keep full timeframe metrics when present so desk/landing 3m·5m ranking
  // uses stable ingest rates instead of refreshBucket jitter after slim.
  const metrics = entity.metrics;
  return {
    id: entity.id,
    slug: entity.slug,
    name,
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
    summary: entity.summary
      ? (entity.summary.includes("posterImageUrl") ? `${name} 실시간 티켓` : entity.summary).slice(0, 96)
      : "",
    metrics,
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
  livePayloadMemo = undefined;
}
