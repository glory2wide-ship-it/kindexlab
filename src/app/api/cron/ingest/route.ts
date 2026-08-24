import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { runIngestJob } from "@/lib/ingestion/job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const persist = new URL(request.url).searchParams.get("persist") !== "0";
  const result = await runIngestJob({ persist });

  return NextResponse.json({
    ok: true,
    persisted: result.persisted,
    usedPreviousSnapshot: result.usedPreviousSnapshot,
    updatedAt: result.updatedAt,
    itemCount: result.itemCount,
    sources: result.sourceResults,
  });
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
