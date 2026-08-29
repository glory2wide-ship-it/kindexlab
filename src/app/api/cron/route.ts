import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { analysisLogger } from "@/lib/analysis/log";
import { pickStaleBoards, refreshBoard } from "@/lib/boards/pipeline";
import { boardPath, categoryBoardPath } from "@/lib/boards/registry";
import { describeDemographicSchema } from "@/lib/boards/demographics";
import { cronAuthorized } from "@/lib/cron";
import { generateSeoPost, tapeRatio } from "@/lib/content-generator";
import { channelHref, channelSectionHref, inferPostChannel } from "@/lib/posts/channels";
import { POST_CHANNELS } from "@/lib/posts/channels";
import type { PostSlot } from "@/lib/posts/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseSlot(value: string | null): PostSlot | undefined {
  if (value === "morning" || value === "afternoon" || value === "evening") return value;
  return undefined;
}

async function handle(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const result = await generateSeoPost({
    force: url.searchParams.get("force") === "1",
    slot: parseSlot(url.searchParams.get("slot")),
  });

  if (result.post) {
    const channel = inferPostChannel(result.post);
    revalidatePath("/posts");
    revalidatePath(`/posts/${result.post.slug}`);
    revalidatePath(channelHref(channel));
    revalidatePath(channelSectionHref(channel, "posts"));
    revalidatePath(channelHref(channel, result.post.slug));
  }

  const compliant = result.spec?.ok ?? false;

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
    ok: compliant,
    skipped: result.skipped,
    reason: result.reason ?? null,
    persisted: result.persisted,
    supabase: result.supabase,
    slug: result.post?.slug ?? null,
    wordCount: result.post?.wordCount ?? 0,
    characterCount: result.post?.characterCount ?? 0,
    focusKeyword: result.post?.focusKeyword ?? null,
    supportKeyword: result.post?.supportKeyword ?? null,
    usedOpenAi: result.usedOpenAi,
    compliant,
    tapeRatio: result.spec?.tapeRatio ?? (result.post ? tapeRatio(result.post) : 0),
    failures: result.spec?.failures ?? [],
    table: result.spec?.table ?? false,
    faq: result.spec?.faq ?? 0,
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
