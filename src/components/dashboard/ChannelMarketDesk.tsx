"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { CategoryBoardRail } from "@/components/boards/CategoryBoardRail";
import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { MarketWorkspace } from "@/components/dashboard/MarketWorkspace";
import { TickerTape } from "@/components/ticker/TickerTape";
import { computeBoardIndex } from "@/lib/boards/board-index";
import {
  buildHeatmapItems,
  heatmapBoardTitle,
  type HeatmapAge,
  type HeatmapBoardPayload,
  type HeatmapGender,
  type HeatmapRegion,
} from "@/lib/boards/heatmap";
import { clampAgeForBoard } from "@/lib/boards/age-tabs";
import { boardPath, getBoard } from "@/lib/boards/registry";
import { filterLabel } from "@/lib/boards/demographics";
import { boardUsesRegionFilter, entityMatchesRegion } from "@/lib/boards/regions";
import { channelUsesBoardHeatmap, rankLimitForBoard, rankLimitForChannel } from "@/lib/boards/limits";
import { isMarketQuoteBoardSlug } from "@/lib/market/kospi-quotes";
import { withIndexPoints } from "@/lib/ingestion/composite";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import type { PostChannel } from "@/lib/posts/types";
import type { MarketIndex, RankingEntity, RankingsPayload } from "@/lib/types";

const HeadlineNewsRanking = dynamic(
  () =>
    import("@/components/politics/HeadlineNewsRanking").then((mod) => mod.HeadlineNewsRanking),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] animate-pulse rounded-2xl border border-line/60 bg-panel" aria-hidden />
    ),
  },
);

function usesBoardHeatmap(channel: PostChannel): boolean {
  return channelUsesBoardHeatmap(channel);
}

/** Quote boards + economy 종합 must never optimistic-paint KinDex-only rows. */
function needsQuotedPaint(channel: PostChannel, board: string): boolean {
  return isMarketQuoteBoardSlug(board) || (channel === "economy" && !board);
}

function cacheKeyForBoard(board: string): string {
  return board || "";
}

function seedQuoteMap(
  initialQuotedByBoard?: Record<string, RankingEntity[]>,
  initialItems?: RankingEntity[],
): Map<string, RankingEntity[]> {
  const map = new Map<string, RankingEntity[]>();
  if (initialQuotedByBoard) {
    for (const [key, rows] of Object.entries(initialQuotedByBoard)) {
      if (rows?.length) map.set(key, rows);
    }
  }
  if (!map.has("") && initialItems?.length) {
    map.set("", initialItems);
  }
  return map;
}

/**
 * The live payload, narrowed to what actually reaches the screen.
 *
 * The full `RankingsPayload` is ~217 KB of every channel's entities, each with
 * its own history, sparkline and per-timeframe metrics. This component only
 * ever read its own channel's slice plus the index list and the clock, so the
 * rest was serialised into the RSC stream and discarded on arrival. The parent
 * now does the filtering on the server.
 */
export interface ChannelLiveMarket {
  updatedAt: string;
  status: RankingsPayload["status"];
  items: RankingEntity[];
  indices: MarketIndex[];
}

function heatmapMaxItems(channel: PostChannel, boardSlug: string, region: HeatmapRegion = "all"): number {
  if (boardSlug) {
    const board = getBoard(boardSlug);
    if (board) return rankLimitForBoard(board, region);
  }
  return rankLimitForChannel(channel);
}

export function ChannelMarketDesk({
  channel,
  boards,
  liveMarket,
  initialItems,
  initialQuotedByBoard,
  initialBoardSlug = "",
  initialRegion = "all",
  onBoardChange,
}: {
  channel: PostChannel;
  boards: HeatmapBoardPayload[];
  liveMarket: ChannelLiveMarket;
  /** SSR rows with Naver quotes already attached for stock/FX tiles. */
  initialItems?: RankingEntity[];
  /**
   * Preloaded quoted heatmaps keyed by board slug (`""` = 종합).
   * Used so 주식/해외/원자재·환율 tabs never flash KinDex scores.
   */
  initialQuotedByBoard?: Record<string, RankingEntity[]>;
  /** Pre-select a board tab (e.g. travel region sub-routes). */
  initialBoardSlug?: string;
  /** Pre-select a region tab when the board supports it. */
  initialRegion?: HeatmapRegion;
  /** Fires when the ranking-board rail selection changes (incl. 종합 → ""). */
  onBoardChange?: (slug: string) => void;
}) {
  const boardHeatmap = usesBoardHeatmap(channel);
  const [selectedSlug, setSelectedSlug] = useState(initialBoardSlug);
  const [gender, setGender] = useState<HeatmapGender>("all");
  const [age, setAge] = useState<HeatmapAge>("all");
  const [region, setRegion] = useState<HeatmapRegion>(() =>
    boardUsesRegionFilter(initialBoardSlug) ? initialRegion : "all",
  );
  const liveItems = liveMarket.items;
  const quotedCacheRef = useRef<Map<string, RankingEntity[]>>(
    seedQuoteMap(initialQuotedByBoard, initialItems),
  );

  const [items, setItems] = useState<RankingEntity[]>(() => {
    const key = cacheKeyForBoard(initialBoardSlug);
    const cached =
      initialQuotedByBoard?.[key] ??
      (initialItems?.length && !initialBoardSlug ? initialItems : undefined);
    if (cached?.length) return cached;
    return buildHeatmapItems({
      boards,
      liveItems,
      board: initialBoardSlug || undefined,
      gender: "all",
      age: "all",
      region: boardUsesRegionFilter(initialBoardSlug) ? initialRegion : "all",
      preferLive: !boardHeatmap && !initialBoardSlug,
    });
  });
  const [title, setTitle] = useState(() => heatmapBoardTitle(boards, initialBoardSlug || undefined));
  const [flashNonce, setFlashNonce] = useState(0);
  const [headlineItems, setHeadlineItems] = useState<RankingEntity[]>([]);
  const [boardIndices, setBoardIndices] = useState<MarketIndex[]>(() =>
    boards.map((board) => {
      const index = computeBoardIndex(board.ranking, board.slug);
      return withIndexPoints({
        id: board.slug,
        label: board.shortTitle,
        value: index.value,
        changeRate: index.changeRate,
        note: board.title,
        href: boardPath(board.slug),
      });
    }),
  );
  const [refreshing, setRefreshing] = useState(false);

  const applyLocal = useCallback(
    (board: string, nextGender: HeatmapGender, nextAge: HeatmapAge, nextRegion: HeatmapRegion) => {
      const next = buildHeatmapItems({
        boards,
        liveItems,
        board: board || undefined,
        gender: nextGender,
        age: nextAge,
        region: boardUsesRegionFilter(board) ? nextRegion : "all",
        preferLive: !boardHeatmap && !board,
      });
      setItems(next);
      setTitle(heatmapBoardTitle(boards, board || undefined));
      setFlashNonce((value) => value + 1);
    },
    [boards, liveItems, boardHeatmap],
  );

  /** Paint quoted SSR/API cache immediately — never KinDex-only for quote boards. */
  const paintQuotedCache = useCallback(
    (board: string, nextGender: HeatmapGender, nextAge: HeatmapAge, nextRegion: HeatmapRegion) => {
      const key = cacheKeyForBoard(board);
      const defaultFilters =
        nextGender === "all" &&
        nextAge === "all" &&
        (!boardUsesRegionFilter(board) || nextRegion === "all");
      const cached = defaultFilters ? quotedCacheRef.current.get(key) : undefined;
      if (cached?.length) {
        setItems(cached);
        setTitle(heatmapBoardTitle(boards, board || undefined));
        setFlashNonce((value) => value + 1);
        return true;
      }
      // Keep previous tiles; only update the title so KinDex rows never flash.
      setTitle(heatmapBoardTitle(boards, board || undefined));
      return false;
    },
    [boards],
  );

  const onSelectBoard = useCallback(
    (slug: string) => {
      const nextAge = clampAgeForBoard(slug || undefined, age);
      const nextRegion = boardUsesRegionFilter(slug) ? region : "all";
      setSelectedSlug(slug);
      setAge(nextAge);
      if (!boardUsesRegionFilter(slug)) setRegion("all");
      if (needsQuotedPaint(channel, slug)) {
        paintQuotedCache(slug, gender, nextAge, nextRegion);
      } else {
        applyLocal(slug, gender, nextAge, nextRegion);
      }
      onBoardChange?.(slug);
    },
    [age, region, gender, channel, paintQuotedCache, applyLocal, onBoardChange],
  );

  const selectedDef = selectedSlug ? getBoard(selectedSlug) : undefined;
  const deskKind = selectedDef?.deskKind;

  const heatmapRequestRef = useRef(0);
  const fetchHeatmap = useCallback(
    async (board: string, nextGender: HeatmapGender, nextAge: HeatmapAge, nextRegion: HeatmapRegion) => {
      const requestId = ++heatmapRequestRef.current;
      if (needsQuotedPaint(channel, board)) {
        paintQuotedCache(board, nextGender, nextAge, nextRegion);
      } else {
        applyLocal(board, nextGender, nextAge, nextRegion);
      }
      const params = new URLSearchParams({
        category: channel,
        gender: nextGender,
        age: nextAge,
      });
      if (board) params.set("board", board);
      params.set("region", boardUsesRegionFilter(board) ? nextRegion : "all");
      try {
        // Default fetch honors `/api/heatmap` Cache-Control (s-maxage=180).
        const response = await fetch(`/api/heatmap?${params.toString()}`);
        if (!response.ok || requestId !== heatmapRequestRef.current) return;
        const payload = (await response.json()) as {
          items?: RankingEntity[];
          title?: string;
          board?: string | null;
        };
        if (requestId !== heatmapRequestRef.current) return;
        if (board && (payload.board ?? "") !== board) {
          if (!needsQuotedPaint(channel, board)) {
            applyLocal(board, nextGender, nextAge, nextRegion);
          }
          return;
        }
        if (Array.isArray(payload.items) && payload.items.length) {
          const locked =
            boardUsesRegionFilter(board) && nextRegion !== "all"
              ? payload.items.filter((item) => entityMatchesRegion(item, nextRegion))
              : payload.items;
          const nextItems = locked.length ? locked : payload.items;
          if (nextItems.length) {
            setItems(nextItems);
            if (payload.title) setTitle(payload.title);
            if (
              nextGender === "all" &&
              nextAge === "all" &&
              (!boardUsesRegionFilter(board) || nextRegion === "all")
            ) {
              quotedCacheRef.current.set(cacheKeyForBoard(board), nextItems);
            }
            return;
          }
        }
        if (!needsQuotedPaint(channel, board)) {
          applyLocal(board, nextGender, nextAge, nextRegion);
        }
      } catch {
        /* quoted cache or previous tiles already painted */
      }
    },
    [applyLocal, paintQuotedCache, channel],
  );

  const skipInitialHeatmapFetch = useRef(true);
  useEffect(() => {
    if (deskKind) return;
    // SSR already painted the default board. Skip the extra /api/heatmap
    // round-trip on first mount so a tile click is not competing with it.
    if (skipInitialHeatmapFetch.current) {
      skipInitialHeatmapFetch.current = false;
      return;
    }
    void fetchHeatmap(selectedSlug, gender, age, region);
  }, [selectedSlug, gender, age, region, fetchHeatmap, deskKind]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBoardIndices(
        boards.map((board) => {
          const source = board.slug === selectedSlug && items.length ? items : board.ranking;
          const index = computeBoardIndex(source, board.slug);
          return withIndexPoints({
            id: board.slug,
            label: board.shortTitle,
            value: index.value,
            changeRate: index.changeRate,
            note: board.title,
            href: boardPath(board.slug),
          });
        }),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [boards, selectedSlug, items]);

  useEffect(() => {
    if (deskKind !== "headlines") setHeadlineItems([]);
  }, [deskKind]);

  const fetchHeatmapRef = useRef(fetchHeatmap);
  fetchHeatmapRef.current = fetchHeatmap;
  const refreshTargetRef = useRef({ selectedSlug, gender, age, region, deskKind });
  refreshTargetRef.current = { selectedSlug, gender, age, region, deskKind };

  const onHeatmapRefresh = useCallback(() => {
    const target = refreshTargetRef.current;
    if (target.deskKind) return;
    setRefreshing(true);
    void fetchHeatmapRef
      .current(target.selectedSlug, target.gender, target.age, target.region)
      .finally(() => setRefreshing(false));
  }, []);

  const liveIndices = liveMarket.indices;

  /**
   * Summary cards mirror the board rail above them.
   *
   * Politics used to fall through to `liveIndices` whenever no board was
   * selected, which painted a hardcoded 12-index list (대통령지지도, 정치검색지수 …)
   * that no rail menu maps to. Keying off the rail instead keeps every channel
   * on one card per menu; the live indices remain the fallback for a channel
   * that has no boards at all.
   */
  const indices = boards.length ? boardIndices : liveIndices;
  const selectedBoard = boards.find((item) => item.slug === selectedSlug);
  const showRegion = boardUsesRegionFilter(selectedSlug);
  const demo = filterLabel(gender, age, showRegion ? region : "all");
  const showHeatmap = deskKind !== "headlines";
  const tickerItems = deskKind === "headlines" ? headlineItems : showHeatmap ? items : [];
  const boardRail = (
    <CategoryBoardRail channel={channel} selectedSlug={selectedSlug} onSelect={onSelectBoard} />
  );

  return (
    <>
      <div className="order-1 -mx-4 md:order-2">
        {tickerItems.length ? <TickerTape items={tickerItems} /> : null}
      </div>
      <div className="order-3 space-y-3 md:order-3">
        {boardRail}
        {deskKind === "headlines" ? (
          <HeadlineNewsRanking channel={channel} onItems={setHeadlineItems} />
        ) : null}
        {showHeatmap ? (
          <MarketWorkspace
            items={items}
            flashNonce={flashNonce}
            initialView="treemap"
            hideCategoryTabs
            hideTimeframes={false}
            skipDemographicSkew={Boolean(selectedSlug) || boardHeatmap}
            gender={gender}
            age={age}
            region={region}
            onGender={setGender}
            onAge={setAge}
            onRegion={setRegion}
            showRegion={showRegion}
            boardSlug={selectedSlug || undefined}
            channel={channel}
            maxItems={heatmapMaxItems(channel, selectedSlug, region)}
            refreshIntervalSec={DEFAULT_TRENDS_REVALIDATE_SEC}
            refreshing={refreshing}
            onRefresh={onHeatmapRefresh}
            title={selectedBoard ? selectedBoard.title : title}
            subtitle={
              selectedBoard?.slug === "kospi-fomo-index" ||
              selectedBoard?.slug === "overseas-stock-index"
                ? `${demo === "전체" ? "전체" : demo} 순위 · 현재가·전일 대비 등락률을 히트맵에 표시합니다. 약 3분마다 갱신됩니다.`
                : selectedBoard?.slug === "commodities-fx-index"
                  ? `${demo === "전체" ? "전체" : demo} 순위 · 환율·원자재 시세·등락률을 히트맵에 표시합니다. 약 3분마다 갱신됩니다.`
                : selectedBoard
                  ? `${demo === "전체" ? "전체" : demo} 순위 · 100점 척도. 분봉 필터와 성별·연령${showRegion ? "·지역" : ""} 탭이 함께 적용됩니다.`
                  : channel === "economy"
                    ? `${demo === "전체" ? "채널 종합" : demo} · 주식·해외 주식·원자재·환율 타일은 현재가(단위)로 표시됩니다.`
                    : `${demo === "전체" ? "채널 종합" : demo} · 상단 보드 주제와 1:1로 묶인 히트맵입니다.`
            }
          />
        ) : null}
        {showHeatmap && indices.length ? (
          <MarketOverview
            indices={indices}
            flashNonce={flashNonce}
            selectedId={selectedSlug || undefined}
            hideOnMobileIds={
              channel === "politics" ? (["policy-controversy-index"] as const) : undefined
            }
            enlargeDesktopTitleScore={
              channel === "entertainment" ||
              channel === "economy" ||
              channel === "politics" ||
              channel === "culture"
            }
          />
        ) : null}
      </div>
    </>
  );
}
