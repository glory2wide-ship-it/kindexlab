import { NextResponse } from "next/server";
import { getRankings } from "@/lib/api";
import { clampAgeForBoard } from "@/lib/boards/age-tabs";
import { isAgeSegment, isGenderSegment } from "@/lib/boards/demographics";
import { parseRegionQuery } from "@/lib/boards/regions";
import { parseTvGenreQuery } from "@/lib/boards/tv-genre";
import { buildHeatmapItems, heatmapBoardTitle } from "@/lib/boards/heatmap";
import { loadChannelHeatmapPayloads, loadHeatmapLivePayload, toTileEntity } from "@/lib/boards/heatmap-server";
import { countLivePreferRows, preferLiveChannelComposite } from "@/lib/boards/limits";
import { attachKospiStockQuotes } from "@/lib/market/kospi-quotes";
import { itemsForChannel, isPostChannel } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity } from "@/lib/types";
import {
  heatmapApiCacheControl,
} from "@/lib/refresh";

export const runtime = "nodejs";
/** Allow CDN caching — matches desk ISR and client refresh cadence (DEFAULT_TRENDS_REVALIDATE_SEC). */
export const revalidate = 300;

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
  const genreRaw = params.get("genre") ?? "all";
  const board = params.get("board")?.trim() || undefined;
  const parsedAge = ageRaw === "all" || isAgeSegment(ageRaw) ? ageRaw : "all";
  const age = clampAgeForBoard(board, parsedAge === "all" ? "all" : parsedAge);
  const gender = genderRaw === "all" || isGenderSegment(genderRaw) ? genderRaw : "all";
  const region = parseRegionQuery(regionRaw);
  const genre = parseTvGenreQuery(genreRaw);

  const boards = await loadChannelHeatmapPayloads(category);
  let liveItems: RankingEntity[] = [];
  let updatedAt: string | undefined;
  try {
    const market = loadHeatmapLivePayload();
    if (market?.items?.length) {
      // Slim before compose — same as channelLiveMarket / landing pool.
      liveItems = itemsForChannel(market.items, category).map(toTileEntity);
      updatedAt = market.updatedAt;
    } else {
      const rankings = await getRankings();
      liveItems = itemsForChannel(rankings.items, category).map(toTileEntity);
      updatedAt = rankings.updatedAt;
    }
  } catch {
    liveItems = [];
  }

  const preferLive = preferLiveChannelComposite(
    category,
    board,
    countLivePreferRows(liveItems, category),
    { gender, age },
  );
  const items = (
    await attachKospiStockQuotes(
      buildHeatmapItems({
        boards,
        liveItems,
        board,
        gender,
        age,
        region,
        genre,
        preferLive,
      }),
      board,
    )
  ).map(toTileEntity);
  const selected = board ? boards.find((item) => item.slug === board) : undefined;
  // Prefer ingest clock; never mint a per-request Date (that defeats shared ETags).
  const snapshotAt = updatedAt || "0";

  return NextResponse.json(
    {
      ok: true,
      category,
      gender,
      age,
      region,
      board: selected?.slug ?? null,
      title: heatmapBoardTitle(boards, board),
      source: preferLive ? "live" : selected || boards.length ? "demographic_ranking" : "live",
      /** Shared ingest clock — clients compare this for cross-device parity. */
      updatedAt: snapshotAt === "0" ? new Date(0).toISOString() : snapshotAt,
      count: items.length,
      items,
    },
    {
      headers: {
        // Browsers always revalidate (max-age=0); CDN holds one 5-min snapshot.
        "Cache-Control": heatmapApiCacheControl(),
        ETag: `"heatmap-${category}-${board ?? "all"}-${gender}-${age}-${region}-${genre}-${snapshotAt}"`,
      },
    },
  );
}
