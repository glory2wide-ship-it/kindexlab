import { buildHeatmapItems } from "@/lib/boards/heatmap";
import { loadChannelHeatmapPayloads } from "@/lib/boards/heatmap-server";
import { menuBoardsForChannel, resolveBoardSlug } from "@/lib/boards/registry";
import { seedMissingBoards } from "@/lib/boards/seed";
import { OVERSEAS_STOCK_BOARD_SLUG } from "@/lib/market/stock-codes";
import { POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import { isWithinAnalysisTopN } from "@/lib/analysis/generation-policy";
import type { RankingEntity } from "@/lib/types";

export interface HeatmapAnalysisTarget {
  channel: PostChannel;
  boardSlug: string;
  boardTitle: string;
  entity: RankingEntity;
  related: RankingEntity[];
}

/**
 * Boards that must appear in the overnight inventory when their channel runs.
 * New economy menus (e.g. 해외 주식) are listed here so a silent miss fails CI
 * instead of shipping empty detail pages until someone notices.
 */
export const REQUIRED_HEATMAP_ANALYSIS_BOARDS: Partial<Record<PostChannel, string[]>> = {
  economy: [OVERSEAS_STOCK_BOARD_SLUG, "kospi-fomo-index", "commodities-fx-index"],
};

/**
 * Top-N names on each category submenu heatmap (default 전체/전체/전체):
general boards 1–10, subsidy/grant boards 1–15.
 * Dedupes by entity.slug — the same keyword on two boards is generated once.
 */
export async function listHeatmapAnalysisTargets(options?: {
  channel?: PostChannel;
  /** Limit to one ranking-board slug (aliases resolved). */
  boardSlug?: string;
  /** Seed any missing board shells before reading rankings. Default true. */
  seedMissing?: boolean;
}): Promise<HeatmapAnalysisTarget[]> {
  if (options?.seedMissing !== false) {
    await seedMissingBoards();
  }

  const channels = options?.channel
    ? POST_CHANNELS.filter((meta) => meta.id === options.channel)
    : POST_CHANNELS;
  const boardFilter = options?.boardSlug ? resolveBoardSlug(options.boardSlug) : undefined;

  const bySlug = new Map<string, HeatmapAnalysisTarget>();

  for (const meta of channels) {
    const channel = meta.id;
    const boards = await loadChannelHeatmapPayloads(channel);
    const menu = menuBoardsForChannel(channel)
      .filter((board) => !board.deskKind)
      .filter((board) => (boardFilter ? board.slug === boardFilter : true));

    for (const def of menu) {
      const board = boards.find((item) => item.slug === def.slug);
      if (!board) continue;

      const entities = buildHeatmapItems({
        boards,
        board: def.slug,
        gender: "all",
        age: "all",
        region: "all",
      });

      for (const entity of entities) {
        if (!entity.slug || bySlug.has(entity.slug)) continue;
        // 오늘의 분석: general boards ranks 1–10, subsidy boards 1–15.
        if (!isWithinAnalysisTopN(entity.rank, def.slug)) continue;
        const related = entities
          .filter((item) => item.slug !== entity.slug)
          .slice(0, 6);
        bySlug.set(entity.slug, {
          channel,
          boardSlug: def.slug,
          boardTitle: def.shortTitle || def.title,
          entity,
          related,
        });
      }
    }
  }

  return [...bySlug.values()].sort((a, b) => {
    const channelCmp = a.channel.localeCompare(b.channel);
    if (channelCmp !== 0) return channelCmp;
    const boardCmp = a.boardSlug.localeCompare(b.boardSlug);
    if (boardCmp !== 0) return boardCmp;
    return a.entity.rank - b.entity.rank;
  });
}

/** Throws when a required board has zero overnight targets for the scoped run. */
export function assertRequiredHeatmapBoards(
  targets: HeatmapAnalysisTarget[],
  options?: { channel?: PostChannel; boardSlug?: string },
): void {
  if (options?.boardSlug) return;
  const channels = options?.channel
    ? [options.channel]
    : (Object.keys(REQUIRED_HEATMAP_ANALYSIS_BOARDS) as PostChannel[]);

  const missing: string[] = [];
  for (const channel of channels) {
    const required = REQUIRED_HEATMAP_ANALYSIS_BOARDS[channel] ?? [];
    for (const boardSlug of required) {
      const count = targets.filter((item) => item.boardSlug === boardSlug).length;
      if (count === 0) missing.push(`${channel}/${boardSlug}`);
    }
  }
  if (missing.length) {
    throw new Error(
      `Heatmap analysis inventory missing required boards: ${missing.join(", ")}`,
    );
  }
}
