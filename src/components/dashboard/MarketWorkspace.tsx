"use client";

import { useMemo, useState } from "react";
import { RankingTable } from "@/components/dashboard/RankingTable";
import { heatmapVisibleCount, TreemapView } from "@/components/dashboard/TreemapView";
import { MethodologyModal } from "@/components/methodology/MethodologyModal";
import { CATEGORIES, TIMEFRAMES } from "@/lib/categories";
import { rankItemsForTimeframe } from "@/lib/timeframes";
import type { CategoryId, RankingEntity, Timeframe, ViewMode } from "@/lib/types";

export function MarketWorkspace({
  items,
  initialCategory = "all",
  flashNonce = 0,
  initialView = "treemap",
  categories = CATEGORIES,
  title = "실시간 시세",
  subtitle = "등락률·버즈·거래량을 트리맵과 리스트로 읽습니다.",
}: {
  items: RankingEntity[];
  initialCategory?: CategoryId;
  flashNonce?: number;
  initialView?: ViewMode;
  categories?: { id: CategoryId; label: string }[];
  title?: string;
  subtitle?: string;
}) {
  const [view, setView] = useState<ViewMode>(initialView);
  const [category, setCategory] = useState<CategoryId>(initialCategory);
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const [methodOpen, setMethodOpen] = useState(false);

  const filtered = useMemo(
    () => (category === "all" ? items : items.filter((item) => item.type === category)),
    [category, items],
  );
  const ranked = useMemo(
    () => rankItemsForTimeframe(filtered, timeframe),
    [filtered, timeframe],
  );

  // Board tiles link straight to /ranking/[slug]; the analysis column lives there.
  return (
    <section id="heatmap" className="scroll-mt-36 overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-xs text-muted">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-board p-1">
              {(
                [
                  ["treemap", "트리맵"],
                  ["list", "리스트"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    view === id ? "bg-accent text-black" : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMethodOpen(true)}
              className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
            >
              시세 산출 방식
            </button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-lg bg-board p-1">
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
                category === item.id ? "bg-accent text-black" : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg bg-board p-1">
          {TIMEFRAMES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTimeframe(option.id)}
              className={`rounded-md px-3 py-1.5 font-mono text-[11px] font-medium ${
                timeframe === option.id
                  ? "bg-ink text-board"
                  : "text-muted hover:bg-panel hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {view === "treemap" ? (
        <div className={flashNonce > 0 ? "market-live-flash" : undefined}>
          <TreemapView items={ranked} category={category} timeframe={timeframe} />
        </div>
      ) : (
        <div className={flashNonce > 0 ? "market-live-flash" : undefined}>
          <RankingTable items={ranked} timeframe={timeframe} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 font-sans text-[10px] text-muted">
        <span>
          범례: 상승 빨강 · 하락 파랑 · 보합 회색 · 히트맵 {heatmapVisibleCount(ranked, timeframe)} ·
          리스트 {ranked.length}종목
        </span>
        <span>Finviz-style hierarchical heatmap</span>
      </div>

      <MethodologyModal open={methodOpen} onClose={() => setMethodOpen(false)} />
    </section>
  );
}
