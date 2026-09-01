"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { MarketWorkspace } from "@/components/dashboard/MarketWorkspace";
import { TickerTape } from "@/components/ticker/TickerTape";
import { fetchTrendsSnapshot, mergeTrendItems } from "@/lib/liveTrends";
import { itemsForChannel, LIVE_INDEX_LABEL } from "@/lib/posts/channels";
import { isPoliticsEntityType, isPoliticsIndex, POLITICS_CATEGORIES } from "@/lib/politics/types";
import { COMPOSITE_INDEX_ID } from "@/lib/ingestion/composite";
import type { PostChannel } from "@/lib/posts/types";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import type { CategoryId, RankingsPayload } from "@/lib/types";

export function LiveMarketBoard({
  initialMarket,
  initialCategory = "all",
  refreshIntervalSec = DEFAULT_TRENDS_REVALIDATE_SEC,
  channel,
  children,
  afterOverview,
}: {
  initialMarket: RankingsPayload;
  initialCategory?: CategoryId;
  refreshIntervalSec?: number;
  channel?: PostChannel;
  compact?: boolean;
  children?: ReactNode;
  afterOverview?: ReactNode;
}) {
  const intervalMs = Math.max(1, refreshIntervalSec) * 1000;
  const [indices, setIndices] = useState(initialMarket.indices);
  const [items, setItems] = useState(initialMarket.items);
  const [, setUpdatedAt] = useState(initialMarket.updatedAt);
  const [, setStatus] = useState(initialMarket.status);
  const [remainingSec, setRemainingSec] = useState(refreshIntervalSec);
  const [refreshing, setRefreshing] = useState(false);
  const [flashNonce, setFlashNonce] = useState(0);
  const deadlineRef = useRef(0);
  const inFlightRef = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      const next = await fetchTrendsSnapshot();
      if (next) {
        setIndices(next.indices);
        setUpdatedAt(next.updatedAt);
        setStatus(next.status);
        setItems((prev) => mergeTrendItems(prev, next.items));
        setFlashNonce((value) => value + 1);
        deadlineRef.current = Date.now() + intervalMs;
      } else {
        deadlineRef.current = Date.now() + 15_000;
      }
    } catch {
      deadlineRef.current = Date.now() + 15_000;
    } finally {
      inFlightRef.current = false;
      setRefreshing(false);
      setRemainingSec(
        Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)),
      );
    }
  }, [intervalMs]);

  refreshRef.current = refresh;

  useEffect(() => {
    deadlineRef.current = Date.now() + intervalMs;
    setRemainingSec(Math.max(1, Math.round(intervalMs / 1000)));
    const tick = window.setInterval(() => {
      const remainingMs = deadlineRef.current - Date.now();
      setRemainingSec(Math.max(0, Math.ceil(remainingMs / 1000)));
      if (remainingMs <= 0) {
        void refreshRef.current();
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [intervalMs]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const forceRefresh = () => {
      deadlineRef.current = Date.now();
    };
    window.addEventListener("kindexlab:refresh-now", forceRefresh);
    return () => window.removeEventListener("kindexlab:refresh-now", forceRefresh);
  }, []);

  const boardItems = channel ? itemsForChannel(items, channel) : items.filter((item) => !isPoliticsEntityType(item.type));
  const boardIndices =
    channel === "politics"
      ? [
          ...indices.filter((index) => index.id === COMPOSITE_INDEX_ID),
          ...indices.filter(isPoliticsIndex),
        ]
      : indices.filter((index) => !isPoliticsIndex(index));
  const politicsBoard = channel === "politics";

  // Ranking rail (when provided) sits in children. Countdown + ticker follow,
  // then the heatmap, then index summary cards.
  return (
    <div className="space-y-3">
      {children}
      <div className="-mx-4">
        {boardItems.length ? <TickerTape items={boardItems} /> : null}
      </div>
      <MarketWorkspace
        key={channel ?? initialCategory}
        items={boardItems}
        initialCategory={initialCategory}
        flashNonce={flashNonce}
        initialView="treemap"
        categories={politicsBoard ? POLITICS_CATEGORIES : undefined}
        title={politicsBoard ? `정치 ${LIVE_INDEX_LABEL}` : LIVE_INDEX_LABEL}
        subtitle={
          politicsBoard
            ? "9대 정치 지표를 히트맵과 리스트로 읽습니다. 기본 시계열은 5분봉입니다."
            : "등락률·버즈·거래량을 히트맵과 리스트로 읽습니다."
        }
        remainingSec={remainingSec}
        refreshing={refreshing}
      />
      <MarketOverview indices={boardIndices} flashNonce={flashNonce} />
      {afterOverview}
    </div>
  );
}
