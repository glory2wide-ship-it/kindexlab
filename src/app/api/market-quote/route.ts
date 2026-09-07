import { NextResponse } from "next/server";
import { getEntityBySlug } from "@/lib/api";
import {
  enrichEntityWithKospiQuote,
  entityNeedsLiveMarketQuote,
} from "@/lib/market/kospi-quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live Naver quote for detail-page hydration. The RSC path paints from the
 * in-process cache (or without a quote); this endpoint refreshes afterward.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const resolved = await getEntityBySlug(slug);
  if (!resolved) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!entityNeedsLiveMarketQuote(resolved)) {
    return NextResponse.json({
      measurement: resolved.measurement ?? null,
      fluctuationRate: resolved.fluctuationRate,
      summary: resolved.summary,
      metrics: resolved.metrics ?? null,
    });
  }

  const enriched = await enrichEntityWithKospiQuote(resolved);
  return NextResponse.json({
    measurement: enriched.measurement ?? null,
    fluctuationRate: enriched.fluctuationRate,
    summary: enriched.summary,
    metrics: enriched.metrics ?? null,
  });
}
