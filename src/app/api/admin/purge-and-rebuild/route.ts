import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Former premium-column purge/rebuild endpoint.
 * 이슈칼럼 generation was retired — refuse to regenerate columns.
 */
async function handle(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    {
      ok: false,
      error: "이슈칼럼(premium columns) generation is retired",
    },
    { status: 410 },
  );
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
