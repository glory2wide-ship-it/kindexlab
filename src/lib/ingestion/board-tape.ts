import { spawnSync } from "node:child_process";
import { pickStaleBoards, refreshBoard } from "@/lib/boards/pipeline";
import { menuBoardsForChannel, isHeadlineNewsBoard } from "@/lib/boards/registry";
import type { CachedBoard } from "@/lib/boards/types";
import type { PostChannel } from "@/lib/posts/types";
import type { EntityType, RankingEntity } from "@/lib/types";

const BOARD_CHANNELS: PostChannel[] = ["economy", "culture", "travel"];

function entityTypeForChannel(channel: PostChannel): EntityType {
  return channel === "economy" ? "economy_board" : "culture_board";
}

function boardToEntities(entry: CachedBoard, channel: PostChannel): RankingEntity[] {
  const type = entityTypeForChannel(channel);
  return (entry.ranking ?? []).slice(0, 12).map((row, index) => ({
    id: `${entry.slug}--${index + 1}`,
    slug: `${entry.slug}--${(row.name ?? "item").replace(/\s+/g, "-").toLowerCase()}`,
    name: row.name,
    nameEn: "",
    type,
    rank: index + 1,
    previousRank: index + 1,
    buzzScore: Number(row.score ?? 50),
    openScore: Number(row.score ?? 50),
    fluctuationRate: Number(row.changeRate ?? 0),
    volume: Math.max(100, Math.round((row.score ?? 50) * 120)),
    sparkline: [],
    history: [],
    tags: [entry.slug, channel],
    summary: row.note?.slice(0, 96) ?? "",
    sourceChannel: channel,
    heatmapGroup: entry.title,
  }));
}

/** UTC minute window where ingest also rebuilds a couple of seed-only boards. */
export function shouldRefreshBoardsDuringIngest(now = new Date()): boolean {
  if (process.env.BOARDS_REFRESH_EVERY_INGEST === "1") return true;
  if (process.env.BOARDS_CHAIN_ENABLED === "0") return false;
  if (!process.env.GEMINI_API_KEY) return false;
  const minute = now.getUTCMinutes();
  return minute <= 2;
}

/**
 * Rebuild a few stale economy/culture/travel boards and return RankingEntity
 * rows that can ride inside the ingest snapshot (so the existing snapshot
 * commit ships them without a new GitHub workflow).
 */
export async function refreshBoardTape(limit = 2): Promise<{
  entities: RankingEntity[];
  refreshed: string[];
}> {
  const prefer = new Set(
    BOARD_CHANNELS.flatMap((channel) =>
      menuBoardsForChannel(channel)
        .filter((board) => !board.deskKind && !isHeadlineNewsBoard(board.slug))
        .map((board) => board.slug),
    ),
  );
  const stale = await pickStaleBoards(Math.max(limit * 3, 6));
  const targets = [
    ...stale.filter((board) => prefer.has(board.slug)),
    ...stale.filter((board) => !prefer.has(board.slug)),
  ].slice(0, limit);

  const refreshed: string[] = [];
  const byChannel = new Map<PostChannel, CachedBoard[]>();

  for (const board of targets) {
    try {
      const entry = await refreshBoard(board);
      refreshed.push(entry.slug);
      if (BOARD_CHANNELS.includes(board.channel)) {
        const list = byChannel.get(board.channel) ?? [];
        list.push(entry);
        byChannel.set(board.channel, list);
      }
    } catch (error) {
      console.warn(
        "[kindexlab:ingest] board refresh failed",
        board.slug,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Publish chain boards for environments that read published.json.
  spawnSync("npx", ["tsx", "scripts/publish-boards.ts", "--kind=chain"], {
    stdio: "inherit",
    env: process.env,
  });

  const entities = [...byChannel.entries()].flatMap(([channel, boards]) =>
    boards.flatMap((entry) => boardToEntities(entry, channel)),
  );
  return { entities, refreshed };
}

/** Drop previous board-tape rows, then append freshly rebuilt ones. */
export function mergeBoardTape(
  items: RankingEntity[],
  boardEntities: RankingEntity[],
): RankingEntity[] {
  const without = items.filter(
    (item) => item.type !== "economy_board" && item.type !== "culture_board",
  );
  return [...without, ...boardEntities];
}
