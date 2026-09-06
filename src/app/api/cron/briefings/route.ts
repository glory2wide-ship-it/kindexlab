import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { runDailyBriefingJob } from "@/lib/briefing/job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;

async function handle(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const editionDate = url.searchParams.get("date") ?? undefined;
  const result = await runDailyBriefingJob({
    persist: true,
    force,
    editionDate,
    // Overnight cron: Batch for daily mains + submenu deep-dives (−50%).
    useGeminiBatch: true,
  });

  return NextResponse.json({
    ok: true,
    skipped: result.skipped,
    reason: result.reason ?? null,
    editionDate: result.editionDate,
    removed: result.removed,
    persisted: result.persisted,
    total: result.articles.length,
    slugs: result.articles.map((item) => item.slug),
    wordCounts: result.articles.map((item) => item.wordCount),
  });
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
