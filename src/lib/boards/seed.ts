import { analysisLogger } from "@/lib/analysis/log";
import { kstDateString } from "@/lib/briefing/dates";
import { rankFromSeeds } from "@/lib/boards/chain/rank";
import { emptyBoardReport } from "@/lib/boards/chain/report";
import { BOARDS, boardPath, isDeskBoard } from "@/lib/boards/registry";
import { boardTtlHours, readBoard, writeBoard } from "@/lib/boards/store";
import type { BoardDefinition, CachedBoard } from "@/lib/boards/types";
import { SITE } from "@/lib/site";

/**
 * Instant ranking shell so a cold cache never blocks a page on LLM calls.
 * Editorial report prose stays empty until Gemini succeeds (BoardReportBody gates on chain).
 */
export function buildSampleBoard(
  board: BoardDefinition,
  editionDate = kstDateString(),
): CachedBoard {
  const ranked = rankFromSeeds(board);
  const generatedAt = new Date();
  return {
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
    report: emptyBoardReport(board),
    provenance: {
      kind: "template",
      newsDocs: 0,
      publishers: [],
      demographicsFromLlm: false,
      buildMs: 0,
    },
  };
}

export async function seedBoardIfMissing(board: BoardDefinition): Promise<CachedBoard> {
  if (isDeskBoard(board)) {
    return buildSampleBoard(board);
  }
  const existing = await readBoard(board.slug);
  if (existing) return existing;
  const entry = buildSampleBoard(board);
  await writeBoard(entry);
  analysisLogger("boards:seed").step("seeded", {
    slug: board.slug,
    rows: entry.ranking.length,
    url: `${SITE.url}${boardPath(board.slug)}`,
  });
  return entry;
}

export async function seedMissingBoards(): Promise<{ seeded: number; total: number }> {
  let seeded = 0;
  for (const board of BOARDS) {
    if (isDeskBoard(board)) continue;
    const existed = await readBoard(board.slug);
    if (existed) continue;
    await seedBoardIfMissing(board);
    seeded += 1;
  }
  if (seeded) {
    analysisLogger("boards:seed").step("complete", { seeded, total: BOARDS.length });
  }
  return { seeded, total: BOARDS.length };
}
