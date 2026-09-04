import { llmConfigured, llmModel } from "@/lib/analysis/chain/llm";
import { analysisLogger } from "@/lib/analysis/log";
import { kstDateString } from "@/lib/briefing/dates";
import { rankBoard } from "@/lib/boards/chain/rank";
import { writeBoardReport } from "@/lib/boards/chain/report";
import { polishBoardReport } from "@/lib/boards/chain/polish";
import { buildBoardPump } from "@/lib/boards/chain/pump";
import { BOARDS, boardPath, getBoard, isDeskBoard } from "@/lib/boards/registry";
import { EXHIBITION_BOARD_SLUG, PERFORMANCE_BOARD_SLUG } from "@/lib/boards/region-catalogs";
import { buildSampleBoard } from "@/lib/boards/seed";
import {
  boardTtlHours,
  isBoardExpired,
  readBoard,
  writeBoard,
} from "@/lib/boards/store";
import type { BoardDefinition, BoardProvenance, CachedBoard } from "@/lib/boards/types";
import {
  fetchTicketSources,
  pickExhibitionTicketRows,
  pickPerformanceTicketRows,
  ticketRowsToBoardSeeds,
  ticketRowsToNewsLines,
} from "@/lib/ingestion/sources/tickets";
import { retrieveNewsForKeyword } from "@/lib/news/retrieve";
import type { NewsDoc } from "@/lib/news/types";
import { SITE } from "@/lib/site";

export interface BoardResult {
  entry: CachedBoard;
  cache: "hit" | "stale" | "miss";
}

function budgetMs(): number {
  const parsed = Number.parseInt(process.env.BOARDS_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120_000;
}

function pipelineEnabled(): boolean {
  return process.env.BOARDS_CHAIN_ENABLED !== "0";
}

/**
 * Boards are thematic rather than event-driven, so they pull a wider window than
 * the entity columns: a "베스트셀러" board still needs context on a quiet day.
 */
const LOOKBACK_HOURS = 168;

async function retrieveForBoard(
  board: BoardDefinition,
  logger: ReturnType<typeof analysisLogger>,
): Promise<{ docs: NewsDoc[]; publishers: string[] }> {
  const settled = await Promise.allSettled(
    board.queries.map((query) =>
      retrieveNewsForKeyword(query, {
        limit: board.channel === "entertainment" ? 8 : 5,
        lookbackHours: LOOKBACK_HOURS,
        trustedOnly: false,
        allowMarketTape: true,
        skipAliasFilter: true,
      }),
    ),
  );

  const docs: NewsDoc[] = [];
  const seen = new Set<string>();
  for (const [index, result] of settled.entries()) {
    const query = board.queries[index] ?? board.focusKeyword;
    if (result.status !== "fulfilled") {
      logger.warn("board:rss-failed", {
        query,
        error: result.reason instanceof Error ? result.reason.message : "unknown",
      });
      continue;
    }
    logger.step("board:rss", {
      query,
      fetched: result.value.stats.fetched,
      kept: result.value.stats.kept,
      providers: result.value.providers.join(","),
    });
    console.log(
      `[rebuild:rss] channel=${board.channel} board=${board.slug} query="${query}" fetched=${result.value.stats.fetched} kept=${result.value.stats.kept}`,
    );
    for (const doc of result.value.docs) {
      const key = doc.link ?? doc.title;
      if (seen.has(key)) continue;
      seen.add(key);
      docs.push(doc);
    }
  }

  const publishers = [...new Set(docs.map((doc) => doc.publisher).filter(Boolean))] as string[];
  logger.step("board:retrieve", {
    queries: board.queries.length,
    docs: docs.length,
    publishers: publishers.slice(0, 4).join(","),
  });

  return { docs: docs.slice(0, board.channel === "entertainment" ? 24 : 10), publishers };
}

async function generate(board: BoardDefinition, editionDate: string): Promise<CachedBoard> {
  const logger = analysisLogger(board.title);
  const deadline = Date.now() + budgetMs();
  const remaining = () => deadline - Date.now();

  logger.step("board:start", { slug: board.slug, channel: board.channel });

  const { docs, publishers } = await retrieveForBoard(board, logger);
  const previous = await readBoard(board.slug);
  const enabled = pipelineEnabled() && llmConfigured();

  let ticketChartLines: string[] = [];
  let ticketSeeds: string[] = [];
  if (board.slug === PERFORMANCE_BOARD_SLUG || board.slug === EXHIBITION_BOARD_SLUG) {
    try {
      const ticketSources = await fetchTicketSources();
      const ticketRows =
        board.slug === PERFORMANCE_BOARD_SLUG
          ? pickPerformanceTicketRows(ticketSources)
          : pickExhibitionTicketRows(ticketSources);
      ticketChartLines = ticketRowsToNewsLines(
        ticketRows,
        board.slug === PERFORMANCE_BOARD_SLUG ? "공연 티켓몰" : "전시 티켓몰",
      );
      ticketSeeds = ticketRowsToBoardSeeds(ticketRows);
      logger.step("board:tickets", {
        ok: ticketSources.filter((source) => source.ok).map((source) => source.id).join(",") || "none",
        rows: ticketRows.length,
      });
      console.log(
        `[rebuild:tickets] board=${board.slug} rows=${ticketRows.length} sources=${ticketSources
          .filter((source) => source.ok)
          .map((source) => source.id)
          .join(",")}`,
      );
    } catch (error) {
      logger.warn("board:tickets-failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  const ranked = await rankBoard({
    board,
    docs,
    logger,
    timeoutMs: Math.min(45_000, Math.max(10_000, remaining())),
    previousRanking: previous?.ranking,
    ticketChartLines,
    ticketSeeds,
  });

  const { report: drafted, fromLlm } = await writeBoardReport({
    board,
    ranking: ranked.ranking,
    demographics: ranked.demographics,
    logger,
    timeoutMs: Math.min(60_000, Math.max(10_000, remaining())),
  });

  const report =
    fromLlm && remaining() > 10_000
      ? await polishBoardReport({
          report: drafted,
          logger,
          timeoutMs: Math.min(45_000, remaining()),
        })
      : drafted;

  const articleUrl = `${SITE.url}${boardPath(board.slug)}`;
  const pump = await buildBoardPump({
    board,
    ranking: ranked.ranking,
    demographics: ranked.demographics,
    articleUrl,
    logger,
    timeoutMs: Math.min(30_000, Math.max(8_000, remaining())),
  });

  const generatedAt = new Date();
  const provenance: BoardProvenance = {
    kind: fromLlm ? "chain" : "template",
    newsDocs: docs.length,
    publishers: publishers.slice(0, 6),
    model: enabled ? llmModel() : undefined,
    demographicsFromLlm: ranked.demographicsFromLlm,
    buildMs: logger.elapsed(),
  };

  const entry: CachedBoard = {
    slug: board.slug,
    boardId: board.id,
    channel: board.channel,
    title: board.title,
    editionDate,
    generatedAt: generatedAt.toISOString(),
    expiresAt: new Date(generatedAt.getTime() + boardTtlHours() * 3_600_000).toISOString(),
    indexValue: ranked.indexValue,
    indexChangeRate: ranked.indexChangeRate,
    ranking: ranked.ranking,
    demographics: ranked.demographics,
    report,
    pump,
    provenance,
  };

  const saved = await writeBoard(entry);
  logger.step("board:done", {
    kind: provenance.kind,
    chars: report.characterCount,
    rows: entry.ranking.length,
    demographics: ranked.demographicsFromLlm ? "llm" : "derived",
    ms: provenance.buildMs,
    file: saved.file,
    supabase: saved.supabase,
  });

  return entry;
}

/** Dedupes concurrent builds of the same board within a single process. */
const inFlight = new Map<string, Promise<CachedBoard>>();

function generateOnce(board: BoardDefinition, editionDate: string): Promise<CachedBoard> {
  const key = `${board.slug}:${editionDate}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const task = generate(board, editionDate).finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}

/**
 * On-demand read. A fresh entry is served straight from cache; a stale one is
 * served immediately while a rebuild runs in the background, so a visitor never
 * waits on the LLM for a board that already exists.
 */
export async function getOrCreateBoard(
  board: BoardDefinition,
  options: { editionDate?: string; force?: boolean } = {},
): Promise<BoardResult> {
  if (isDeskBoard(board)) {
    return { entry: buildSampleBoard(board, options.editionDate), cache: "hit" };
  }
  const editionDate = options.editionDate ?? kstDateString();
  const cached = options.force ? undefined : await readBoard(board.slug);

  if (cached && cached.editionDate === editionDate && !isBoardExpired(cached)) {
    return { entry: cached, cache: "hit" };
  }

  if (cached) {
    void generateOnce(board, editionDate).catch(() => undefined);
    return { entry: cached, cache: "stale" };
  }

  const sample = buildSampleBoard(board, editionDate);
  await writeBoard(sample);
  void generateOnce(board, editionDate).catch(() => undefined);
  return { entry: sample, cache: "miss" };
}

/** Cron path: always rebuilds and waits, so the caller can report real counts. */
export async function refreshBoard(
  board: BoardDefinition,
  editionDate = kstDateString(),
): Promise<CachedBoard> {
  if (isDeskBoard(board)) return buildSampleBoard(board, editionDate);
  return generateOnce(board, editionDate);
}

/** Missing first, then closest to expiry — hourly cron rotates through the full set. */
export async function pickStaleBoards(limit: number, slug?: string): Promise<BoardDefinition[]> {
  if (slug) {
    const found = getBoard(slug);
    return found && !isDeskBoard(found) ? [found] : [];
  }

  const scored = await Promise.all(
    BOARDS.filter((board) => !isDeskBoard(board)).map(async (board) => {
      const cached = await readBoard(board.slug);
      if (!cached) return { board, priority: 0, at: 0 };
      if (isBoardExpired(cached)) return { board, priority: 1, at: new Date(cached.expiresAt).getTime() };
      return { board, priority: 2, at: new Date(cached.expiresAt).getTime() };
    }),
  );

  return scored
    .sort((left, right) => left.priority - right.priority || left.at - right.at)
    .slice(0, Math.max(1, limit))
    .map((item) => item.board);
}
