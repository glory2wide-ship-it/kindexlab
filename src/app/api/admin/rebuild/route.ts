import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { analysisLogger } from "@/lib/analysis/log";
import { refreshAnalysis } from "@/lib/analysis/pipeline";
import { clearAnalysis } from "@/lib/analysis/store";
import { getRankings } from "@/lib/api";
import { refreshBoard } from "@/lib/boards/pipeline";
import { BOARDS, boardPath, categoryBoardPath, isDeskBoard } from "@/lib/boards/registry";
import { buildSampleBoard } from "@/lib/boards/seed";
import { describeDemographicSchema } from "@/lib/boards/demographics";
import { clearBoards, readBoard, writeBoard } from "@/lib/boards/store";
import { cronAuthorized } from "@/lib/cron";
import { indexPath } from "@/lib/indices";
import { POST_CHANNELS } from "@/lib/posts/channels";
import { rankingPath } from "@/lib/slugs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * How many keywords one invocation rebuilds. Each costs four LLM calls, so the
 * batch is bounded and the caller pages through with ?offset= rather than
 * risking a platform timeout mid-run.
 */
const DEFAULT_BATCH = 10;
const MAX_BATCH = 40;
/** Boards run four calls each too, but the ranking step is the slowest of them. */
const BOARD_BATCH = 4;

function toInt(raw: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

async function logAllBoardDemographics() {
  console.log(`[rebuild:demographics] dump start registered=${BOARDS.length}`);
  for (const board of BOARDS) {
    const cached = await readBoard(board.slug);
    if (!cached) {
      console.log(`[rebuild:demographics] channel=${board.channel} slug=${board.slug} missing=true`);
      continue;
    }
    const schema = describeDemographicSchema(cached.demographics);
    console.log(
      `[rebuild:demographics] channel=${board.channel} slug=${cached.slug} source=${cached.provenance.demographicsFromLlm ? "llm" : "derived"} gender=${schema.gender} age=${schema.age} complete=${schema.complete} top=${cached.ranking
        .slice(0, 3)
        .map((row) => row.name)
        .join(",")}`,
    );
  }
  console.log("[rebuild:demographics] dump complete");
}

/**
 * Purge and rebuild ranking boards. Same paging contract as the column
 * rebuild: only offset 0 purges, and the caller follows nextOffset to the end.
 * Pass ?channel=entertainment to rebuild one category, or ?only=slug,slug.
 */
async function handleBoards(params: URLSearchParams) {
  const startedAt = Date.now();
  const logger = analysisLogger("rebuild:boards");
  const limit = toInt(params.get("limit"), BOARD_BATCH, BOARDS.length);
  const offset = toInt(params.get("offset"), 0, BOARDS.length);

  const only = (params.get("only") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const channel = params.get("channel")?.trim();
  const all = (only.length
    ? BOARDS.filter((board) => only.some((name) => board.slug === name || board.id === name))
    : channel
      ? BOARDS.filter((board) => board.channel === channel)
      : BOARDS
  ).filter((board) => !isDeskBoard(board) || only.length > 0);

  const purged =
    offset === 0 && params.get("purge") !== "0" && !only.length ? await clearBoards() : 0;
  if (offset === 0) logger.step("purge", { removed: purged, registered: all.length });

  const batch = all.slice(offset, offset + limit);
  const results: {
    slug: string;
    title: string;
    kind: string;
    newsDocs: number;
    rows: number;
    chars: number;
    demographics: string;
    pump: boolean;
  }[] = [];

  for (const [index, board] of batch.entries()) {
    const position = offset + index + 1;
    logger.step("rebuild", {
      progress: `${position}/${all.length}`,
      percent: Math.round((position / all.length) * 100),
      board: board.title,
      channel: board.channel,
    });

    let entry;
    try {
      entry = await refreshBoard(board);
    } catch (error) {
      logger.warn("rebuild:failed", {
        slug: board.slug,
        error: error instanceof Error ? error.message : "unknown",
      });
      entry = buildSampleBoard(board);
      await writeBoard(entry);
      logger.step("rebuild:fallback-sample", { slug: entry.slug, rows: entry.ranking.length });
    }
    const schema = describeDemographicSchema(entry.demographics);
    const scoreMax = Math.max(0, ...entry.ranking.map((row) => row.score));
    logger.step("rebuild:demographics", {
      slug: entry.slug,
      source: entry.provenance.demographicsFromLlm ? "llm" : "derived",
      total_ranking: entry.ranking.length,
      gender: schema.gender,
      age: schema.age,
      complete: schema.complete,
      scoreMax,
      scoreScale: scoreMax <= 100 ? 100 : "overflow",
      pump: Boolean(entry.pump?.shortsScript?.length),
      pinnedComment: Boolean(entry.pump?.pinnedComment),
    });
    console.log(
      `[rebuild:demographics] channel=${board.channel} slug=${entry.slug} source=${entry.provenance.demographicsFromLlm ? "llm" : "derived"} gender=${schema.gender} age=${schema.age} complete=${schema.complete} top=${entry.ranking
        .slice(0, 3)
        .map((row) => row.name)
        .join(",")}`,
    );
    results.push({
      slug: entry.slug,
      title: entry.title,
      kind: entry.provenance.kind,
      newsDocs: entry.provenance.newsDocs,
      rows: entry.ranking.length,
      chars: entry.report?.characterCount ?? 0,
      demographics: entry.provenance.demographicsFromLlm ? "llm" : "derived",
      pump: Boolean(entry.pump),
    });
    revalidatePath(boardPath(entry.slug));
  }

  for (const channel of POST_CHANNELS) {
    revalidatePath(categoryBoardPath(channel.id));
    revalidatePath(`/${channel.id}`);
  }
  await logAllBoardDemographics();

  const nextOffset = offset + batch.length;
  const done = nextOffset >= all.length;
  logger.step("rebuild-batch", {
    done,
    rebuilt: results.length,
    chained: results.filter((item) => item.kind === "chain").length,
    demographicsFromLlm: results.filter((item) => item.demographics === "llm").length,
    nextOffset: done ? undefined : nextOffset,
    totalMs: Date.now() - startedAt,
  });

  return NextResponse.json({
    ok: true,
    scope: "boards",
    purged,
    registered: all.length,
    offset,
    rebuilt: results.length,
    chained: results.filter((item) => item.kind === "chain").length,
    templated: results.filter((item) => item.kind === "template").length,
    demographicsFromLlm: results.filter((item) => item.demographics === "llm").length,
    withPump: results.filter((item) => item.pump).length,
    done,
    nextOffset: done ? null : nextOffset,
    totalMs: Date.now() - startedAt,
    results,
  });
}

/**
 * Purge and rebuild. Wipes every stored column, then regenerates the registered
 * keywords through the current chain so nothing produced by an older prompt
 * survives. Resumable: pass ?offset= to continue where the previous call ended,
 * and only the first page (offset 0) purges.
 */
async function handle(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  // ?scope=boards rebuilds ranking boards instead of the entity columns.
  if (params.get("scope") === "boards") return handleBoards(params);
  await logAllBoardDemographics();

  const limit = toInt(params.get("limit"), DEFAULT_BATCH, MAX_BATCH);
  const offset = toInt(params.get("offset"), 0, 10_000);
  const startedAt = Date.now();
  const logger = analysisLogger("rebuild");

  const market = await getRankings();
  // ?only=a,b limits the run to named entities, which keeps a verification pass
  // from costing a full sweep of the board.
  const only = (params.get("only") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const all = only.length
    ? market.items.filter((item) =>
        only.some((name) => item.name === name || item.slug === name),
      )
    : market.items;

  const purged =
    offset === 0 && params.get("purge") !== "0" && !only.length ? await clearAnalysis() : 0;
  if (offset === 0) logger.step("purge", { removed: purged, registered: all.length });

  const batch = all.slice(offset, offset + limit);
  const results: {
    slug: string;
    keyword: string;
    kind: string;
    newsDocs: number;
    chars: number;
    pump: boolean;
  }[] = [];

  for (const [index, entity] of batch.entries()) {
    const position = offset + index + 1;
    logger.step("rebuild", {
      progress: `${position}/${all.length}`,
      percent: Math.round((position / all.length) * 100),
      keyword: entity.name,
    });

    const related = market.items
      .filter((item) => item.id !== entity.id && item.type === entity.type)
      .slice(0, 6);
    let entry;
    try {
      entry = await refreshAnalysis({ entity, market, related });
    } catch (error) {
      logger.warn("rebuild:failed", {
        slug: entity.slug,
        error: error instanceof Error ? error.message : "unknown",
      });
      continue;
    }

    results.push({
      slug: entry.slug,
      keyword: entry.keyword,
      kind: entry.provenance.kind,
      newsDocs: entry.provenance.newsDocs,
      chars: entry.article?.characterCount ?? 0,
      pump: Boolean(entry.pump),
    });
    revalidatePath(rankingPath(entry.slug));
  }

  for (const index of market.indices) revalidatePath(indexPath(index.id));

  const nextOffset = offset + batch.length;
  const done = nextOffset >= all.length;
  logger.step("rebuild-batch", {
    done,
    rebuilt: results.length,
    chained: results.filter((item) => item.kind === "chain").length,
    nextOffset: done ? undefined : nextOffset,
    totalMs: Date.now() - startedAt,
  });

  return NextResponse.json({
    ok: true,
    purged,
    registered: all.length,
    offset,
    rebuilt: results.length,
    chained: results.filter((item) => item.kind === "chain").length,
    templated: results.filter((item) => item.kind === "template").length,
    withPump: results.filter((item) => item.pump).length,
    done,
    nextOffset: done ? null : nextOffset,
    totalMs: Date.now() - startedAt,
    results,
  });
}

export async function GET(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    console.error("[rebuild]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "rebuild failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    console.error("[rebuild]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "rebuild failed" },
      { status: 500 },
    );
  }
}
