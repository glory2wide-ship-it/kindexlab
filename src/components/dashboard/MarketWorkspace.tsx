"use client";

import dynamic from "next/dynamic";
import { startTransition, useEffect, useMemo, useState, type ReactNode } from "react";
import { DemographicTabs, GenreFilterTabs, RegionFilterTabs } from "@/components/boards/DemographicTabs";
import { HeatmapCountdownFallback } from "@/components/dashboard/HeatmapCountdown";
import { HeatmapErrorBoundary } from "@/components/dashboard/HeatmapErrorBoundary";
import { HeatmapLegend } from "@/components/dashboard/HeatmapLegend";
import { MobileHeatmapDials } from "@/components/dashboard/MobileHeatmapDials";
import { RankingTable } from "@/components/dashboard/RankingTable";
import { TreemapView } from "@/components/dashboard/TreemapCanvas";
import {
  TREEMAP_MAX_ITEMS,
  MOBILE_TREEMAP_MAX_ITEMS,
  LIST_MAX_ITEMS,
  MOBILE_LIST_MAX_ITEMS,
} from "@/components/dashboard/treemap-config";
import { HeaderRefreshCountdown } from "@/components/layout/HeaderRefreshCountdown";
import { MobileBottomSheet } from "@/components/layout/MobileBottomSheet";

/**
 * TreemapView is a static import so landing SSR paints real tiles (dynamic +
 * loading skeleton was still flashing "히트맵을 불러오는 중" in the HTML).
 * RankingTable is also static — keep both mounted and toggle with CSS so
 * 히트맵 ↔ 리스트 does not tear down squarify layout / ResizeObserver.
 */
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
import { CATEGORIES, MOBILE_TIMEFRAMES, TIMEFRAMES } from "@/lib/categories";
import type { AgeSegment, GenderSegment, RegionSegment } from "@/lib/boards/types";
import { isHeadlineFeed, rankHeadlineFeed } from "@/lib/news/headline-rank";
import { LIVE_INDEX_LABEL } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import { entityMatchesRegion } from "@/lib/boards/regions";
import { entityMatchesTvGenre, type HeatmapTvGenre } from "@/lib/boards/tv-genre";
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
  showGenre = false,
  genre: genreProp,
  onGenre,
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
  showGenre?: boolean;
  genre?: HeatmapTvGenre;
  onGenre?: (value: HeatmapTvGenre) => void;
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
   * Override the default timeframe (shared 5m across viewports).
   * Landing / category desks pass 5m so SSR tiles match the ranked pool.
   */
  initialTimeframe?: Timeframe;
}) {
  const [view, setView] = useState<ViewMode>(initialView);
  /**
   * Mount list pane after idle (or on first click). Hidden mount avoids the old
   * desktop list flash while making the first 히트맵→리스트 click cheap.
   */
  // Always keep the list pane mounted so 히트맵↔리스트 is a CSS toggle only.
  const [listMounted, setListMounted] = useState(true);

  useEffect(() => {
    if (listMounted) return;
    let cancelled = false;
    const warm = () => {
      if (!cancelled) setListMounted(true);
    };
    // Premount ASAP — idle timeout used to leave the first click cold (~1.5s).
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(warm, { timeout: 120 });
    } else {
      timeoutId = setTimeout(warm, 0);
    }
    return () => {
      cancelled = true;
      if (idleId != null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [listMounted]);

  const [category, setCategory] = useState<CategoryId>(initialCategory);
  /**
   * Default 5분 on every viewport so phone / desktop / other PCs rank the same
   * heatmap pool. Users can still dial to 10분·30분 manually.
   * Landing / category desks pass initialTimeframe="5m" for SSR parity.
   */
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe ?? "5m");
  const [genderInternal, setGenderInternal] = useState<"all" | GenderSegment>("all");
  const [ageInternal, setAgeInternal] = useState<"all" | AgeSegment>("all");
  const [regionInternal, setRegionInternal] = useState<"all" | RegionSegment>("all");
  const [genreInternal, setGenreInternal] = useState<HeatmapTvGenre>("all");
  const [methodOpen, setMethodOpen] = useState(false);
  const [userPickedView, setUserPickedView] = useState(false);
  const [userPickedTimeframe, setUserPickedTimeframe] = useState(false);

  /** Keep default TF in sync when the parent passes a new initialTimeframe. */
  useEffect(() => {
    if (userPickedTimeframe) return;
    setTimeframe(initialTimeframe ?? "5m");
  }, [initialTimeframe, userPickedTimeframe]);

  const pickTimeframe = (value: Timeframe) => {
    setUserPickedTimeframe(true);
    setTimeframe(value);
  };

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
  const genre = genreProp ?? genreInternal;
  const setGenre = onGenre ?? setGenreInternal;
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
      const genreLocked =
        showGenre && genre !== "all" && genre !== "ott"
          ? regionLocked.filter((item) => entityMatchesTvGenre(item, genre))
          : regionLocked;
      const unique = uniqueHeatmapTiles(genreLocked);
      if (unique.length) return unique;
    } catch {
      /* keep tiles from the region-locked payload so a bad combo never mixes 시/도 */
    }
    let fallback =
      showRegion && region !== "all"
        ? filtered.filter((item) => entityMatchesRegion(item, region))
        : filtered;
    if (showGenre && genre !== "all" && genre !== "ott") {
      fallback = fallback.filter((item) => entityMatchesTvGenre(item, genre));
    }
    return uniqueHeatmapTiles(fallback);
  }, [filtered, timeframe, gender, age, region, showRegion, genre, showGenre, skipDemographicSkew]);

  const sortedItems = useMemo(() => {
    const desktopCap = Math.max(1, Math.min(maxItems, TREEMAP_MAX_ITEMS));
    // Landing curated set (showChannelTags): keep every per-channel top-4 tile on
    // mobile too — the 15-cap was dropping whole categories after global re-rank.
    const cap = showChannelTags
      ? Math.max(desktopCap, rankedPool.length)
      : isMobileViewport
        ? Math.max(1, Math.min(desktopCap, MOBILE_TREEMAP_MAX_ITEMS))
        : desktopCap;
    return rankedPool.slice(0, cap).map((item, index) => ({ ...item, rank: index + 1 }));
  }, [rankedPool, maxItems, isMobileViewport, showChannelTags]);

  const listItems = useMemo(() => {
    const listCap = isMobileViewport ? MOBILE_LIST_MAX_ITEMS : LIST_MAX_ITEMS;
    return rankedPool.slice(0, listCap).map((item, index) => ({ ...item, rank: index + 1 }));
  }, [rankedPool, isMobileViewport]);
  const demoKey = filterKey(gender, age, region);
  const demoActive =
    gender !== "all" || age !== "all" || region !== "all" || (showGenre && genre !== "all");
  /** Region has its own mobile dial; sheet is only for category tabs. */
  const needsExtraFilterSheet = !hideCategoryTabs;

  const CONTROL_H = 25.5;
  const DESKTOP_CONTROL_H = 30;

  const pickView = (id: ViewMode) => {
    setUserPickedView(true);
    if (id === "list") setListMounted(true);
    // Non-urgent: keep the tab press snappy while the heavy pane paints.
    startTransition(() => setView(id));
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
              className={`inline-flex h-full items-center rounded px-2.5 text-[13.068px] font-medium leading-none md:px-3 md:text-[15.682px] ${
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
              <HeaderRefreshCountdown
                intervalSec={refreshIntervalSec}
                onExpire={onRefresh}
              />
            </div>
          </div>
          <div className="-mx-1 flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <MobileHeatmapDials
                timeframe={timeframe}
                onTimeframe={pickTimeframe}
                gender={gender}
                onGender={setGender}
                age={age}
                onAge={setAge}
                region={region}
                onRegion={setRegion}
                showRegion={showRegion}
                genre={genre}
                onGenre={setGenre}
                showGenre={showGenre}
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
              onExpire={onRefresh}
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
                      onClick={() => pickTimeframe(option.id)}
                      className={`shrink-0 rounded-md px-1.5 py-1 font-sans text-[13.543px] font-semibold tracking-tight lg:px-2.5 lg:py-1.5 lg:text-[14.898px] lg:tracking-normal ${
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
            {showGenre ? (
              <GenreFilterTabs genre={genre} onGenre={setGenre} />
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
        ) : (
          <>
            {/*
              Keep both panes mounted. Never remount TreemapView on filter/TF
              changes — layoutKey already reseeds squarify without tearing down
              ResizeObserver. Toggle with CSS only.
            */}
            <div className={view === "treemap" ? "contents" : "hidden"} aria-hidden={view !== "treemap"}>
              <HeatmapErrorBoundary
                resetKey={`${demoKey}-${timeframe}`}
                fallback={
                  <p className="px-5 py-12 text-center text-sm text-muted">
                    히트맵을 그리지 못했습니다. 리스트 탭에서 순위를 확인하세요.
                  </p>
                }
              >
                <TreemapView
                  items={sortedItems}
                  category={category}
                  timeframe={timeframe}
                  layoutKey={demoKey}
                  showChannelTags={showChannelTags}
                  showSourceCaptions={Boolean(channel) && !boardSlug}
                  maxItems={showChannelTags ? sortedItems.length : undefined}
                />
              </HeatmapErrorBoundary>
            </div>
            {listMounted ? (
              <div className={view === "list" ? "contents" : "hidden"} aria-hidden={view !== "list"}>
                <RankingTable
                  items={listItems}
                  timeframe={timeframe}
                  lockOrder
                  deferHeavy={view !== "list"}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Caption + color legend share one row on desktop; legend sits with the caption. */}
      <div className="flex flex-col gap-2 border-t border-line bg-panel px-4 py-2 font-sans text-[12px] text-muted md:flex-row md:items-center md:justify-between md:gap-3">
        <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
          {view === "treemap" && sortedItems.length > 0 ? (
            <button
              type="button"
              onClick={() => setMethodOpen(true)}
              className="inline-flex h-[30px] shrink-0 items-center rounded-md border border-line px-2.5 text-[13.2px] font-semibold text-ink hover:text-ink md:px-3 md:text-[14.52px] md:font-bold"
              style={{ boxSizing: "border-box" }}
            >
              랭킹 산출 방식
            </button>
          ) : null}
          <span className="min-w-0 truncate whitespace-nowrap md:text-[13.2px]">
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
          <div className="flex shrink-0 justify-start md:justify-end">
            <HeatmapLegend className="items-start md:items-end" />
          </div>
        ) : (
          <span className="hidden shrink-0 md:inline">KinDex Hierarchical Heatmap</span>
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
                {MOBILE_TIMEFRAMES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => pickTimeframe(option.id)}
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
              genre={genre}
              onGenre={setGenre}
              showGenre={showGenre}
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
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-line text-[15.4px] font-semibold text-ink hover:text-ink"
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
