"use client";

import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { HoverCard } from "@/components/dashboard/HoverCard";
import { TYPE_ORDER } from "@/lib/categories";
import { TYPE_LABEL, formatCompact, formatRate } from "@/lib/format";
import { heatFill, heatText } from "@/lib/heatmap";
import {
  changeForEntity,
  getTimeframeSeries,
  heatForTimeframe,
  volumeForTimeframe,
} from "@/lib/timeframes";
import { rankingPath } from "@/lib/slugs";
import { layoutTreemapLabel } from "@/lib/treemapLabel";
import type { CategoryId, EntityType, RankingEntity, SeriesPoint, Timeframe } from "@/lib/types";

export const TREEMAP_MAX_ITEMS = 44;

export function heatmapVisibleCount(items: RankingEntity[], timeframe: Timeframe = "1m"): number {
  return pickHeatmapItems(items, timeframe).length;
}

interface TreeNode {
  name: string;
  entity?: RankingEntity;
  children?: TreeNode[];
}

interface HoverState {
  entity: RankingEntity;
  series: SeriesPoint[];
  change: number;
  x: number;
  y: number;
}

function heatSort(a: RankingEntity, b: RankingEntity, timeframe: Timeframe): number {
  const heat = heatForTimeframe(b, timeframe) - heatForTimeframe(a, timeframe);
  if (heat !== 0) return heat;
  const volume = volumeForTimeframe(b, timeframe) - volumeForTimeframe(a, timeframe);
  if (volume !== 0) return volume;
  return a.rank - b.rank;
}

function pickHeatmapItems(items: RankingEntity[], timeframe: Timeframe): RankingEntity[] {
  const types = TYPE_ORDER.filter((type) => items.some((item) => item.type === type));
  if (types.length <= 1) {
    return [...items].sort((a, b) => heatSort(a, b, timeframe)).slice(0, TREEMAP_MAX_ITEMS);
  }
  const perSector = Math.max(3, Math.floor(TREEMAP_MAX_ITEMS / types.length));
  return types.flatMap((type) =>
    items
      .filter((item) => item.type === type)
      .sort((a, b) => heatSort(a, b, timeframe))
      .slice(0, perSector),
  );
}

function cellWeight(entity: RankingEntity, timeframe: Timeframe, maxVolume: number): number {
  const scaled = Math.pow(Math.max(volumeForTimeframe(entity, timeframe), 1), 0.58);
  const floor = Math.pow(Math.max(maxVolume, 1), 0.58) * 0.5;
  return Math.max(scaled, floor);
}

function sectorTree(items: RankingEntity[]): TreeNode {
  const groups = TYPE_ORDER.map((type: EntityType) => ({
    name: TYPE_LABEL[type] ?? type,
    children: items
      .filter((entity) => entity.type === type)
      .map((entity) => ({ name: entity.name, entity })),
  })).filter((group) => (group.children?.length ?? 0) > 0);

  return { name: "root", children: groups };
}

export function TreemapView({
  items,
  category,
  timeframe,
}: {
  items: RankingEntity[];
  category: CategoryId;
  timeframe: Timeframe;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 1100, height: 640 });
  const [hover, setHover] = useState<HoverState | null>(null);
  const { width, height } = bounds;

  const visible = useMemo(() => pickHeatmapItems(items, timeframe), [items, timeframe]);
  const maxVolume = useMemo(
    () => visible.reduce((max, item) => Math.max(max, volumeForTimeframe(item, timeframe)), 1),
    [timeframe, visible],
  );

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

  const tree = useMemo(() => sectorTree(visible), [visible]);

  const { leaves, groups } = useMemo(() => {
    const root = hierarchy(tree)
      .sum((node) => (node.entity ? cellWeight(node.entity, timeframe, maxVolume) : 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const laidOut = treemap<TreeNode>()
      .size([width, height])
      .paddingInner((node) => (node.depth === 0 ? 14 : 7))
      .paddingOuter((node) => (node.depth === 0 ? 8 : 5))
      .paddingTop((node) => (node.depth === 1 ? 26 : 3))
      .round(true)
      .tile(treemapSquarify.ratio(1.15))(root);
    return {
      leaves: laidOut.leaves(),
      groups: laidOut.children ?? [],
    };
  }, [height, maxVolume, timeframe, tree, width]);

  function moveHover(
    event: MouseEvent,
    entity: RankingEntity,
    series: SeriesPoint[],
    change: number,
  ) {
    setHover({
      entity,
      series,
      change,
      x: Math.min(event.clientX, window.innerWidth - 300),
      y: Math.min(event.clientY, window.innerHeight - 260),
    });
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-[460px] overflow-hidden bg-board md:h-[640px]"
      onMouseLeave={() => setHover(null)}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        role="img"
        aria-label={`${TYPE_LABEL[category] ?? "종합"} 화제 시세 트리맵 섹터 ${visible.length}종목`}
      >
        <defs>
          {leaves.map((leaf) => {
            const entity = leaf.data.entity;
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
        {groups.map((group) => {
          const gw = Math.max(group.x1 - group.x0, 0);
          const gh = Math.max(group.y1 - group.y0, 0);
          return (
            <g key={group.data.name}>
              <rect
                x={group.x0}
                y={group.y0}
                width={gw}
                height={gh}
                fill="var(--color-panel)"
                fillOpacity={0.35}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <rect
                x={group.x0}
                y={group.y0}
                width={gw}
                height={Math.min(24, gh)}
                fill="var(--color-panel)"
              />
              <text
                x={group.x0 + 10}
                y={group.y0 + 17}
                fill="var(--color-muted)"
                fontSize="12"
                fontWeight={700}
                fontFamily="var(--font-sans)"
              >
                {group.data.name}
              </text>
            </g>
          );
        })}
        {leaves.map((leaf) => {
          const entity = leaf.data.entity;
          if (!entity) return null;
          const series = getTimeframeSeries(entity, timeframe);
          const change = changeForEntity(entity, timeframe);
          const w = leaf.x1 - leaf.x0;
          const h = leaf.y1 - leaf.y0;
          const rate = formatRate(change);
          const metric = `${formatCompact(volumeForTimeframe(entity, timeframe))}`;
          const label = layoutTreemapLabel({
            width: w,
            height: h,
            y: leaf.y0,
            name: entity.name,
            rate,
            typeLabel: metric,
          });
          const fill = heatText(change);
          const padX = label?.padX ?? 8;
          const nameY = label?.nameY ?? leaf.y0 + Math.min(26, h * 0.4);
          const rateY = label?.rateY ?? Math.min(leaf.y1 - 8, nameY + 20);
          return (
            <a
              key={entity.id}
              href={rankingPath(entity.slug)}
              aria-label={`${TYPE_LABEL[entity.type]} ${entity.rank}위 ${entity.name} ${rate} ${metric}`}
              onMouseEnter={(event) => moveHover(event, entity, series, change)}
              onMouseMove={(event) => moveHover(event, entity, series, change)}
            >
              <g clipPath={`url(#tm-clip-${entity.id})`}>
                <rect
                  x={leaf.x0}
                  y={leaf.y0}
                  width={Math.max(w, 0)}
                  height={Math.max(h, 0)}
                  fill={heatFill(change)}
                />
                <text
                  x={leaf.x0 + padX}
                  y={nameY}
                  fill={fill}
                  fontSize={label?.nameSize ?? 19.2}
                  fontWeight={800}
                  letterSpacing="-0.03em"
                  fontFamily="var(--font-sans)"
                >
                  {label?.name ?? entity.name}
                </text>
                <text
                  x={leaf.x0 + padX}
                  y={rateY}
                  fill={fill}
                  fontSize={label?.rateSize ?? 12}
                  fontWeight={700}
                  letterSpacing="-0.02em"
                  fontFamily="var(--font-sans)"
                >
                  {rate}
                </text>
                {label?.showType ? (
                  <text
                    x={leaf.x0 + padX}
                    y={label.typeY}
                    fill={fill}
                    fontSize={label.typeSize}
                    fontWeight={600}
                    letterSpacing="-0.02em"
                    fontFamily="var(--font-sans)"
                    opacity={0.9}
                  >
                    {metric}
                  </text>
                ) : null}
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
