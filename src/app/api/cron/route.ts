import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { generateSeoPost, tapeRatio } from "@/lib/content-generator";
import { channelHref, channelSectionHref, inferPostChannel } from "@/lib/posts/channels";
import type { PostSlot } from "@/lib/posts/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

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
  });
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
