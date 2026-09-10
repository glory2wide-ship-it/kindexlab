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
import { heatmapTileLabel } from "@/lib/heatmap-display-name";
import { CHANNEL_SHORT_LABEL } from "@/lib/posts/channels";
import { heatmapSourceCaption, summarizeHeadlineTitle } from "@/lib/news/headline-title";
import { layoutHeatmapLeaves } from "@/lib/treemapLayout";
import { TREEMAP_FRAME_CLASS, TREEMAP_MAX_ITEMS, MOBILE_TREEMAP_MAX_ITEMS } from "@/components/dashboard/treemap-config";
import { heatmapChangeRate, heatmapPriceLabel } from "@/lib/market/kospi-quotes-ui";
import { scoreForTimeframe } from "@/lib/timeframes";
import { entityHref } from "@/lib/slugs";
import { layoutTreemapLabel } from "@/lib/treemapLabel";
import type { CategoryId, RankingEntity, Timeframe } from "@/lib/types";
import type { PostChannel } from "@/lib/posts/types";

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
  showChannelTags = false,
  showSourceCaptions = false,
}: {
  items: RankingEntity[];
  category: CategoryId;
  timeframe: Timeframe;
  selectedSlug?: string | null;
  onSelect?: (slug: string) => void;
  /** Landing unified map: show short desk tags (엔터/정치/…) beside the rank. */
  showChannelTags?: boolean;
  /** Category composite map: show submenu/board names under the rank (top tiles). */
  showSourceCaptions?: boolean;
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
      const layoutSeed = `${category}:${visible[0]?.id ?? "empty"}:${visible.length}`;
      return layoutHeatmapLeaves(
        visible.map((entity, index) => {
          const tile = heatmapTileLabel(entity);
          return {
            id: entity.id,
            rank: index + 1,
            score: scoreForTimeframe(entity, timeframe),
            // Full name length nudges area so long titles stay readable.
            name: tile.title,
          };
        }),
        width,
        height,
        2,
        isMobileViewport
          ? { seed: layoutSeed }
          : { variant: "squarify" },
      ).flatMap((box) => {
        const entity = byId.get(box.id);
        if (!entity) return [];
        if (![box.x0, box.x1, box.y0, box.y1].every((value) => Number.isFinite(value))) return [];
        return [{ entity, rank: box.rank, x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1 }];
      });
    } catch {
      return [];
    }
  }, [category, height, isMobileViewport, timeframe, visible, width]);

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
          /** Mobile ranks 8+: hide ±% so the ticker name stays readable in small tiles. */
          const omitRate = isMobileViewport && rank >= 8;
          const group = groupLabel(entity);
          const tile = heatmapTileLabel(entity);
          const isHeadline = entity.type === "headline_news";
          const label = layoutTreemapLabel({
            width: w,
            height: h,
            y: leaf.y0,
            name: isHeadline ? summarizeHeadlineTitle(entity.name, 16) : tile.title,
            artist: priceLabel ?? tile.secondary,
            rate,
            // Finviz-style: show ±% only — no index point (pt) suffix on tiles.
            typeLabel: "",
            heatmapRank: rank,
            omitRate,
          });
          const fill = heatText(change);
          const baseRankSize = w >= 120 && h >= 56 ? 16.5 : 13.5;
          /** Rank badge: −10% vs prior; mobile keeps additional −30% dampen. */
          const rankSize = (isMobileViewport ? baseRankSize * 0.7 : baseRankSize) * 0.9;
          const showRank = w >= 36 && h >= 20;
          const channelTag =
            showChannelTags && entity.sourceChannel
              ? CHANNEL_SHORT_LABEL[entity.sourceChannel as PostChannel]
              : undefined;
          const showChannelTag = Boolean(channelTag) && w >= 74 && h >= 26;
          const sourceLabel = heatmapSourceCaption(entity);
          const sourceChipSize = Math.max(8, rankSize - 1.5);
          /** Submenu chip before the rank (landing-style), not under it. */
          const showSourceChip =
            showSourceCaptions && rank <= 10 && Boolean(sourceLabel) && w >= 72 && h >= 26;
          const displayTitle = isHeadline
            ? summarizeHeadlineTitle(entity.name)
            : (label?.name ?? tile.title);
          /**
           * Mobile title: slight dampen so dense 15-tile maps stay legible; size still tracks the box.
           * Mobile rate: −10%. Desktop unchanged.
           */
          const layoutNameSize = label?.nameSize ?? 16;
          const mobileTitleScale = !isMobileViewport ? 1 : 0.94;
          const nameFontSize = layoutNameSize * mobileTitleScale;
          const headlineFontSize = isMobileViewport
            ? headlineTitleSize(w, h) * mobileTitleScale
            : headlineTitleSize(w, h);
          const rateFontSize = (label?.rateSize ?? 16.5) * (isMobileViewport ? 0.9 : 1);
          const showTileRate = !omitRate && label?.showRate !== false;
          const href = entityHref(entity);
          const chipCount = (showChannelTag ? 1 : 0) + (showSourceChip ? 1 : 0);
          const rankHeaderWidth = Math.min(
            chipCount > 0 ? 200 : 120,
            Math.max(48, w - 4),
          );
          // Rank badge sits top-right on both viewports (mobile previously top-left).
          const rankHeaderX = Math.max(leaf.x0 + 2, leaf.x1 - rankHeaderWidth - 2);
          return (
            <Link
              key={`${entity.id}-${rank}`}
              href={href}
              prefetch={false}
              className="cursor-pointer"
              aria-label={`${channelTag ? `${channelTag} ` : ""}${sourceLabel && showSourceChip ? `${sourceLabel} ` : ""}${group} ${rankBadge} ${tile.title}${priceLabel ? ` ${priceLabel}` : ""}${omitRate ? "" : ` ${rate}`}`}
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
                      className="pointer-events-none flex h-full w-full items-center justify-end gap-1 pr-1 text-right"
                      style={{ color: fill }}
                    >
                      {showChannelTag ? (
                        <span
                          className="max-w-[42%] truncate rounded-[3px] border px-1 py-px font-sans font-normal leading-none opacity-85"
                          style={{ fontSize: sourceChipSize, borderColor: "currentColor" }}
                        >
                          {channelTag}
                        </span>
                      ) : null}
                      {showSourceChip && sourceLabel ? (
                        <span
                          className="max-w-[52%] truncate rounded-[3px] border px-1 py-px font-sans font-normal leading-none opacity-85"
                          style={{ fontSize: sourceChipSize, borderColor: "currentColor" }}
                          title={sourceLabel}
                        >
                          {sourceLabel}
                        </span>
                      ) : null}
                      <span
                        className="shrink-0 font-sans font-normal tabular-nums leading-none"
                        style={{ fontSize: rankSize }}
                      >
                        {rankBadge}
                      </span>
                    </div>
                  </foreignObject>
                ) : null}
                {isHeadline ? (
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
                      {showTileRate && h >= 48 ? (
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
                          WebkitLineClamp: label?.nameLines ?? 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontSize: nameFontSize,
                          lineHeight: 1.22,
                          letterSpacing: "-0.03em",
                          whiteSpace: "pre-line",
                          wordBreak: "break-word",
                        }}
                      >
                          {label?.name ?? tile.title}
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
                      {showTileRate && h >= 28 ? (
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
