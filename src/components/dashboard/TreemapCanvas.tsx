"use client";

/**
 * Heatmap canvas entry (dynamic-imported). Kept as a separate module so Turbopack
 * serves a fresh chunk when the layout algorithm changes.
 */
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { uniqueHeatmapTiles } from "@/lib/boards/unique-tiles";
import { TYPE_LABEL, formatRate } from "@/lib/format";
import { heatFill, heatText } from "@/lib/heatmap";
import { formatHeatmapRank } from "@/lib/boards/limits";
import { heatmapNameLines } from "@/lib/musicTitle";
import { CULTURE_GRANT_TITLE } from "@/lib/boards/culture-grants";
import { summarizeHeadlineTitle } from "@/lib/news/headline-title";
import { layoutHeatmapLeaves } from "@/lib/treemapLayout";
import { TREEMAP_FRAME_CLASS, TREEMAP_MAX_ITEMS, MOBILE_TREEMAP_MAX_ITEMS } from "@/components/dashboard/treemap-config";
import { heatmapChangeRate, heatmapPriceLabel } from "@/lib/market/kospi-quotes-ui";
import { scoreForTimeframe } from "@/lib/timeframes";
import { entityHref } from "@/lib/slugs";
import { layoutTreemapLabel } from "@/lib/treemapLabel";
import type { CategoryId, RankingEntity, Timeframe } from "@/lib/types";

export { TREEMAP_MAX_ITEMS, MOBILE_TREEMAP_MAX_ITEMS };

const HoverCard = dynamic(
  () => import("@/components/dashboard/HoverCard").then((mod) => mod.HoverCard),
  { ssr: false },
);

export function heatmapVisibleCount(items: RankingEntity[], maxItems = TREEMAP_MAX_ITEMS): number {
  return Math.min(Array.isArray(items) ? items.length : 0, maxItems);
}

interface HoverState {
  entity: RankingEntity;
  change: number;
  x: number;
  y: number;
}

interface HeatmapLeaf {
  entity: RankingEntity;
  rank: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function pickHeatmapItems(items: RankingEntity[], maxItems: number): RankingEntity[] {
  return uniqueHeatmapTiles(items).slice(0, maxItems);
}

function groupLabel(entity: RankingEntity): string {
  return entity.heatmapGroup || TYPE_LABEL[entity.type] || entity.type;
}

function headlineTitleSize(width: number, height: number): number {
  if (width >= 220 && height >= 140) return 17;
  if (width >= 160 && height >= 100) return 15.5;
  if (width >= 110 && height >= 72) return 14;
  return 12.5;
}

export function TreemapView({
  items,
  category,
  timeframe,
  selectedSlug: _selectedSlug,
  onSelect,
}: {
  items: RankingEntity[];
  category: CategoryId;
  timeframe: Timeframe;
  selectedSlug?: string | null;
  onSelect?: (slug: string) => void;
}) {
  const safeItems = Array.isArray(items) ? items : [];
  const router = useRouter();

  const wrapRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 1100, height: 640 });
  const [hover, setHover] = useState<HoverState | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const { width, height } = bounds;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsMobileViewport(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const tileCap = isMobileViewport ? MOBILE_TREEMAP_MAX_ITEMS : TREEMAP_MAX_ITEMS;
  const visible = useMemo(() => pickHeatmapItems(safeItems, tileCap), [safeItems, tileCap]);
  const displayRankById = useMemo(() => {
    const ranks = new Map<string, number>();
    visible.forEach((item, index) => ranks.set(item.id, index + 1));
    return ranks;
  }, [visible]);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const nextWidth = Math.floor(rect.width);
      const nextHeight = Math.floor(rect.height);
      if (nextWidth > 0 && nextHeight > 0) {
        setBounds({ width: nextWidth, height: nextHeight });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const leaves = useMemo((): HeatmapLeaf[] => {
    try {
      if (!visible.length) return [];
      const byId = new Map(visible.map((entity) => [entity.id, entity]));
      return layoutHeatmapLeaves(
        visible.map((entity, index) => ({
          id: entity.id,
          rank: index + 1,
          score: scoreForTimeframe(entity, timeframe),
        })),
        width,
        height,
        2,
      ).flatMap((box) => {
        const entity = byId.get(box.id);
        if (!entity) return [];
        if (![box.x0, box.x1, box.y0, box.y1].every((value) => Number.isFinite(value))) return [];
        return [{ entity, rank: box.rank, x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1 }];
      });
    } catch {
      return [];
    }
  }, [height, timeframe, visible, width]);

  function moveHover(event: MouseEvent, entity: RankingEntity, change: number) {
    const displayRank = displayRankById.get(entity.id) ?? entity.rank;
    setHover({
      entity: { ...entity, rank: displayRank },
      change,
      x: Math.min(event.clientX, window.innerWidth - 300),
      y: Math.min(event.clientY, window.innerHeight - 260),
    });
  }

  return (
    <div
      ref={wrapRef}
      className={`${TREEMAP_FRAME_CLASS} flex flex-1 flex-col items-stretch`}
      onMouseLeave={() => setHover(null)}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        role="img"
        suppressHydrationWarning
        aria-label={`${TYPE_LABEL[category] ?? "종합"} 화제 지수 히트맵 섹터 ${visible.length}종목`}
      >
        {leaves.map((leaf) => {
          const entity = leaf.entity;
          const change = heatmapChangeRate(entity, timeframe);
          const w = leaf.x1 - leaf.x0;
          const h = leaf.y1 - leaf.y0;
          const rate = formatRate(change);
          const priceLabel = heatmapPriceLabel(entity);
          const rank = displayRankById.get(entity.id) ?? leaf.rank ?? entity.rank;
          const rankBadge = formatHeatmapRank(rank);
          const group = groupLabel(entity);
          const lines = heatmapNameLines(entity);
          const label = layoutTreemapLabel({
            width: w,
            height: h,
            y: leaf.y0,
            name: lines.title,
            artist: priceLabel ?? lines.artist,
            rate,
            // Finviz-style: show ±% only — no index point (pt) suffix on tiles.
            typeLabel: "",
            heatmapRank: rank,
          });
          const fill = heatText(change);
          const baseRankSize = w >= 120 && h >= 56 ? 16.5 : 13.5;
          /** Mobile: rank −30%; desktop unchanged. */
          const rankSize = isMobileViewport ? baseRankSize * 0.7 : baseRankSize;
          const showRank = w >= 36 && h >= 20;
          const isHeadline = entity.type === "headline_news";
          const isGrantTwoLine =
            entity.heatmapGroup === CULTURE_GRANT_TITLE && Boolean(lines.artist);
          const displayTitle = isHeadline ? summarizeHeadlineTitle(entity.name) : (label?.name ?? lines.title);
          /**
           * Mobile title: 1–7 → −10%, 8–12 → −15%.
           * Mobile rate: −10%. Desktop unchanged.
           */
          const layoutNameSize = label?.nameSize ?? 16;
          const nameBase =
            isMobileViewport && rank >= 8 && rank <= 15 ? layoutNameSize / 0.8 : layoutNameSize;
          const mobileTitleScale =
            !isMobileViewport ? 1 : rank <= 7 ? 0.9 : rank <= 12 ? 0.85 : 1;
          const nameFontSize = nameBase * mobileTitleScale;
          const headlineFontSize = isMobileViewport
            ? headlineTitleSize(w, h) * mobileTitleScale
            : headlineTitleSize(w, h) * (rank >= 8 && rank <= 15 ? 0.8 : 1);
          const rateFontSize = (label?.rateSize ?? 16.5) * (isMobileViewport ? 0.9 : 1);
          const href = entityHref(entity);
          const rankHeaderWidth = Math.min(164, w - 4);
          const rankHeaderX = isMobileViewport
            ? leaf.x0 + 2
            : Math.max(leaf.x0, leaf.x1 - 168);
          return (
            <Link
              key={`${entity.id}-${rank}`}
              href={href}
              prefetch={false}
              className="cursor-pointer"
              aria-label={`${group} ${rankBadge} ${entity.name}${priceLabel ? ` ${priceLabel}` : ""} ${rate}`}
              data-heatmap-rank={rank}
              onPointerDown={() => {
                router.prefetch(href);
              }}
              onMouseEnter={(event) => {
                router.prefetch(href);
                moveHover(event, entity, change);
              }}
              onMouseMove={(event) => moveHover(event, entity, change)}
              onClick={(event) => {
                if (!onSelect) return;
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                  return;
                }
                event.preventDefault();
                onSelect(entity.slug);
              }}
            >
              <g>
                <rect
                  x={leaf.x0}
                  y={leaf.y0}
                  width={Math.max(w, 0)}
                  height={Math.max(h, 0)}
                  fill={heatFill(change)}
                  stroke="none"
                />
                {showRank ? (
                  <foreignObject
                    x={rankHeaderX}
                    y={leaf.y0 + 3}
                    width={rankHeaderWidth}
                    height={28}
                  >
                    <div
                      className={`pointer-events-none flex h-full w-full flex-col justify-start ${
                        isMobileViewport
                          ? "items-start pl-1 text-left"
                          : "items-end pr-1 text-right"
                      }`}
                      style={{ color: fill }}
                    >
                      <span
                        className="font-sans font-semibold tabular-nums leading-none"
                        style={{ fontSize: rankSize }}
                      >
                        {rankBadge}
                      </span>
                    </div>
                  </foreignObject>
                ) : null}
                {isGrantTwoLine ? (
                  <foreignObject
                    x={leaf.x0 + 4}
                    y={leaf.y0 + (showRank ? 32 : 6)}
                    width={Math.max(w - 8, 0)}
                    height={Math.max(h - (showRank ? 40 : 10), 0)}
                  >
                    <div
                      className="pointer-events-none flex h-full w-full flex-col items-center justify-center px-0.5 text-center"
                      style={{ color: fill }}
                    >
                      <p
                        className="w-full font-extrabold tracking-tight"
                        suppressHydrationWarning
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: label?.nameLines ?? 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontSize: nameFontSize,
                          lineHeight: 1.22,
                          letterSpacing: "-0.03em",
                          wordBreak: "break-all",
                        }}
                      >
                        {lines.title}
                      </p>
                      <p
                        className="mt-0.5 w-full font-semibold"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          fontSize: Math.max(12, (label?.metaSize ?? 15) * 0.95),
                          lineHeight: 1.2,
                          letterSpacing: "-0.02em",
                          opacity: 0.92,
                          wordBreak: "keep-all",
                        }}
                      >
                        {lines.artist}
                      </p>
                      {h >= 48 ? (
                        <p
                          className="mt-1 font-bold tabular-nums"
                          style={{ fontSize: rateFontSize }}
                        >
                          {label?.rate ?? rate}
                        </p>
                      ) : null}
                    </div>
                  </foreignObject>
                ) : isHeadline ? (
                  <foreignObject
                    x={leaf.x0 + 4}
                    y={leaf.y0 + (showRank ? 32 : 6)}
                    width={Math.max(w - 8, 0)}
                    height={Math.max(h - (showRank ? 40 : 10), 0)}
                  >
                    <div
                      className="pointer-events-none flex h-full w-full flex-col items-center justify-center px-0.5 text-center"
                      style={{ color: fill }}
                    >
                      <p
                        className="w-full font-extrabold tracking-tight"
                        suppressHydrationWarning
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontSize: headlineFontSize,
                          lineHeight: 1.25,
                          letterSpacing: "-0.03em",
                          wordBreak: "break-all",
                        }}
                      >
                        {displayTitle}
                      </p>
                      {h >= 48 ? (
                        <p
                          className="mt-1 font-bold tabular-nums"
                          style={{ fontSize: rateFontSize }}
                        >
                          {label?.rate ?? rate}
                        </p>
                      ) : null}
                    </div>
                  </foreignObject>
                ) : (
                  <foreignObject
                    x={leaf.x0 + 6}
                    y={leaf.y0 + (showRank ? 26 : 6)}
                    width={Math.max(w - 12, 0)}
                    height={Math.max(h - (showRank ? 34 : 12), 0)}
                  >
                    <div
                      className="pointer-events-none flex h-full w-full flex-col items-center justify-center px-0.5 text-center"
                      style={{ color: fill }}
                    >
                      {label?.showName !== false ? (
                        <p
                          className="w-full font-extrabold tracking-tight"
                          suppressHydrationWarning
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: label?.nameLines ?? 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            fontSize: nameFontSize,
                            lineHeight: 1.22,
                            letterSpacing: "-0.03em",
                            wordBreak: "break-all",
                          }}
                        >
                          {label?.name ?? lines.title}
                        </p>
                      ) : null}
                      {label?.showMeta && label.meta ? (
                        <p
                          className="mt-0.5 w-full font-semibold"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            fontSize: label.metaSize,
                            lineHeight: 1.2,
                            letterSpacing: "-0.02em",
                            opacity: 0.92,
                            wordBreak: "keep-all",
                          }}
                        >
                          {label.meta}
                        </p>
                      ) : null}
                      {label?.showRate !== false && h >= 28 ? (
                        <p
                          className="mt-1 font-bold tabular-nums"
                          style={{ fontSize: rateFontSize }}
                        >
                          {label?.rate ?? rate}
                        </p>
                      ) : null}
                    </div>
                  </foreignObject>
                )}
              </g>
            </Link>
          );
        })}
      </svg>
      {hover ? (
        <HoverCard
          entity={hover.entity}
          change={hover.change}
          timeframe={timeframe}
          x={hover.x}
          y={hover.y}
        />
      ) : null}
    </div>
  );
}
