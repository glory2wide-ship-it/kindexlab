import { buildHeatmapItems } from "@/lib/boards/heatmap";
import { loadChannelHeatmapPayloads } from "@/lib/boards/heatmap-server";
import { menuBoardsForChannel } from "@/lib/boards/registry";
import { POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity } from "@/lib/types";

export interface HeatmapAnalysisTarget {
  channel: PostChannel;
  boardSlug: string;
  boardTitle: string;
  entity: RankingEntity;
  related: RankingEntity[];
}

/**
 * Every name that appears on a category menu heatmap (default 전체/전체/전체).
 * Dedupes by entity.slug — the same keyword on two boards is generated once.
 */
export async function listHeatmapAnalysisTargets(options?: {
  channel?: PostChannel;
}): Promise<HeatmapAnalysisTarget[]> {
  const channels = options?.channel
    ? POST_CHANNELS.filter((meta) => meta.id === options.channel)
    : POST_CHANNELS;

  const bySlug = new Map<string, HeatmapAnalysisTarget>();

  for (const meta of channels) {
    const channel = meta.id;
    const boards = await loadChannelHeatmapPayloads(channel);
    const menu = menuBoardsForChannel(channel).filter((board) => !board.deskKind);

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
