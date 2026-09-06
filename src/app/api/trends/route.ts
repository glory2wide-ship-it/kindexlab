import type { NextRequest } from "next/server";
import { parseCategoryParam } from "@/lib/briefing/store";
import { getTrends } from "@/lib/providers/trends";
import { trendsRevalidateSec } from "@/lib/refresh";
import { parseTimeframeParam } from "@/lib/timeframes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = parseCategoryParam(searchParams.get("category") ?? undefined) ?? "all";
  const timeframe = parseTimeframeParam(searchParams.get("timeframe") ?? undefined) ?? "1d";
  const refresh = searchParams.get("refresh") === "1";
  const payload = await getTrends({ category, timeframe, refresh });
  const maxAge = trendsRevalidateSec();

  return Response.json(payload, {
    headers: {
      "Cache-Control": refresh
        ? "private, no-store"
        : `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
    },
  });
}
