import { NextResponse } from "next/server";
import { getRankings } from "@/lib/api";
import { loadUnifiedMarket } from "@/lib/boards/composite-desk";
import { trendsRevalidateSec } from "@/lib/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Landing “카테고리별 실시간 데스크” client poll — mirrors loadUnifiedMarket desks. */
export async function GET() {
  const market = await getRankings({ refresh: true }).catch(() => ({
    updatedAt: new Date().toISOString(),
    status: "open" as const,
    indices: [],
    items: [],
  }));
  const unified = await loadUnifiedMarket(market);
  const maxAge = trendsRevalidateSec();
  return NextResponse.json(
    {
      updatedAt: market.updatedAt,
      desks: unified.desks,
    },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
      },
    },
  );
}
