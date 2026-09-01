"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { HoverCard } from "@/components/dashboard/HoverCard";
import { TYPE_LABEL, formatIndexPoints, formatRate } from "@/lib/format";
import { heatFill, heatText } from "@/lib/heatmap";
import { formatHeatmapRank } from "@/lib/boards/limits";
import { heatmapNameLines } from "@/lib/musicTitle";
import { CHANNEL_SHORT_LABEL } from "@/lib/posts/channels";
import { CULTURE_GRANT_TITLE } from "@/lib/boards/culture-grants";
import { heatmapSourceCaption, summarizeHeadlineTitle } from "@/lib/news/headline-title";
import { layoutHeatmapLeaves } from "@/lib/treemapLayout";
import { TREEMAP_MAX_ITEMS } from "@/components/dashboard/treemap-config";
import {
  changeForEntity,
  getTimeframeSeries,
  scoreForTimeframe,
} from "@/lib/timeframes";
import { entityHref } from "@/lib/slugs";
import { layoutTreemapLabel } from "@/lib/treemapLabel";
import type { CategoryId, RankingEntity, SeriesPoint, Timeframe } from "@/lib/types";

export { TREEMAP_MAX_ITEMS };

export function heatmapVisibleCount(items: RankingEntity[]): number {
  return Math.min(Array.isArray(items) ? items.length : 0, TREEMAP_MAX_ITEMS);
}

interface HoverState {
  entity: RankingEntity;
  series: SeriesPoint[];
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

function pickHeatmapItems(items: RankingEntity[]): RankingEntity[] {
  return items.slice(0, TREEMAP_MAX_ITEMS);
}

function groupLabel(entity: RankingEntity): string {
  return entity.heatmapGroup || TYPE_LABEL[entity.type] || entity.type;
}

function headlineTitleSize(width: number, height: number): number {
  if (width >= 220 && height >= 140) return 21;
  if (width >= 160 && height >= 100) return 18;
  if (width >= 110 && height >= 72) return 16;
  return 14;
}

export function TreemapView({
  items,
  category,
  timeframe,
  selectedSlug: _selectedSlug,
  onSelect,
  showSourceCaptions = false,
}: {
  items: RankingEntity[];
  category: CategoryId;
  timeframe: Timeframe;
  selectedSlug?: string | null;
  onSelect?: (slug: string) => void;
  /** 종합 히트맵 1~10위 타일에 원본 메뉴명을 붙인다. */
  showSourceCaptions?: boolean;
}) {
  const safeItems = Array.isArray(items) ? items : [];
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 1100, height: 640 });
  const [hover, setHover] = useState<HoverState | null>(null);
  const { width, height } = bounds;

  const visible = useMemo(() => pickHeatmapItems(safeItems), [safeItems]);
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

  function moveHover(
    event: MouseEvent,
    entity: RankingEntity,
    series: SeriesPoint[],
    change: number,
  ) {
    const displayRank = displayRankById.get(entity.id) ?? entity.rank;
    setHover({
      entity: { ...entity, rank: displayRank },
      series,
      change,
      x: Math.min(event.clientX, window.innerWidth - 300),
      y: Math.min(event.clientY, window.innerHeight - 260),
    });
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-[460px] overflow-hidden bg-line md:h-[640px]"
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
        <defs>
          {leaves.map((leaf) => {
            const entity = leaf.entity;
            if (!entity) return null;
            return (
              <clipPath key={entity.id} id={`tm-clip-${entity.id}`}>
                <rect
                  x={leaf.x0}
                  y={leaf.y0}
                  width={Math.max(leaf.x1 - leaf.x0, 0)}
                  height={Math.max(leaf.y1 - leaf.y0, 0)}
                />
              </clipPath>
            );
          })}
        </defs>
        {leaves.map((leaf) => {
          const entity = leaf.entity;
          const series = getTimeframeSeries(entity, timeframe);
          const change = changeForEntity(entity, timeframe);
          const w = leaf.x1 - leaf.x0;
          const h = leaf.y1 - leaf.y0;
          const rate = formatRate(change);
          const scoreLabel = formatIndexPoints(scoreForTimeframe(entity, timeframe));
          const rank = displayRankById.get(entity.id) ?? leaf.rank ?? entity.rank;
          const rankBadge = formatHeatmapRank(rank);
          const group = groupLabel(entity);
          const lines = heatmapNameLines(entity);
          const label = layoutTreemapLabel({
            width: w,
            height: h,
            y: leaf.y0,
            name: lines.title,
            artist: lines.artist,
            rate,
            typeLabel: scoreLabel,
          });
          const fill = heatText(change);
          const cx = leaf.x0 + w / 2;
          const nameY = label?.nameY ?? leaf.y0 + h / 2 - 4;
          const artistY = label?.metaY ?? nameY + 14;
          const rateY = label?.rateY ?? leaf.y0 + h / 2 + 12;
          const rankSize = w >= 120 && h >= 56 ? 11 : 9;
          const showRank = w >= 36 && h >= 20;
          // Desk tag rides on the rank line so the tile keeps its label height.
          const channelTag = entity.sourceChannel
            ? CHANNEL_SHORT_LABEL[entity.sourceChannel]
            : undefined;
          const showChannelTag = Boolean(channelTag) && w >= 74 && h >= 26;
          const isHeadline = entity.type === "headline_news";
          const isGrantTwoLine =
            entity.heatmapGroup === CULTURE_GRANT_TITLE && Boolean(lines.artist);
          const sourceLabel = heatmapSourceCaption(entity);
          const sourceSize = Math.max(8, rankSize - 2) * 1.15;
          const showSource = showSourceCaptions && rank <= 10 && Boolean(sourceLabel) && w >= 52 && h >= 28;
          const displayTitle = isHeadline ? summarizeHeadlineTitle(entity.name) : (label?.name ?? lines.title);
          const href = entityHref(entity);
          return (
            <a
              key={entity.id}
              href={href}
              className="cursor-pointer"
              aria-label={`${channelTag ? `${channelTag} ` : ""}${group} ${rankBadge} ${entity.name} ${rate} ${scoreLabel}`}
              data-heatmap-rank={rank}
              onMouseEnter={(event) => moveHover(event, entity, series, change)}
              onMouseMove={(event) => moveHover(event, entity, series, change)}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                  return;
                }
                event.preventDefault();
                if (onSelect) {
                  onSelect(entity.slug);
                  return;
                }
                router.push(href);
              }}
            >
              <g clipPath={`url(#tm-clip-${entity.id})`}>
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
                    x={Math.max(leaf.x0, leaf.x1 - 132)}
                    y={leaf.y0 + 3}
                    width={Math.min(128, w - 4)}
                    height={showSource ? 48 : 18}
                  >
                    <div
                      className="pointer-events-none flex h-full w-full flex-col items-end justify-start pr-1"
                      style={{ color: fill }}
                    >
                      <span className="flex items-center gap-1 leading-none">
                        {showChannelTag ? (
                          <span
                            className="rounded-[3px] border px-1 py-px font-sans font-semibold leading-none opacity-85"
                            style={{ fontSize: Math.max(8, rankSize - 2), borderColor: "currentColor" }}
                          >
                            {channelTag}
                          </span>
                        ) : null}
                        <span
                          className="font-sans font-semibold tabular-nums leading-none"
                          style={{ fontSize: rankSize }}
                        >
                          {rankBadge}
                        </span>
                      </span>
                      {showSource && sourceLabel ? (
                        <span
                          className="mt-0.5 max-w-full text-right font-medium leading-tight opacity-90"
                          style={{
                            fontSize: sourceSize,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            wordBreak: "keep-all",
                          }}
                        >
                          {sourceLabel}
                        </span>
                      ) : null}
                    </div>
                  </foreignObject>
                ) : null}
                {isGrantTwoLine ? (
                  <foreignObject
                    x={leaf.x0 + 4}
                    y={leaf.y0 + (showRank ? 22 : 6)}
                    width={Math.max(w - 8, 0)}
                    height={Math.max(h - (showRank ? 28 : 10), 0)}
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
                          fontSize: label?.nameSize ?? 13,
                          lineHeight: 1.25,
                          letterSpacing: "-0.03em",
                          wordBreak: "keep-all",
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
                          fontSize: Math.max(8, (label?.metaSize ?? 10) * 0.95),
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
                          style={{ fontSize: label?.rateSize ?? 11 }}
                        >
                          {label?.rate ?? rate}
                        </p>
                      ) : null}
                    </div>
                  </foreignObject>
                ) : isHeadline ? (
                  <foreignObject
                    x={leaf.x0 + 4}
                    y={leaf.y0 + (showRank ? 22 : 6)}
                    width={Math.max(w - 8, 0)}
                    height={Math.max(h - (showRank ? 28 : 10), 0)}
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
                          fontSize: headlineTitleSize(w, h),
                          lineHeight: 1.3,
                          letterSpacing: "-0.03em",
                          wordBreak: "keep-all",
                        }}
                      >
                        {displayTitle}
                      </p>
                      {h >= 48 ? (
                        <p
                          className="mt-1 font-bold tabular-nums"
                          style={{ fontSize: label?.rateSize ?? 11 }}
                        >
                          {label?.rate ?? rate}
                        </p>
                      ) : null}
                    </div>
                  </foreignObject>
                ) : (
                  <>
                    {label?.showName !== false ? (
                      <text
                        x={cx}
                        y={nameY}
                        fill={fill}
                        fontSize={label?.nameSize ?? 14}
                        fontWeight={800}
                        letterSpacing="-0.03em"
                        fontFamily="var(--font-sans)"
                        textAnchor="middle"
                      >
                        {label?.name ?? lines.title}
                      </text>
                    ) : null}
                    {label?.showMeta && label.meta ? (
                      <text
                        x={cx}
                        y={artistY}
                        fill={fill}
                        fillOpacity={0.92}
                        fontSize={label.metaSize}
                        fontWeight={600}
                        letterSpacing="-0.02em"
                        fontFamily="var(--font-sans)"
                        textAnchor="middle"
                      >
                        {label.meta}
                      </text>
                    ) : null}
                    {label?.showRate !== false && h >= 28 ? (
                      <text
                        x={cx}
                        y={rateY}
                        fill={fill}
                        fontSize={label?.rateSize ?? 11}
                        fontWeight={700}
                        letterSpacing="-0.02em"
                        fontFamily="var(--font-sans)"
                        textAnchor="middle"
                      >
                        {label?.rate ?? rate}
                      </text>
                    ) : null}
                  </>
                )}
              </g>
            </a>
          );
        })}
      </svg>
      {hover ? (
        <HoverCard
          entity={hover.entity}
          series={hover.series}
          change={hover.change}
          timeframe={timeframe}
          x={hover.x}
          y={hover.y}
        />
      ) : null}
    </div>
  );
}
