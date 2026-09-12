import { llmConfigured, llmModel } from "@/lib/analysis/chain/llm";
import { analysisLogger } from "@/lib/analysis/log";
import { kstDateString } from "@/lib/briefing/dates";
import { rankBoard } from "@/lib/boards/chain/rank";
import { emptyBoardReport, writeBoardReport } from "@/lib/boards/chain/report";
import { polishBoardReport } from "@/lib/boards/chain/polish";
import { buildBoardPump, buildTemplatePump } from "@/lib/boards/chain/pump";
import { collectBoardSources } from "@/lib/boards/collect-board-sources";
import { BOARDS, boardPath, getBoard, isDeskBoard, isRailBoard } from "@/lib/boards/registry";
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

function boardsSkipPolish(): boolean {
  const raw = process.env.BOARDS_SKIP_POLISH?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function boardsSkipPump(): boolean {
  const raw = process.env.BOARDS_SKIP_PUMP?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

async function generate(board: BoardDefinition, editionDate: string): Promise<CachedBoard> {
  const logger = analysisLogger(board.title);
  const deadline = Date.now() + budgetMs();
  const remaining = () => deadline - Date.now();

  logger.step("board:start", { slug: board.slug, channel: board.channel });

  const collected = await collectBoardSources(board, logger);
  const { docs, publishers } = collected;
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

  // Cost save: no news/ticket grounding → reuse previous or seed shell (no Gemini).
  const hasGrounding = docs.length > 0 || ticketSeeds.length > 0 || ticketChartLines.length > 0;
  if (!hasGrounding) {
    logger.step("board:skip-llm", { reason: "no-grounding", previous: Boolean(previous?.ranking?.length) });
    const generatedAt = new Date();
    if (previous?.ranking?.length) {
      const entry: CachedBoard = {
        ...previous,
        editionDate,
        generatedAt: generatedAt.toISOString(),
        expiresAt: new Date(generatedAt.getTime() + boardTtlHours() * 3_600_000).toISOString(),
        provenance: {
          ...previous.provenance,
          kind: previous.provenance.kind === "chain" ? "chain" : "template",
          newsDocs: 0,
          buildMs: logger.elapsed(),
        },
      };
      await writeBoard(entry);
      return entry;
    }
    const sample = buildSampleBoard(board, editionDate);
    await writeBoard(sample);
    return sample;
  }

  const ranked = await rankBoard({
    board,
    docs,
    logger,
    timeoutMs: Math.min(45_000, Math.max(10_000, remaining())),
    previousRanking: previous?.ranking,
    ticketChartLines,
    ticketSeeds,
    strategyHint: collected.strategyHint,
    sourceStrategy: collected.strategy,
  });

  const { report: drafted, fromLlm } = await writeBoardReport({
    board,
    ranking: ranked.ranking,
    demographics: ranked.demographics,
    logger,
    timeoutMs: Math.min(60_000, Math.max(10_000, remaining())),
  });

  // Prose columns ship only from Gemini. Ranking/demographics still update on miss.
  // BOARDS_SKIP_POLISH=1 skips the editor LLM pass (keeps drafted report).
  const report = fromLlm
    ? boardsSkipPolish() || remaining() <= 10_000
      ? drafted
      : await polishBoardReport({
          report: drafted,
          logger,
          timeoutMs: Math.min(45_000, remaining()),
        })
    : emptyBoardReport(board);

  const articleUrl = `${SITE.url}${boardPath(board.slug)}`;
  // BOARDS_SKIP_PUMP=1 uses the free template pump (no shorts LLM).
  const pump = fromLlm
    ? boardsSkipPump()
      ? buildTemplatePump(board, ranked.ranking, ranked.demographics)
      : await buildBoardPump({
          board,
          ranking: ranked.ranking,
          demographics: ranked.demographics,
          articleUrl,
          logger,
          timeoutMs: Math.min(30_000, Math.max(8_000, remaining())),
        })
    : undefined;

  const generatedAt = new Date();
  const provenance: BoardProvenance = {
    kind: fromLlm ? "chain" : "template",
    newsDocs: docs.length,
    publishers: publishers.slice(0, 6),
    model: fromLlm && enabled ? llmModel() : undefined,
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
    strategy: collected.strategy,
    expanded: collected.expanded,
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

/** Missing/expired only — cron no longer refreshes still-warm boards.
 * Economy/culture/travel boards are refreshed ahead of entertainment/politics so
 * those heatmaps stay dense without Naver Open API coverage.
 */
export async function pickStaleBoards(limit: number, slug?: string): Promise<BoardDefinition[]> {
  if (slug) {
    const found = getBoard(slug);
    return found && !isDeskBoard(found) ? [found] : [];
  }

  const channelBoost = (channel: BoardDefinition["channel"]) =>
    channel === "economy" || channel === "culture" || channel === "travel" ? 0 : 1;

  const scored = await Promise.all(
    BOARDS.filter((board) => !isDeskBoard(board)).map(async (board) => {
      const cached = await readBoard(board.slug);
      if (!cached) return { board, priority: 0, at: 0 };
      if (isBoardExpired(cached)) return { board, priority: 1, at: new Date(cached.expiresAt).getTime() };
      return { board, priority: 2, at: new Date(cached.expiresAt).getTime() };
    }),
  );

  // Cost save: only missing (0) or expired (1) boards — never burn Gemini on warm ones.
  const due = scored
    .filter((item) => isRailBoard(item.board) && item.priority < 2)
    .sort(
      (left, right) =>
        channelBoost(left.board.channel) - channelBoost(right.board.channel) ||
        left.priority - right.priority ||
        left.at - right.at,
    )
    .slice(0, Math.max(0, limit))
    .map((item) => item.board);
  return due;
}
