"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { DemographicTabs } from "@/components/boards/DemographicTabs";
import { HeatmapCountdownFallback } from "@/components/dashboard/HeatmapCountdown";
import { HeatmapErrorBoundary } from "@/components/dashboard/HeatmapErrorBoundary";
import { HeatmapLegend } from "@/components/dashboard/HeatmapLegend";
import { RankingTable } from "@/components/dashboard/RankingTable";
import { TreemapSkeleton } from "@/components/dashboard/TreemapSkeleton";
import { TREEMAP_MAX_ITEMS } from "@/components/dashboard/treemap-config";

/**
 * Heatmap + d3-hierarchy load as their own chunk. SSR is off so a stale
 * client bundle cannot hydrate against a newer server tree (the overlay
 * that kept firing after layout/search edits). The skeleton keeps height
 * stable until the chunk arrives.
 */
const TreemapView = dynamic(
  () => import("@/components/dashboard/TreemapCanvas").then((mod) => mod.TreemapView),
  { ssr: false, loading: () => <TreemapSkeleton /> },
);
const HeatmapCountdown = dynamic(
  () => import("@/components/dashboard/HeatmapCountdown").then((mod) => mod.HeatmapCountdown),
  { ssr: false, loading: () => <HeatmapCountdownFallback /> },
);
import { MethodologyModal } from "@/components/methodology/MethodologyModal";
import { applyDemographicSkew } from "@/lib/boards/entity-skew";
import { filterKey, filterLabel } from "@/lib/boards/demographics";
import { CATEGORIES, TIMEFRAMES } from "@/lib/categories";
import type { AgeSegment, GenderSegment, RegionSegment } from "@/lib/boards/types";
import { isHeadlineFeed, rankHeadlineFeed } from "@/lib/news/headline-rank";
import { LIVE_INDEX_LABEL } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import { entityMatchesRegion } from "@/lib/boards/regions";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import { rankItemsForTimeframe } from "@/lib/timeframes";
import type { CategoryId, RankingEntity, Timeframe, ViewMode } from "@/lib/types";

export function MarketWorkspace({
  items,
  initialCategory = "all",
  flashNonce = 0,
  initialView = "treemap",
  categories = CATEGORIES,
  title = LIVE_INDEX_LABEL,
  subtitle = "등락률·버즈·거래량을 히트맵과 리스트로 읽습니다.",
  gender: genderProp,
  age: ageProp,
  region: regionProp,
  onGender,
  onAge,
  onRegion,
  skipDemographicSkew = false,
  hideCategoryTabs = false,
  hideTimeframes = false,
  boardSlug,
  showRegion = false,
  maxItems = TREEMAP_MAX_ITEMS,
  remainingSec = DEFAULT_TRENDS_REVALIDATE_SEC,
  refreshing = false,
  channel,
}: {
  items: RankingEntity[];
  initialCategory?: CategoryId;
  flashNonce?: number;
  initialView?: ViewMode;
  categories?: { id: CategoryId; label: string }[];
  title?: string;
  subtitle?: string;
  gender?: "all" | GenderSegment;
  age?: "all" | AgeSegment;
  region?: "all" | RegionSegment;
  onGender?: (value: "all" | GenderSegment) => void;
  onAge?: (value: "all" | AgeSegment) => void;
  onRegion?: (value: "all" | RegionSegment) => void;
  skipDemographicSkew?: boolean;
  hideCategoryTabs?: boolean;
  hideTimeframes?: boolean;
  boardSlug?: string;
  showRegion?: boolean;
  /** When set, methodology modal uses that desk's copy. */
  channel?: PostChannel;
  /** Tile cap for this desk. Defaults to the shared ceiling. */
  maxItems?: number;
  remainingSec?: number;
  refreshing?: boolean;
}) {
  const [view, setView] = useState<ViewMode>(initialView);
  const [category, setCategory] = useState<CategoryId>(initialCategory);
  const [timeframe, setTimeframe] = useState<Timeframe>("3m");
  const [genderInternal, setGenderInternal] = useState<"all" | GenderSegment>("all");
  const [ageInternal, setAgeInternal] = useState<"all" | AgeSegment>("all");
  const [regionInternal, setRegionInternal] = useState<"all" | RegionSegment>("all");
  const [methodOpen, setMethodOpen] = useState(false);

  const gender = genderProp ?? genderInternal;
  const age = ageProp ?? ageInternal;
  const region = regionProp ?? regionInternal;
  const setGender = onGender ?? setGenderInternal;
  const setAge = onAge ?? setAgeInternal;
  const setRegion = onRegion ?? setRegionInternal;

  const filtered = useMemo(
    () => (category === "all" ? items : items.filter((item) => item.type === category)),
    [category, items],
  );
  /** Single source of truth: treemap + list both render this exact array. */
  const sortedItems = useMemo(() => {
    const cap = Math.max(1, Math.min(maxItems, TREEMAP_MAX_ITEMS));
    try {
      if (isHeadlineFeed(filtered)) {
        return rankHeadlineFeed(filtered, { timeframe, gender, age }).slice(0, cap);
      }
      const byTime = rankItemsForTimeframe(filtered, timeframe);
      const ordered = skipDemographicSkew ? byTime : applyDemographicSkew(byTime, gender, age);
      const regionLocked =
        showRegion && region !== "all"
          ? ordered.filter((item) => entityMatchesRegion(item, region))
          : ordered;
      const sliced = regionLocked.slice(0, cap).map((item, index) => ({ ...item, rank: index + 1 }));
      if (sliced.length) return sliced;
    } catch {
      /* keep tiles from the region-locked payload so a bad combo never mixes 시/도 */
    }
    const fallback =
      showRegion && region !== "all"
        ? filtered.filter((item) => entityMatchesRegion(item, region))
        : filtered;
    return fallback.slice(0, cap).map((item, index) => ({ ...item, rank: index + 1 }));
  }, [filtered, timeframe, gender, age, region, showRegion, skipDemographicSkew, maxItems]);
  const demoKey = filterKey(gender, age, region);
  const demoActive = gender !== "all" || age !== "all" || region !== "all";

  // Board tiles link straight to /ranking/[slug]; the analysis column lives there.
  return (
    <section id="heatmap" className="scroll-mt-36 overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold">{title}</h1>
            <p className="text-xs text-muted">{subtitle}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-board p-1">
              {(
                [
                  ["treemap", "히트맵"],
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
              className="inline-flex items-center rounded-md border border-line px-3 text-xs text-muted hover:text-ink"
              style={{ height: 30, boxSizing: "border-box" }}
            >
              시세 산출 방식
            </button>
            <HeatmapCountdown remainingSec={remainingSec} refreshing={refreshing} />
          </div>
        </div>

        {hideCategoryTabs ? null : (
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
        )}

        {hideTimeframes ? null : (
        <div className="flex flex-wrap gap-1 rounded-lg bg-board p-1">
          {TIMEFRAMES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTimeframe(option.id)}
              className={`rounded-md px-3 py-1.5 font-sans text-[11px] font-medium ${
                timeframe === option.id
                  ? "bg-ink text-board"
                  : "text-muted hover:bg-panel hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        )}

        <DemographicTabs
          gender={gender}
          age={age}
          onGender={setGender}
          onAge={setAge}
          boardSlug={boardSlug}
          region={region}
          onRegion={setRegion}
          showRegion={showRegion}
        />
        {demoActive ? (
          <p className="text-[11px] leading-5 text-muted">
            {filterLabel(gender, age, region)}{" "}
            {isHeadlineFeed(filtered)
              ? "분봉 급상승·성별·연령 가중치로 헤드라인 순위를 다시 매겼습니다."
              : skipDemographicSkew
                ? "세그먼트 순위로 히트맵을 다시 그렸습니다."
                : "관심 가중치로 순위를 다시 매겼습니다. 분봉 필터와 함께 적용됩니다."}
          </p>
        ) : null}
      </div>

      <div
        key={`${demoKey}-${timeframe}`}
        className={`relative flex h-full min-h-0 flex-1 flex-col items-stretch ${flashNonce > 0 ? "market-live-flash" : ""}`}
      >
        {sortedItems.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-semibold">
              {showRegion && region !== "all"
                ? `${filterLabel("all", "all", region)} 데이터를 모으는 중입니다`
                : "이 카테고리 시세 데이터가 아직 없습니다"}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted">
              {showRegion && region !== "all"
                ? "다른 시/도 항목은 섞지 않습니다. 해당 지역 목록이 채워지면 히트맵이 다시 그려집니다."
                : "하단 랭킹·지수 보드에서 성별·연령별 순위를 볼 수 있습니다. 시세 종목은 다음 집계 주기에 채워집니다."}
            </p>
          </div>
        ) : view === "treemap" ? (
          <HeatmapErrorBoundary
            resetKey={`${demoKey}-${timeframe}`}
            fallback={<RankingTable items={sortedItems} timeframe={timeframe} lockOrder />}
          >
            <TreemapView
              key={`${demoKey}-${timeframe}-${sortedItems.length}`}
              items={sortedItems}
              category={category}
              timeframe={timeframe}
              showSourceCaptions={!boardSlug}
            />
          </HeatmapErrorBoundary>
        ) : (
          <RankingTable items={sortedItems} timeframe={timeframe} lockOrder />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-panel px-4 py-2 font-sans text-[10px] text-muted">
        <span>
          상승 초록 · 하락 빨강 · 보합 차콜 · 히트맵 {sortedItems.length} · 리스트 {sortedItems.length}
          종목
        </span>
        {view === "treemap" && sortedItems.length > 0 ? (
          <HeatmapLegend />
        ) : (
          <span>KOREA INDEX LAB. Hierarchical Heatmap</span>
        )}
      </div>

      <MethodologyModal open={methodOpen} onClose={() => setMethodOpen(false)} channel={channel} />
    </section>
  );
}
