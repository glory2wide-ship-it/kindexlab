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
  const [indices, setIndices] = useState(initialMarket.indices);
  const [items, setItems] = useState(initialMarket.items);
  const [, setUpdatedAt] = useState(initialMarket.updatedAt);
  const [, setStatus] = useState(initialMarket.status);
  const [refreshing, setRefreshing] = useState(false);
  const [flashNonce, setFlashNonce] = useState(0);
  const inFlightRef = useRef(false);

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
      }
    } finally {
      inFlightRef.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const forceRefresh = () => {
      void refresh();
    };
    window.addEventListener("kindexlab:refresh-now", forceRefresh);
    return () => window.removeEventListener("kindexlab:refresh-now", forceRefresh);
  }, [refresh]);

  const boardItems = channel ? itemsForChannel(items, channel) : items.filter((item) => !isPoliticsEntityType(item.type));
  const boardIndices =
    channel === "politics"
      ? [
          ...indices.filter((index) => index.id === COMPOSITE_INDEX_ID),
          ...indices.filter(isPoliticsIndex),
        ]
      : indices.filter((index) => !isPoliticsIndex(index));
  const politicsBoard = channel === "politics";

  return (
    <>
      {children ? <div className="order-3">{children}</div> : null}
      <div className="order-2 -mx-4">
        {boardItems.length ? <TickerTape items={boardItems} /> : null}
      </div>
      <div className="order-3 space-y-3">
        <MarketWorkspace
          key={channel ?? initialCategory}
          items={boardItems}
          initialCategory={initialCategory}
          flashNonce={flashNonce}
          initialView="treemap"
          categories={politicsBoard ? POLITICS_CATEGORIES : undefined}
          channel={channel}
          title={politicsBoard ? `정치 ${LIVE_INDEX_LABEL}` : LIVE_INDEX_LABEL}
          subtitle={
            politicsBoard
              ? "9대 정치 지표를 히트맵과 리스트로 읽습니다. 기본 시계열은 5분봉입니다."
              : "등락률·버즈·거래량을 히트맵과 리스트로 읽습니다."
          }
          refreshIntervalSec={refreshIntervalSec}
          refreshing={refreshing}
          onRefresh={() => void refresh()}
        />
        <MarketOverview indices={boardIndices} flashNonce={flashNonce} />
        {afterOverview}
      </div>
    </>
  );
}
