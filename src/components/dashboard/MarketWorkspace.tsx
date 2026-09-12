"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DemographicTabs, RegionFilterTabs } from "@/components/boards/DemographicTabs";
import { HeatmapCountdownFallback } from "@/components/dashboard/HeatmapCountdown";
import { HeatmapErrorBoundary } from "@/components/dashboard/HeatmapErrorBoundary";
import { HeatmapLegend } from "@/components/dashboard/HeatmapLegend";
import { MobileHeatmapDials } from "@/components/dashboard/MobileHeatmapDials";
import { RankingTable } from "@/components/dashboard/RankingTable";
import { TreemapSkeleton } from "@/components/dashboard/TreemapSkeleton";
import {
  TREEMAP_MAX_ITEMS,
  MOBILE_TREEMAP_MAX_ITEMS,
  LIST_MAX_ITEMS,
  MOBILE_LIST_MAX_ITEMS,
} from "@/components/dashboard/treemap-config";
import { HeaderRefreshCountdown } from "@/components/layout/HeaderRefreshCountdown";
import { MobileBottomSheet } from "@/components/layout/MobileBottomSheet";

/**
 * Heatmap stays in its own chunk, but SSR is on so the landing first paint
 * includes real tiles instead of a skeleton while the client chunk loads.
 * RankingTable stays static — dynamic import was the delay on 히트맵 → 리스트.
 */
const TreemapView = dynamic(
  () => import("@/components/dashboard/TreemapCanvas").then((mod) => mod.TreemapView),
  { ssr: true, loading: () => <TreemapSkeleton /> },
);
const HeatmapCountdown = dynamic(
  () => import("@/components/dashboard/HeatmapCountdown").then((mod) => mod.HeatmapCountdown),
  { ssr: false, loading: () => <HeatmapCountdownFallback /> },
);
const MethodologyModal = dynamic(
  () => import("@/components/methodology/MethodologyModal").then((mod) => mod.MethodologyModal),
  { ssr: false },
);

import { applyDemographicSkew } from "@/lib/boards/entity-skew";
import { uniqueHeatmapTiles } from "@/lib/boards/unique-tiles";
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
  desktopHeader,
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
  showChannelTags = false,
  maxItems = TREEMAP_MAX_ITEMS,
  remainingSec: _remainingSec = DEFAULT_TRENDS_REVALIDATE_SEC,
  refreshing = false,
  refreshIntervalSec = DEFAULT_TRENDS_REVALIDATE_SEC,
  onRefresh,
  channel,
  initialTimeframe,
}: {
  items: RankingEntity[];
  initialCategory?: CategoryId;
  flashNonce?: number;
  initialView?: ViewMode;
  categories?: { id: CategoryId; label: string }[];
  title?: string;
  subtitle?: string;
  /** Replaces desktop title/subtitle (e.g. ranking-board rail). Mobile unchanged. */
  desktopHeader?: ReactNode;
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
  /** Landing unified map: short desk tags beside tile ranks. */
  showChannelTags?: boolean;
  /** When set, methodology modal uses that desk's copy. */
  channel?: PostChannel;
  /** Tile cap for this desk. Defaults to the shared ceiling. */
  maxItems?: number;
  remainingSec?: number;
  refreshing?: boolean;
  refreshIntervalSec?: number;
  onRefresh?: () => void;
  /**
   * Override the default timeframe (mobile 10m / desktop 5m).
   * Landing passes 5m so SSR tiles match the unified market build.
   */
  initialTimeframe?: Timeframe;
}) {
  useEffect(() => {
    // Warm treemap after first paint so LCP bandwidth is not contested,
    // and warm the list module so 히트맵 → 리스트 stays snappy without
    // keeping RankingTable mounted (that caused a desktop list flash).
    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      void import("@/components/dashboard/TreemapCanvas");
      void import("@/components/dashboard/RankingTable");
    };
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(warm, { timeout: 1200 });
    } else {
      timeoutId = setTimeout(warm, 400);
    }
    return () => {
      cancelled = true;
      if (idleId != null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);

  const [view, setView] = useState<ViewMode>(initialView);
  const [category, setCategory] = useState<CategoryId>(initialCategory);
  /**
   * Mobile-first default is 10분 so the dial shows 5분 | 10분 | 30분.
   * Desktop flips to 5분 (aligned with refresh countdown).
   * Landing passes initialTimeframe="5m" so SSR tiles match the unified build.
   */
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe ?? "10m");
  const [genderInternal, setGenderInternal] = useState<"all" | GenderSegment>("all");
  const [ageInternal, setAgeInternal] = useState<"all" | AgeSegment>("all");
  const [regionInternal, setRegionInternal] = useState<"all" | RegionSegment>("all");
  const [methodOpen, setMethodOpen] = useState(false);
  const [userPickedView, setUserPickedView] = useState(false);

  /** Desktop toolbar defaults to 5분; mobile keeps the 10분 dial center.
   * Skip when the caller locked a timeframe (landing SSR = 5m). */
  useEffect(() => {
    if (initialTimeframe) return;
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) setTimeframe("5m");
  }, [initialTimeframe]);

  /** Keep default view in sync on viewport changes; never flash list on desktop. */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const applyDefault = () => {
      if (userPickedView) return;
      setView(mq.matches ? initialView : "treemap");
    };
    applyDefault();
    mq.addEventListener("change", applyDefault);
    return () => mq.removeEventListener("change", applyDefault);
  }, [initialView, userPickedView]);

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

  const [filterOpen, setFilterOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsMobileViewport(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /** Heatmap tile set (may be >10). List is ranked from the same pool, capped at 10. */
  const rankedPool = useMemo(() => {
    try {
      if (isHeadlineFeed(filtered)) {
        return rankHeadlineFeed(filtered, { timeframe, gender, age });
      }
      const byTime = rankItemsForTimeframe(filtered, timeframe);
      const ordered = skipDemographicSkew ? byTime : applyDemographicSkew(byTime, gender, age);
      const regionLocked =
        showRegion && region !== "all"
          ? ordered.filter((item) => entityMatchesRegion(item, region))
          : ordered;
      const unique = uniqueHeatmapTiles(regionLocked);
      if (unique.length) return unique;
    } catch {
      /* keep tiles from the region-locked payload so a bad combo never mixes 시/도 */
    }
    const fallback =
      showRegion && region !== "all"
        ? filtered.filter((item) => entityMatchesRegion(item, region))
        : filtered;
    return uniqueHeatmapTiles(fallback);
  }, [filtered, timeframe, gender, age, region, showRegion, skipDemographicSkew]);

  const sortedItems = useMemo(() => {
    const desktopCap = Math.max(1, Math.min(maxItems, TREEMAP_MAX_ITEMS));
    const cap = isMobileViewport
      ? Math.max(1, Math.min(desktopCap, MOBILE_TREEMAP_MAX_ITEMS))
      : desktopCap;
    return rankedPool.slice(0, cap).map((item, index) => ({ ...item, rank: index + 1 }));
  }, [rankedPool, maxItems, isMobileViewport]);

  const listItems = useMemo(() => {
    const listCap = isMobileViewport ? MOBILE_LIST_MAX_ITEMS : LIST_MAX_ITEMS;
    return rankedPool.slice(0, listCap).map((item, index) => ({ ...item, rank: index + 1 }));
  }, [rankedPool, isMobileViewport]);
  const demoKey = filterKey(gender, age, region);
  const demoActive = gender !== "all" || age !== "all" || region !== "all";
  /** Region has its own mobile dial; sheet is only for category tabs. */
  const needsExtraFilterSheet = !hideCategoryTabs;

  const CONTROL_H = 25.5;
  const DESKTOP_CONTROL_H = 30;

  const pickView = (id: ViewMode) => {
    setUserPickedView(true);
    setView(id);
  };

  const viewToggle = (compact: boolean) => {
    const tabs = (
      [
        ["treemap", "히트맵"],
        ["list", "리스트"],
      ] as const
    );
    return (
      <div
        className="flex rounded-md bg-board p-0.5"
        role="tablist"
        aria-label="보기 전환"
        style={{ height: compact ? CONTROL_H : DESKTOP_CONTROL_H }}
      >
        {tabs.map(([id, label]) => {
          const selected = view === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => pickView(id)}
              className={`inline-flex h-full items-center rounded px-2.5 text-[11px] font-medium leading-none md:px-3 md:text-[13.2px] ${
                selected
                  ? "bg-[#dc2626] text-white"
                  : "font-semibold text-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  };

  // Board tiles link straight to /ranking/[slug]; the analysis column lives there.
  return (
    <section id="heatmap" className="scroll-mt-36 overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
        {/* Mobile: row1 view+clock · row2 dial filters */}
        <div className="flex flex-col gap-1.5 md:hidden">
          <div className="flex items-center gap-1.5">
            {viewToggle(true)}
            <div className="ml-auto shrink-0">
              <HeaderRefreshCountdown intervalSec={refreshIntervalSec} />
            </div>
          </div>
          <div className="-mx-1 flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <MobileHeatmapDials
                timeframe={timeframe}
                onTimeframe={setTimeframe}
                gender={gender}
                onGender={setGender}
                age={age}
                onAge={setAge}
                region={region}
                onRegion={setRegion}
                showRegion={showRegion}
                boardSlug={boardSlug}
                hideTimeframes={hideTimeframes}
              />
            </div>
            {needsExtraFilterSheet ? (
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                aria-label="추가 필터"
                className="inline-flex shrink-0 items-center justify-center rounded-md border border-line bg-board px-1.5 text-[10px] font-semibold text-soft"
                style={{ height: 28 }}
              >
                설정
              </button>
            ) : null}
          </div>
        </div>

        {/* Desktop header — title/subtitle, or custom slot (board rail) */}
        <div className="hidden flex-wrap items-start justify-between gap-3 md:flex">
          <div className="min-w-0 flex-1">
            {desktopHeader ?? (
              <>
                <h1 className="text-base font-semibold">{title}</h1>
                <p className="mt-0.5 text-[13.79px] text-muted">{subtitle}</p>
              </>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 pt-0.5">
            {viewToggle(false)}
            <HeatmapCountdown
              intervalSec={refreshIntervalSec}
              refreshing={refreshing}
              onExpire={isMobileViewport ? undefined : onRefresh}
            />
          </div>
        </div>

        {/* Desktop toolbar — unchanged structure */}
        <div className="hidden flex-col gap-3 md:flex">
          {hideCategoryTabs ? null : (
            <div className="flex gap-1 overflow-x-auto rounded-lg bg-board p-1">
              {categories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
                    category === item.id
                      ? "bg-accent text-black"
                      : "font-semibold text-soft hover:text-ink"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/*
            Desktop/tablet: row1 = 분봉 + 성별 + 연령.
            Region (시/도) always sits on the next row when the board supports it.
          */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-row flex-nowrap items-center gap-x-1.5 overflow-x-hidden">
              {hideTimeframes ? null : (
                <div className="flex shrink-0 flex-nowrap gap-0.5 rounded-lg bg-board p-0.5">
                  {TIMEFRAMES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTimeframe(option.id)}
                      className={`shrink-0 rounded-md px-1.5 py-1 font-sans text-[12px] font-semibold tracking-tight lg:px-2.5 lg:py-1.5 lg:text-[13.2px] lg:tracking-normal ${
                        timeframe === option.id
                          ? "bg-ink text-board md:bg-accent md:text-black"
                          : "text-soft hover:bg-panel hover:text-ink"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="min-w-0 shrink">
                <DemographicTabs
                  gender={gender}
                  age={age}
                  onGender={setGender}
                  onAge={setAge}
                  boardSlug={boardSlug}
                />
              </div>
            </div>
            {showRegion ? (
              <RegionFilterTabs region={region} onRegion={setRegion} />
            ) : null}
          </div>
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
            fallback={
              <p className="px-5 py-12 text-center text-sm text-muted">
                히트맵을 그리지 못했습니다. 리스트 탭에서 순위를 확인하세요.
              </p>
            }
          >
            <TreemapView
              key={`${demoKey}-${timeframe}-${sortedItems.length}`}
              items={sortedItems}
              category={category}
              timeframe={timeframe}
              layoutKey={demoKey}
              showChannelTags={showChannelTags}
              showSourceCaptions={Boolean(channel) && !boardSlug}
            />
          </HeatmapErrorBoundary>
        ) : (
          <RankingTable items={listItems} timeframe={timeframe} lockOrder />
        )}
      </div>

      {/* Row1: 산출방식 + caption · Row2: color legend */}
      <div className="flex flex-col gap-2 border-t border-line bg-panel px-4 py-2 font-sans text-[12px] text-muted">
        <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
          {view === "treemap" && sortedItems.length > 0 ? (
            <button
              type="button"
              onClick={() => setMethodOpen(true)}
              className="inline-flex h-[30px] shrink-0 items-center rounded-md border border-line px-2.5 text-[12px] text-soft hover:text-ink md:px-3 md:text-[13.2px]"
              style={{ boxSizing: "border-box" }}
            >
              랭킹 산출 방식
            </button>
          ) : null}
          <span className="min-w-0 truncate whitespace-nowrap">
            <span className="md:hidden">
              상승 초록 · 하락 빨강 · 보합 차콜 · {sortedItems.length}종목
            </span>
            <span className="hidden md:inline">
              상승 초록 · 하락 빨강 · 보합 차콜 · 히트맵 {sortedItems.length} · 리스트{" "}
              {listItems.length}종목
            </span>
          </span>
        </div>
        {view === "treemap" && sortedItems.length > 0 ? (
          <div className="flex justify-start md:justify-end">
            <HeatmapLegend className="items-start md:items-end" />
          </div>
        ) : (
          <span className="hidden md:inline">KinDex Hierarchical Heatmap</span>
        )}
      </div>

      <MethodologyModal open={methodOpen} onClose={() => setMethodOpen(false)} channel={channel} />

      <MobileBottomSheet open={filterOpen} title="히트맵 필터" onClose={() => setFilterOpen(false)}>
        <div className="flex flex-col gap-5">
          {hideCategoryTabs ? null : (
            <section>
              <h2 className="pb-2 text-[11px] font-semibold tracking-wide text-soft">분류</h2>
              <div className="flex flex-wrap gap-1 rounded-lg bg-board p-1">
                {categories.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id)}
                    className={`min-h-10 shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${
                      category === item.id ? "bg-accent text-black" : "text-soft hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {hideTimeframes ? null : (
            <section>
              <h2 className="pb-2 text-[11px] font-semibold tracking-wide text-soft">기간</h2>
              <div className="flex flex-wrap gap-1 rounded-lg bg-board p-1">
                {TIMEFRAMES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTimeframe(option.id)}
                    className={`min-h-10 rounded-md px-3 py-1.5 font-sans text-xs font-semibold ${
                      timeframe === option.id
                        ? "bg-ink text-board"
                        : "text-soft hover:bg-panel hover:text-ink"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="pb-2 text-[11px] font-semibold tracking-wide text-soft">인구통계</h2>
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
              <p className="mt-2 text-[11px] leading-5 text-muted">
                {filterLabel(gender, age, region)}{" "}
                {isHeadlineFeed(filtered)
                  ? "분봉 급상승·성별·연령 가중치로 헤드라인 순위를 다시 매겼습니다."
                  : skipDemographicSkew
                    ? "세그먼트 순위로 히트맵을 다시 그렸습니다."
                    : "관심 가중치로 순위를 다시 매겼습니다. 분봉 필터와 함께 적용됩니다."}
              </p>
            ) : null}
          </section>

          <section className="border-t border-line pt-4">
            <button
              type="button"
              onClick={() => {
                setFilterOpen(false);
                setMethodOpen(true);
              }}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-line text-sm text-soft hover:text-ink"
            >
              랭킹 산출 방식
            </button>
            <button
              type="button"
              onClick={() => setFilterOpen(false)}
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent text-sm font-semibold text-black"
            >
              적용
            </button>
          </section>
        </div>
      </MobileBottomSheet>
    </section>
  );
}
