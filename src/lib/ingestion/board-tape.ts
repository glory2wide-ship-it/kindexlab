import { spawnSync } from "node:child_process";
import {
  entityTypeForBoardChannel,
  heatmapGroupForBoardSlug,
  isBoardDeskEntityType,
} from "@/lib/boards/entity-type";
import { pickStaleBoards, refreshBoard } from "@/lib/boards/pipeline";
import { menuBoardsForChannel, isHeadlineNewsBoard } from "@/lib/boards/registry";
import { readBoard } from "@/lib/boards/store";
import type { CachedBoard } from "@/lib/boards/types";
import type { PostChannel } from "@/lib/posts/types";
import { HEATMAP_SCREEN_LIVE_CAP } from "@/lib/boards/live-priority";
import type { RankingEntity } from "@/lib/types";

const BOARD_CHANNELS: PostChannel[] = ["economy", "culture", "travel"];

function boardToEntities(entry: CachedBoard, channel: PostChannel): RankingEntity[] {
  const type = entityTypeForBoardChannel(entry.slug, channel);
  const heatmapGroup = heatmapGroupForBoardSlug(entry.slug) ?? entry.title;
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
    tags: [entry.slug, channel, "board-tape"],
    summary: row.note?.slice(0, 96) ?? "",
    sourceChannel: channel,
    heatmapGroup,
  }));
}

function isLiveChartRow(item: RankingEntity): boolean {
  return Boolean(item.tags?.includes("live-chart"));
}

function isBoardTapeRow(item: RankingEntity): boolean {
  if (isLiveChartRow(item)) return false;
  if (item.tags?.includes("board-tape")) return true;
  if (!isBoardDeskEntityType(item.type) && item.type !== "subsidy") return false;
  return (
    item.sourceChannel === "economy" ||
    item.sourceChannel === "culture" ||
    item.sourceChannel === "travel"
  );
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
 * Fold published (or local-cache) menu-board rankings into RankingEntity rows
 * so heatmaps move without waiting on an LLM refresh window.
 */
export async function loadPublishedBoardTape(): Promise<RankingEntity[]> {
  const entities: RankingEntity[] = [];
  for (const channel of BOARD_CHANNELS) {
    const menus = menuBoardsForChannel(channel).filter(
      (board) => !board.deskKind && !isHeadlineNewsBoard(board.slug),
    );
    for (const board of menus) {
      try {
        const entry = await readBoard(board.slug);
        if (entry?.ranking?.length) {
          entities.push(...boardToEntities(entry, channel));
        }
      } catch {
        /* one board missing must not blank the tape */
      }
    }
  }
  return entities;
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
  const stale = await pickStaleBoards(Math.max(limit * 4, 8));
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
    // Bound the publish child so a stuck Gemini/board publish cannot hang ingest.
    timeout: Number(process.env.INGEST_BOARD_PUBLISH_TIMEOUT_MS ?? 120_000),
    killSignal: "SIGKILL",
  });

  const entities = [...byChannel.entries()].flatMap(([channel, boards]) =>
    boards.flatMap((entry) => boardToEntities(entry, channel)),
  );
  return { entities, refreshed };
}

function liveChartCountByBoardSlug(items: RankingEntity[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.tags?.includes("live-chart")) continue;
    const slug =
      item.tags.find((tag) => tag !== "live-chart" && !tag.includes(":")) ??
      item.slug.split("--")[0];
    if (!slug) continue;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return counts;
}

/**
 * Drop previous published/LLM board-tape rows, keep live-chart crawls
 * (tickets/books), then append the replacement tape.
 * P2-10: when a board already has ≥ screen-20 live-chart rows, do not promote
 * template/chain tape for that slug (keeps the viewport live-led).
 */
export function mergeBoardTape(
  items: RankingEntity[],
  boardEntities: RankingEntity[],
): RankingEntity[] {
  const liveCounts = liveChartCountByBoardSlug(items);
  const filtered = boardEntities.filter((entity) => {
    const slug = entity.tags?.[0] ?? entity.slug.split("--")[0];
    if (!slug) return true;
    return (liveCounts.get(slug) ?? 0) < HEATMAP_SCREEN_LIVE_CAP;
  });
  const without = items.filter((item) => !isBoardTapeRow(item));
  return [...without, ...filtered];
}

/** Replace board-tape rows only for the slugs present in `boardEntities`. */
export function upsertBoardTape(
  items: RankingEntity[],
  boardEntities: RankingEntity[],
): RankingEntity[] {
  if (!boardEntities.length) return items;
  const liveCounts = liveChartCountByBoardSlug(items);
  const allowed = boardEntities.filter((entity) => {
    const slug = entity.tags?.[0] ?? entity.slug.split("--")[0];
    if (!slug) return true;
    return (liveCounts.get(slug) ?? 0) < HEATMAP_SCREEN_LIVE_CAP;
  });
  if (!allowed.length) return items;
  const slugs = new Set(
    allowed
      .map((item) => item.tags?.[0] ?? item.slug.split("--")[0])
      .filter(Boolean),
  );
  const kept = items.filter((item) => {
    if (isLiveChartRow(item)) return true;
    if (!isBoardTapeRow(item)) return true;
    const boardSlug = item.tags?.[0] ?? item.slug.split("--")[0];
    return !slugs.has(boardSlug);
  });
  return [...kept, ...allowed];
}
