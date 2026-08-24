import type { NextRequest } from "next/server";
import { parseCategoryParam } from "@/lib/briefing/store";
import { getTrends } from "@/lib/providers/trends";
import { parseTimeframeParam } from "@/lib/timeframes";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = parseCategoryParam(searchParams.get("category") ?? undefined) ?? "all";
  const timeframe = parseTimeframeParam(searchParams.get("timeframe") ?? undefined) ?? "1d";
  const payload = await getTrends({ category, timeframe });
  const revalidate = Number(process.env.TRENDS_LIVE_REVALIDATE ?? 300);
  const maxAge = Number.isFinite(revalidate) ? revalidate : 300;

  return Response.json(payload, {
    headers: {
      "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
    },
  });
}
