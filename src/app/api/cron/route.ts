import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { analysisLogger } from "@/lib/analysis/log";
import { pickStaleBoards, refreshBoard } from "@/lib/boards/pipeline";
import { boardPath, categoryBoardPath } from "@/lib/boards/registry";
import { describeDemographicSchema } from "@/lib/boards/demographics";
import { cronAuthorized } from "@/lib/cron";
import { POST_CHANNELS } from "@/lib/posts/channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Board refresh cron.
 *
 * 이슈칼럼(SEO/premium column) generation was retired; this route no longer
 * writes posts. It only refreshes stale ranking boards.
 */
async function handle(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const boards: {
    slug: string;
    demographics: string;
    kind: string;
    gender: string;
    age: string;
    complete: boolean;
  }[] = [];
  let boardError: string | null = null;
  try {
    const logger = analysisLogger("cron:boards");
    const boardTargets = await pickStaleBoards(1);
    for (const board of boardTargets) {
      const entry = await refreshBoard(board);
      const schema = describeDemographicSchema(entry.demographics);
      logger.step("refresh", {
        slug: entry.slug,
        source: entry.provenance.demographicsFromLlm ? "llm" : "derived",
        total_ranking: entry.ranking.length,
        gender: schema.gender,
        age: schema.age,
        complete: schema.complete,
      });
      boards.push({
        slug: entry.slug,
        kind: entry.provenance.kind,
        demographics: entry.provenance.demographicsFromLlm ? "llm" : "derived",
        gender: schema.gender,
        age: schema.age,
        complete: schema.complete,
      });
      revalidatePath(boardPath(entry.slug));
    }
    for (const channel of POST_CHANNELS) revalidatePath(categoryBoardPath(channel.id));
  } catch (error) {
    boardError = error instanceof Error ? error.message : "board refresh failed";
  }

  return NextResponse.json({
    ok: !boardError,
    issueColumns: "retired",
    boards,
    boardError,
  });
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
