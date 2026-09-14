import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import {
  DETAIL_FACTS_DAILY_CHECKED_AT,
  detailFactsAreStale,
  listStaleDailyDetailProfiles,
  listStaleEntertainmentProfiles,
} from "@/lib/boards/detail-facts";
import { ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT } from "@/lib/boards/entertainment-facts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Detail-facts freshness check.
 * - Daily domains (유튜브 / 이슈뉴스 / 도서 / 맛집 / 나들이): flag > 1 day
 * - Weekly entertainment pack: flag > 7 days
 *
 * Schedule example: 0 8 * * * (every day 08:00 KST)
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const dailyStale = listStaleDailyDetailProfiles();
  const weeklyStale = listStaleEntertainmentProfiles();
  const catalogueDailyStale = detailFactsAreStale({
    checkedAt: DETAIL_FACTS_DAILY_CHECKED_AT,
    refresh: "daily",
  });

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    daily: {
      catalogueCheckedAt: DETAIL_FACTS_DAILY_CHECKED_AT,
      catalogueStale: catalogueDailyStale,
      staleCount: dailyStale.length,
      stale: dailyStale,
    },
    weekly: {
      catalogueCheckedAt: ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT,
      staleCount: weeklyStale.length,
      stale: weeklyStale,
    },
    guidance:
      dailyStale.length || weeklyStale.length
        ? "Refresh stale profiles in detail-facts.ts / entertainment-facts.ts and bump checkedAt stamps."
        : "All detail-fact profiles are within their daily/weekly windows.",
  });
}
