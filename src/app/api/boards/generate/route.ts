import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { pickStaleBoards, refreshBoard } from "@/lib/boards/pipeline";
import { boardPath, categoryBoardPath } from "@/lib/boards/registry";
import { describeDemographicSchema } from "@/lib/boards/demographics";
import { clearBoards } from "@/lib/boards/store";
import { cronAuthorized } from "@/lib/cron";
import { POST_CHANNELS } from "@/lib/posts/channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_BATCH = 4;
const MAX_BATCH = 10;

function toInt(raw: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

async function handle(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const startedAt = Date.now();

  const cleared = params.get("reset") === "1" ? await clearBoards() : 0;
  const targets = await pickStaleBoards(
    toInt(params.get("limit"), DEFAULT_BATCH, MAX_BATCH),
    params.get("slug") ?? undefined,
  );

  const results: {
    slug: string;
    title: string;
    kind: string;
    newsDocs: number;
    rows: number;
    chars: number;
    demographics: string;
    gender: string;
    age: string;
    complete: boolean;
    buildMs: number;
  }[] = [];

  // Sequential: each board is up to four LLM calls, and a parallel batch trips
  // provider rate limits well before it saves wall time.
  for (const board of targets) {
    const entry = await refreshBoard(board);
    const schema = describeDemographicSchema(entry.demographics);
    results.push({
      slug: entry.slug,
      title: entry.title,
      kind: entry.provenance.kind,
      newsDocs: entry.provenance.newsDocs,
      rows: entry.ranking.length,
      chars: entry.report.characterCount,
      demographics: entry.provenance.demographicsFromLlm ? "llm" : "derived",
      gender: schema.gender,
      age: schema.age,
      complete: schema.complete,
      buildMs: entry.provenance.buildMs,
    });
    revalidatePath(boardPath(entry.slug));
  }

  for (const channel of POST_CHANNELS) revalidatePath(categoryBoardPath(channel.id));

  return NextResponse.json({
    ok: true,
    cleared,
    generated: results.length,
    chained: results.filter((item) => item.kind === "chain").length,
    templated: results.filter((item) => item.kind === "template").length,
    demographicsFromLlm: results.filter((item) => item.demographics === "llm").length,
    totalMs: Date.now() - startedAt,
    results,
  });
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
