import type { NextRequest } from "next/server";
import { getTrendBySlug, getTrendsSource } from "@/lib/providers/trends";
import { parseTimeframeParam } from "@/lib/timeframes";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const timeframe = parseTimeframeParam(request.nextUrl.searchParams.get("timeframe") ?? undefined) ?? "1d";
  const item = await getTrendBySlug(slug, timeframe);

  if (!item) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(
    {
      source: getTrendsSource(),
      timeframe,
      item,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
