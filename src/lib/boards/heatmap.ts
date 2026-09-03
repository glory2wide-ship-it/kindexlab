import { rankingPath } from "@/lib/slugs";
import { LIVE_INDEX_LABEL } from "@/lib/posts/channels";
import { computeBoardIndex, toneRankEntry } from "@/lib/boards/board-index";
import { dropNamesForFilter, deriveDemographics, selectRanking } from "@/lib/boards/demographics";
import {
  compositePerBoard,
  rankLimitForBoard,
  rankLimitForChannel,
} from "@/lib/boards/limits";
import {
  boardUsesRegionFilter,
  deriveRegionRankings,
  ensureFoodRestaurantRanking,
  ensureHousingApartmentRanking,
  filterRowsByRegion,
  HOUSING_BOARD_SLUG,
  padRankEntries,
  padRegionOnly,
  regionFromName,
  REGION_LABEL,
} from "@/lib/boards/regions";
import type {
  AgeSegment,
  BoardDefinition,
  BoardRankEntry,
  CachedBoard,
  DemographicRanking,
  GenderSegment,
  RegionSegment,
} from "@/lib/boards/types";
import type { PostChannel } from "@/lib/posts/types";
import { platformForGame } from "@/lib/boards/game-platforms";
import {
  ensureCultureGrantRanking,
  isCultureGrantBoard,
} from "@/lib/boards/culture-grants";
import { entityTypeForBoardSlug } from "@/lib/boards/entity-type";
import {
  ensureTravelGrantRanking,
  isTravelGrantBoard,
} from "@/lib/boards/travel-grants";
import { ensureInfluencerBoardRanking } from "@/lib/politics/fail-safe";
import {
  ensureLocalPolicyRanking,
  ensurePunditRanking,
  ensureSubsidyRanking,
  labeledNameEn,
} from "@/lib/politics/labeled-rank";
import { influencerSeedNames } from "@/lib/politics/youtube-seeds";
import { namesOverlap } from "@/lib/ingestion/names";
import { attachTimeframeMetrics } from "@/lib/timeframes";
import type { EntityType, RankingEntity } from "@/lib/types";

export { entityTypeForBoardSlug } from "@/lib/boards/entity-type";

export interface HeatmapBoardPayload {
  slug: string;
  title: string;
  shortTitle: string;
  channel: PostChannel;
  ranking: BoardRankEntry[];
  /**
   * Absent on payloads handed to the browser. See `stripBoardDemographics`:
   * every gender/age/region permutation of a board is larger than the board
   * itself, and the client only needs it to paint one optimistic frame.
   */
  demographics?: DemographicRanking;
  indexValue: number;
  indexChangeRate: number;
  unitLabel: string;
  demographicExclude?: BoardDefinition["demographicExclude"];
}

export type HeatmapGender = "all" | GenderSegment;
export type HeatmapAge = "all" | AgeSegment;
export type HeatmapRegion = "all" | RegionSegment;

function normalizeBoardRanking(def: BoardDefinition, rows: BoardRankEntry[]): BoardRankEntry[] {
  if (def.slug === "political-influencer-power") return ensureInfluencerBoardRanking(rows);
  if (def.slug === "governor-approval-index") return ensureLocalPolicyRanking(rows);
  if (def.slug === "government-support-fund" || def.slug === "government-subsidy-search") {
    return ensureSubsidyRanking(rows);
  }
  if (isCultureGrantBoard(def.slug)) return ensureCultureGrantRanking(rows);
  if (isTravelGrantBoard(def.slug)) return ensureTravelGrantRanking(rows);
  if (def.slug === "political-pundit-ranking") return ensurePunditRanking(rows);
  if (def.slug === HOUSING_BOARD_SLUG) {
    return ensureHousingApartmentRanking(rows, rankLimitForChannel(def.channel));
  }
  if (boardUsesRegionFilter(def.slug)) {
    return ensureFoodRestaurantRanking(rows, def.seeds);
  }
  return rows;
}

export function toHeatmapPayload(def: BoardDefinition, cached: CachedBoard): HeatmapBoardPayload {
  const source = cached.ranking ?? [];
  const ranking = normalizeBoardRanking(def, source);
  const namesChanged =
    ranking.length !== source.length || ranking.some((row, index) => row.name !== source[index]?.name);
  const seedsMissing =
    def.slug === "political-influencer-power" &&
    influencerSeedNames().some((name) => !ranking.some((row) => namesOverlap(row.name, name)));
  // Culture grants must always re-slice demographics after travel rows are stripped,
  // otherwise stale demographic tables keep 여행 정부지원금 names on the heatmap.
  const demographics =
    isCultureGrantBoard(def.slug) || namesChanged || seedsMissing
      ? deriveDemographics(ranking, def)
      : cached.demographics;
  const index = computeBoardIndex(ranking, def.slug);
  return {
    slug: cached.slug,
    title: def.title,
    shortTitle: def.shortTitle,
    channel: cached.channel,
    ranking,
    demographics:
      boardUsesRegionFilter(def.slug)
        ? {
            ...demographics,
            region: deriveRegionRankings(ranking, rankLimitForChannel(def.channel), def.slug),
          }
        : demographics,
    indexValue: index.value,
    indexChangeRate: index.changeRate,
    unitLabel: def.unitLabel,
    demographicExclude: def.demographicExclude,
  };
}

function entityTypeForBoard(board: HeatmapBoardPayload): EntityType {
  return (
    entityTypeForBoardSlug(board.slug) ??
    (board.channel === "economy"
      ? "economy_board"
      : board.channel === "culture" || board.channel === "travel"
        ? "culture_board"
        : board.channel === "politics"
          ? "political_search"
          : "influencer")
  );
}

export function boardRowSlug(boardSlug: string, name: string): string {
  return `${boardSlug}--${slugify(name) || "item"}`;
}

/**
 * Drops the bracketed qualifier some boards prefix to a row name —
 * "[보건복지부] 부모급여", "[서울] 광장시장 마약김밥". The bracket tells a reader
 * scanning a board who runs the programme or where the place is, but it is not
 * part of the subject, so anything searching on the name (news retrieval,
 * product lookups) wants it removed.
 */
export function stripRowQualifier(name: string): string {
  const match = name.trim().match(/^\[[^\]]+\]\s*(.+)$/);
  return match?.[1]?.trim() || name.trim();
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-]/g, "")
    .slice(0, 48);
}

export function rankRowsToEntities(
  rows: BoardRankEntry[],
  board: HeatmapBoardPayload,
): RankingEntity[] {
  const type = entityTypeForBoard(board);
  return (rows ?? []).map((row, index) => {
    const toned = toneRankEntry(
      {
        ...row,
        rank: row.rank || index + 1,
        score: Number.isFinite(row.score) && row.score > 0 ? row.score : 12,
        changeRate: Number.isFinite(row.changeRate) ? row.changeRate : 0,
      },
      board.slug,
    );
    const score = toned.score;
    const change = toned.changeRate;
    const rank = toned.rank || index + 1;
    const spark = Array.from({ length: 12 }, (_, step) =>
      Number((score * 10 * (1 + (change / 100) * ((step - 5) / 12))).toFixed(2)),
    );
    const platform = board.slug === "game-esports-ranking" ? platformForGame(row.name) : undefined;
    const context = labeledNameEn(row.name, board.shortTitle);
    const href = rankingPath(boardRowSlug(board.slug, row.name || ""));
    const region = row.region ?? regionFromName(row.name || "");
    const regionTag = region ? REGION_LABEL[region] : undefined;
    const tags = (
      platform
        ? [platform, context, board.unitLabel, regionTag]
        : [context, board.shortTitle, board.unitLabel, regionTag]
    ).filter((tag, i, all): tag is string => Boolean(tag) && all.indexOf(tag) === i);
    return attachTimeframeMetrics({
      id: `board:${board.slug}:${slugify(row.name) || index}`,
      slug: boardRowSlug(board.slug, row.name || String(index)),
      name: row.name || "집계 중",
      nameEn: context,
      type,
      rank,
      previousRank: rank,
      buzzScore: Number((score * 10).toFixed(2)),
      openScore: Number((score * 10).toFixed(2)),
      fluctuationRate: change,
      volume: Math.max(1, Math.round(score * 80)),
      sparkline: spark,
      history: spark.map((v, step) => ({ t: String(step), v })),
      tags,
      summary: row.note || board.title,
      analysis: row.note || board.title,
      products: [],
      href,
      region,
      heatmapGroup: board.shortTitle,
      platform,
    });
  });
}

/**
 * Drops the segment tables before a payload crosses to the browser.
 *
 * A board serialises to roughly 3 KB of ranking and 11–47 KB of demographics,
 * so the permutations were about 85% of the weight of every channel page. They
 * bought one optimistic frame: `ChannelMarketDesk` calls `/api/heatmap` for the
 * authoritative segment on the very same tick, and `selectRanking` ignores the
 * tables entirely for the default 전체/전체 view that first paint renders. Without
 * them a segment tab paints the unsegmented board for one frame before the API
 * answers, which is what the tab already did on a slow response.
 */
export function stripBoardDemographics(boards: HeatmapBoardPayload[]): HeatmapBoardPayload[] {
  return boards.map(({ demographics: _demographics, ...board }) => board);
}

const NO_DEMOGRAPHICS: DemographicRanking = {
  gender: {} as DemographicRanking["gender"],
  age: {} as DemographicRanking["age"],
};

export function selectHeatmapRows(
  board: HeatmapBoardPayload,
  gender: HeatmapGender,
  age: HeatmapAge,
  limit?: number,
  region: HeatmapRegion = "all",
): BoardRankEntry[] {
  const cap = Math.max(
    1,
    limit ?? rankLimitForBoard({ channel: board.channel, slug: board.slug }, region),
  );
  const ranking = board.ranking ?? [];
  const demographics = board.demographics ?? NO_DEMOGRAPHICS;
  if (board.slug === HOUSING_BOARD_SLUG) {
    if (region !== "all") {
      return padRegionOnly(filterRowsByRegion(ranking, region), region, cap, board.slug);
    }
    return ensureHousingApartmentRanking(ranking, cap);
  }
  if (region !== "all") {
    try {
      const selected = selectRanking(demographics, ranking, gender, age, {
        limit: cap,
        dropNames: dropNamesForFilter(board, gender, age),
        region,
        boardSlug: board.slug,
      });
      const local = filterRowsByRegion(selected, region);
      if (local.length) return padRegionOnly(local, region, cap, board.slug);
    } catch {
      /* same-region catalog still fills the board */
    }
    const cached = filterRowsByRegion(demographics.region?.[region], region);
    const fromTotal = filterRowsByRegion(ranking, region);
    return padRegionOnly(cached.length ? cached : fromTotal, region, cap, board.slug);
  }
  try {
    const selected = selectRanking(demographics, ranking, gender, age, {
      limit: cap,
      dropNames: dropNamesForFilter(board, gender, age),
      region,
      boardSlug: board.slug,
    });
    const blocked = new Set(
      dropNamesForFilter(board, gender, age).map((name) => name.replace(/\s+/g, "").toLowerCase()),
    );
    const usable = (row: BoardRankEntry) => !blocked.has((row.name ?? "").replace(/\s+/g, "").toLowerCase());
    const selectedUsable = selected.filter(usable);
    const rest = ranking.filter(
      (row) => !selectedUsable.some((hit) => hit.name === row.name) && usable(row),
    );
    const padded = padRankEntries(selectedUsable, rest.length ? rest : ranking, cap);
    if (padded.length) return padded;
  } catch {
    /* fall through to seed-safe list */
  }
  return padRankEntries(ranking.filter(Boolean), ranking, cap);
}

/** Round-robin merge so 종합 heatmaps don't let one board crowd out the menu. */
function interleaveHeatmapPools(pools: RankingEntity[][], limit: number): RankingEntity[] {
  const merged: RankingEntity[] = [];
  const cursors = new Array(pools.length).fill(0);
  while (merged.length < limit) {
    let advanced = false;
    for (let i = 0; i < pools.length && merged.length < limit; i += 1) {
      const pool = pools[i];
      const cursor = cursors[i] as number;
      if (!pool || cursor >= pool.length) continue;
      merged.push(pool[cursor]!);
      cursors[i] = cursor + 1;
      advanced = true;
    }
    if (!advanced) break;
  }
  return merged;
}

/**
 * One board's ranking, or a channel composite grouped 1:1 with the board menu.
 * Passing `board: ""` or omitting it builds the composite.
 */
export function buildHeatmapItems({
  boards,
  liveItems,
  board,
  gender,
  age,
  region = "all",
  preferLive = false,
}: {
  boards: HeatmapBoardPayload[];
  liveItems?: RankingEntity[];
  board?: string;
  gender: HeatmapGender;
  age: HeatmapAge;
  region?: HeatmapRegion;
  preferLive?: boolean;
}): RankingEntity[] {
  const selected = board ? boards.find((item) => item.slug === board) : undefined;
  if (board && !selected) {
    return [];
  }
  if (selected) {
    const boardLimit = rankLimitForBoard(
      { channel: selected.channel, slug: selected.slug },
      region,
    );
    const entities = rankRowsToEntities(
      selectHeatmapRows(selected, gender, age, boardLimit, region),
      selected,
    ).slice(0, boardLimit);
    if (region !== "all" && boardUsesRegionFilter(selected.slug)) {
      return entities.filter((item) => item.region === region || regionFromName(item.name) === region);
    }
    return entities;
  }

  if (preferLive && liveItems?.length) {
    return liveItems;
  }

  if (boards.length) {
    const channel = boards[0]?.channel ?? "entertainment";
    const perBoard = compositePerBoard(channel);
    const pools = boards.map((item) => {
      const rows = selectHeatmapRows(item, gender, age, perBoard, region);
      return rankRowsToEntities(rows, item).map((entity, index) => ({
        ...entity,
        rank: index + 1,
        previousRank: index + 1,
        heatmapGroup: item.shortTitle,
      }));
    });
    if (channel === "economy" || channel === "culture" || channel === "travel") {
      const limit = rankLimitForChannel(channel);
      return interleaveHeatmapPools(pools, limit).map((entity, index) => ({
        ...entity,
        rank: index + 1,
        previousRank: index + 1,
      }));
    }
    return pools.flat();
  }

  return liveItems ?? [];
}

export function heatmapBoardTitle(
  boards: HeatmapBoardPayload[],
  board?: string,
): string {
  const selected = board ? boards.find((item) => item.slug === board) : undefined;
  return selected?.title ?? LIVE_INDEX_LABEL;
}
