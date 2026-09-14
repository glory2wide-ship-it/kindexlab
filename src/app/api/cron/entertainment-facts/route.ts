import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import {
  ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT,
  entertainmentFactsAreStale,
  listStaleEntertainmentProfiles,
} from "@/lib/boards/entertainment-facts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly entertainment profile freshness check.
 * Flags curated KPOP / 음원 / 스타 / 영화 / 웹툰 / 공연 / 전시팝업 facts
 * older than 7 days so editors can refresh members, agency, hits, cast, etc.
 *
 * Schedule (example): 0 9 * * 1  (every Monday 09:00 KST via external cron)
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const stale = listStaleEntertainmentProfiles();
  const catalogueStale = entertainmentFactsAreStale(ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT);

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    catalogueCheckedAt: ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT,
    catalogueStale,
    staleCount: stale.length,
    stale,
    guidance:
      stale.length === 0
        ? "All entertainment fact profiles are within the 7-day window."
        : "Update stale profiles in src/lib/boards/entertainment-facts.ts and bump checkedAt / ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT.",
  });
}
