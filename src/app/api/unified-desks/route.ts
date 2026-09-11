import { NextResponse } from "next/server";
import { loadUnifiedMarket } from "@/lib/boards/composite-desk";
import { trendsRevalidateSec } from "@/lib/refresh";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const revalidate = 180;

/** Landing “LIVE 킨덱스 랭킹” client poll — mirrors loadUnifiedMarket desks. */
export async function GET() {
  // Do not pass getRankings() here — seed/mock would override the ingest
  // snapshot inside resolveLiveMarket and desync landing desks from category LIVE.
  const unified = await loadUnifiedMarket();
  const maxAge = trendsRevalidateSec();
  return NextResponse.json(
    {
      updatedAt: new Date().toISOString(),
      desks: unified.desks,
    },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
      },
    },
  );
}
