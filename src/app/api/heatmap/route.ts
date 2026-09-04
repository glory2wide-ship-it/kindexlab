import { NextResponse } from "next/server";
import { getRankings } from "@/lib/api";
import { clampAgeForBoard } from "@/lib/boards/age-tabs";
import { isAgeSegment, isGenderSegment } from "@/lib/boards/demographics";
import { parseRegionQuery } from "@/lib/boards/regions";
import { buildHeatmapItems, heatmapBoardTitle } from "@/lib/boards/heatmap";
import { loadChannelHeatmapPayloads, toTileEntity } from "@/lib/boards/heatmap-server";
import { channelUsesBoardHeatmap } from "@/lib/boards/limits";
import { itemsForChannel, isPostChannel } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseChannel(raw: string | null): PostChannel | undefined {
  if (!raw) return undefined;
  return isPostChannel(raw) ? raw : undefined;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const category = parseChannel(params.get("category"));
  if (!category) {
    return NextResponse.json({ ok: false, error: "category required" }, { status: 400 });
  }

  const genderRaw = params.get("gender") ?? "all";
  const ageRaw = params.get("age") ?? "all";
  const regionRaw = params.get("region") ?? "all";
  const board = params.get("board")?.trim() || undefined;
  const parsedAge = ageRaw === "all" || isAgeSegment(ageRaw) ? ageRaw : "all";
  const age = clampAgeForBoard(board, parsedAge === "all" ? "all" : parsedAge);
  const gender = genderRaw === "all" || isGenderSegment(genderRaw) ? genderRaw : "all";
  const region = parseRegionQuery(regionRaw);

  const boards = await loadChannelHeatmapPayloads(category);
  let liveItems: RankingEntity[] = [];
  // Live feed only when the channel is not board-driven (politics now uses boards).
  if (!channelUsesBoardHeatmap(category)) {
    try {
      const market = await getRankings();
      liveItems = itemsForChannel(market.items, category);
    } catch {
      liveItems = [];
    }
  }

  const items = buildHeatmapItems({
    boards,
    liveItems,
    board,
    gender,
    age,
    region,
    preferLive: false,
  }).map(toTileEntity);
  const selected = board ? boards.find((item) => item.slug === board) : undefined;

  return NextResponse.json({
    ok: true,
    category,
    gender,
    age,
    region,
    board: selected?.slug ?? null,
    title: heatmapBoardTitle(boards, board),
    source: selected || boards.length ? "demographic_ranking" : "live",
    count: items.length,
    items,
  });
}
