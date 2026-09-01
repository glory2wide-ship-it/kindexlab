"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CategoryBoardRail } from "@/components/boards/CategoryBoardRail";
import { MarketOverview, MarketStatusBar } from "@/components/dashboard/MarketOverview";
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
import { channelUsesBoardHeatmap } from "@/lib/boards/limits";
import { filterLabel } from "@/lib/boards/demographics";
import { boardUsesRegionFilter, entityMatchesRegion } from "@/lib/boards/regions";
import { HeadlineNewsRanking } from "@/components/politics/HeadlineNewsRanking";
import { SupportIndexChart } from "@/components/politics/SupportIndexChart";
import { withIndexPoints } from "@/lib/ingestion/composite";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import type { PostChannel } from "@/lib/posts/types";
import type { MarketIndex, RankingEntity, RankingsPayload } from "@/lib/types";

function usesBoardHeatmap(channel: PostChannel): boolean {
  return channelUsesBoardHeatmap(channel);
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

/**
 * Per-desk tile caps. 엔터테인먼트 and 정치 draw from far deeper pools than the
 * map can label legibly, so they stop at 25; the rest keep the shared ceiling.
 */
const CHANNEL_HEATMAP_MAX_ITEMS: Partial<Record<PostChannel, number>> = {
  entertainment: 25,
  politics: 25,
};

export function ChannelMarketDesk({
  channel,
  boards,
  liveMarket,
}: {
  channel: PostChannel;
  boards: HeatmapBoardPayload[];
  liveMarket: ChannelLiveMarket;
}) {
  const boardHeatmap = usesBoardHeatmap(channel);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [gender, setGender] = useState<HeatmapGender>("all");
  const [age, setAge] = useState<HeatmapAge>("all");
  const [region, setRegion] = useState<HeatmapRegion>("all");
  const liveItems = liveMarket.items;
  const [items, setItems] = useState<RankingEntity[]>(() =>
    buildHeatmapItems({
      boards,
      liveItems,
      gender: "all",
      age: "all",
      preferLive: !boardHeatmap,
    }),
  );
  const [title, setTitle] = useState(() => heatmapBoardTitle(boards));
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
  const [remainingSec, setRemainingSec] = useState(DEFAULT_TRENDS_REVALIDATE_SEC);
  const [refreshing, setRefreshing] = useState(false);
  const onSelectBoard = useCallback((slug: string) => {
    setSelectedSlug(slug);
    setAge((current) => clampAgeForBoard(slug || undefined, current));
    if (!boardUsesRegionFilter(slug)) setRegion("all");
  }, []);

  const selectedDef = selectedSlug ? getBoard(selectedSlug) : undefined;
  const deskKind = selectedDef?.deskKind;

  const applyLocal = useCallback(
    (board: string, nextGender: HeatmapGender, nextAge: HeatmapAge, nextRegion: HeatmapRegion) => {
      const next = buildHeatmapItems({
        boards,
        liveItems,
        board: board || undefined,
        gender: nextGender,
        age: nextAge,
        region: boardUsesRegionFilter(board) ? nextRegion : "all",
        preferLive: !boardHeatmap,
      });
      setItems(next);
      setTitle(heatmapBoardTitle(boards, board || undefined));
      setFlashNonce((value) => value + 1);
    },
    [boards, liveItems, boardHeatmap],
  );

  const fetchHeatmap = useCallback(
    async (board: string, nextGender: HeatmapGender, nextAge: HeatmapAge, nextRegion: HeatmapRegion) => {
      applyLocal(board, nextGender, nextAge, nextRegion);
      const params = new URLSearchParams({
        category: channel,
        gender: nextGender,
        age: nextAge,
      });
      if (board) params.set("board", board);
      params.set("region", boardUsesRegionFilter(board) ? nextRegion : "all");
      try {
        const response = await fetch(`/api/heatmap?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          items?: RankingEntity[];
          title?: string;
        };
        if (Array.isArray(payload.items) && payload.items.length) {
          const locked =
            boardUsesRegionFilter(board) && nextRegion !== "all"
              ? payload.items.filter((item) => entityMatchesRegion(item, nextRegion))
              : payload.items;
          if (locked.length) {
            setItems(locked);
            if (payload.title) setTitle(payload.title);
            return;
          }
        }
        applyLocal(board, nextGender, nextAge, nextRegion);
      } catch {
        /* local ranking already painted */
      }
    },
    [applyLocal, channel],
  );

  const filterKeyRef = useRef("");
  const selectedSlugRef = useRef(selectedSlug);
  useEffect(() => {
    if (deskKind) return;
    const nextKey = `${selectedSlug}:${gender}:${age}:${region}`;
    const menuChanged = selectedSlugRef.current !== selectedSlug;
    selectedSlugRef.current = selectedSlug;
    if (
      menuChanged ||
      (boardUsesRegionFilter(selectedSlug) &&
        filterKeyRef.current &&
        filterKeyRef.current !== nextKey)
    ) {
      setItems([]);
      setBoardIndices([]);
    }
    filterKeyRef.current = nextKey;
    void fetchHeatmap(selectedSlug, gender, age, region);
  }, [selectedSlug, gender, age, region, fetchHeatmap, deskKind]);

  useEffect(() => {
    setBoardIndices([]);
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
  const deadlineRef = useRef(0);

  useEffect(() => {
    const intervalMs = DEFAULT_TRENDS_REVALIDATE_SEC * 1000;
    deadlineRef.current = Date.now() + intervalMs;
    setRemainingSec(DEFAULT_TRENDS_REVALIDATE_SEC);
    const tick = window.setInterval(() => {
      const remainingMs = deadlineRef.current - Date.now();
      setRemainingSec(Math.max(0, Math.ceil(remainingMs / 1000)));
      if (remainingMs > 0) return;
      deadlineRef.current = Date.now() + intervalMs;
      const target = refreshTargetRef.current;
      if (target.deskKind) return;
      setRefreshing(true);
      void fetchHeatmapRef
        .current(target.selectedSlug, target.gender, target.age, target.region)
        .finally(() => setRefreshing(false));
    }, 250);
    return () => window.clearInterval(tick);
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
  const showHeatmap = !deskKind;
  const tickerItems = deskKind === "headlines" ? headlineItems : showHeatmap ? items : [];
  const boardRail = (
    <CategoryBoardRail channel={channel} selectedSlug={selectedSlug} onSelect={onSelectBoard} />
  );
  const statusAndTicker = (
    <div className="-mx-4">
      <MarketStatusBar
        updatedAt={liveMarket.updatedAt}
        status={liveMarket.status}
        remainingSec={remainingSec}
        refreshing={refreshing}
      />
      {tickerItems.length ? <TickerTape items={tickerItems} /> : null}
    </div>
  );

  return (
    <div className="space-y-3">
      {statusAndTicker}
      {boardRail}
      {deskKind === "headlines" ? (
        <HeadlineNewsRanking channel={channel} onItems={setHeadlineItems} />
      ) : null}
      {deskKind === "party-poll" ? <SupportIndexChart kind="party" /> : null}
      {deskKind === "politician-poll" ? <SupportIndexChart kind="politician" /> : null}
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
          maxItems={CHANNEL_HEATMAP_MAX_ITEMS[channel]}
          title={selectedBoard ? selectedBoard.title : title}
          subtitle={
            selectedBoard
              ? `${demo === "전체" ? "전체" : demo} 순위 · 100점 척도. 분봉 필터와 성별·연령${showRegion ? "·지역" : ""} 탭이 함께 적용됩니다.`
              : `${demo === "전체" ? "채널 종합" : demo} · 상단 보드 주제와 1:1로 묶인 히트맵입니다.`
          }
        />
      ) : null}
      {showHeatmap && indices.length ? (
        <MarketOverview indices={indices} flashNonce={flashNonce} selectedId={selectedSlug || undefined} />
      ) : null}
    </div>
  );
}
