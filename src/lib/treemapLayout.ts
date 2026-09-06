import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from "d3-hierarchy";

export interface RankedTile {
  id: string;
  rank: number;
}

export interface TreemapBox {
  id: string;
  rank: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Rank 1 always occupies this share of the map's area. */
export const RANK_1_AREA_RATIO = 0.15;
export const REMAINING_AREA_RATIO = 1 - RANK_1_AREA_RATIO;
/**
 * Rank 2+ must stay strictly below the rank-1 share, otherwise the leader stops
 * reading as the leader. Derived rather than written out so the two cannot drift
 * apart when the share is retuned.
 */
export const RANK_BELOW_CAP = RANK_1_AREA_RATIO - 0.001;

export interface HeatmapSizeInput {
  id: string;
  score: number;
  rank?: number;
}

export interface HeatmapSizeAllocation {
  /** id → area share of the full treemap (sums to ≤ 1). */
  ratios: Map<string, number>;
  /** Unassigned share after the rank-1 pin and rank-2+ caps; rendered as empty gap. */
  leftover: number;
}

function safeScore(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Rank Zipf × index score. Rank decay keeps 2 > 3 > … even when scores bunch;
 * the score term still stretches neighbors so a higher index reads larger.
 */
function rankScoreWeight(
  rank: number,
  score: number,
  peakScore: number,
  exponent: number,
  floorPlace = 2,
): number {
  const place = Math.max(Math.round(rank), floorPlace);
  const rankPart = 1 / place ** exponent;
  const peak = Math.max(peakScore, 1);
  const scoreNorm = Math.min(1, safeScore(score) / peak);
  const scorePart = 0.18 + 0.82 * scoreNorm ** 1.05;
  return rankPart * scorePart;
}

/** Walk rank 2+ and shrink any tile that would match or exceed the one above it. */
function enforceDescending(leaderShare: number, rest: number[]): number[] {
  const out = [...rest];
  let previous = leaderShare;
  for (let i = 0; i < out.length; i++) {
    const ceiling = previous * 0.9;
    if (out[i] >= ceiling) out[i] = ceiling;
    previous = out[i];
  }
  return out;
}

/** Split a pool by weight, capping every tile below the rank-1 15% share. */
function allocatePool(weights: number[], pool = REMAINING_AREA_RATIO, cap = RANK_BELOW_CAP): number[] {
  const n = weights.length;
  if (!n) return [];
  const values = weights.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const ratios = new Array(n).fill(0);
  const locked = new Array(n).fill(false);
  let remaining = pool;

  for (let round = 0; round < n + 2; round++) {
    let freeWeight = 0;
    let freeCount = 0;
    for (let i = 0; i < n; i++) {
      if (locked[i]) continue;
      freeWeight += values[i];
      freeCount += 1;
    }
    if (freeCount === 0 || remaining <= 1e-12) break;

    const snapshot = remaining;
    let capped = false;
    for (let i = 0; i < n; i++) {
      if (locked[i]) continue;
      const raw = freeWeight > 0 ? (values[i] / freeWeight) * snapshot : snapshot / freeCount;
      if (raw > cap) {
        ratios[i] = cap;
        locked[i] = true;
        remaining -= cap;
        capped = true;
      }
    }
    if (capped) continue;

    for (let i = 0; i < n; i++) {
      if (locked[i]) continue;
      ratios[i] = freeWeight > 0 ? (values[i] / freeWeight) * remaining : remaining / freeCount;
    }
    remaining = 0;
    break;
  }

  return ratios;
}

interface PanelNode {
  id?: string;
  rank?: number;
  value?: number;
  children?: PanelNode[];
}

/** Pixel box for rank 1: a full-height left column of exactly 15% of the map. */
export function rank1Rectangle(
  width: number,
  height: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const w = Math.max(1, Math.round(Math.max(width, 1) * RANK_1_AREA_RATIO));
  return { x0: 0, y0: 0, x1: Math.min(w, width), y1: height };
}

function squarifyPanel(
  nodes: PanelNode[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  padding: number,
): TreemapBox[] {
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 2 || h < 2 || !nodes.length) return [];
  const root = hierarchy<PanelNode>({ children: nodes }).sum((node) =>
    node.children?.length ? 0 : Math.max(node.value ?? 0, 0),
  );
  root.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const laid: HierarchyRectangularNode<PanelNode> = treemap<PanelNode>()
    .size([w, h])
    .tile(treemapSquarify.ratio(1.15))
    .paddingInner(padding)
    .paddingOuter(0)
    .round(true)(root);

  return laid.leaves().flatMap((leaf) => {
    const id = leaf.data.id;
    if (!id) return [];
    return [
      {
        id,
        rank: leaf.data.rank ?? 0,
        x0: leaf.x0 + x0,
        y0: leaf.y0 + y0,
        x1: leaf.x1 + x0,
        y1: leaf.y1 + y0,
      },
    ];
  });
}

/**
 * Rank-1 pixel box: exactly ~15% of map area, forced near 1:1 (square).
 * Never stretches into a full-height column.
 */
function rank1SquareBox(
  width: number,
  height: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const mapArea = Math.max(width, 1) * Math.max(height, 1);
  const targetArea = mapArea * RANK_1_AREA_RATIO;
  let side = Math.round(Math.sqrt(targetArea));

  // Leave room for the L-shaped remainder; keep aspect within ~1:1.15.
  const maxSide = Math.min(width - 64, height - 64, Math.round(Math.min(width, height) * 0.72));
  const minSide = Math.max(48, Math.round(Math.min(width, height) * 0.22));
  side = Math.max(minSide, Math.min(maxSide, side));

  let leadW = side;
  let leadH = Math.round(targetArea / Math.max(leadW, 1));
  if (leadH > side * 1.12) {
    leadH = Math.round(side * 1.12);
    leadW = Math.round(targetArea / Math.max(leadH, 1));
  } else if (leadH < side / 1.12) {
    leadH = Math.round(side / 1.12);
    leadW = Math.round(targetArea / Math.max(leadH, 1));
  }
  leadW = Math.max(minSide, Math.min(leadW, width - 48));
  leadH = Math.max(minSide, Math.min(leadH, height - 48));
  // Re-pin area after clamping so painted share stays near 15%.
  const area = leadW * leadH;
  if (area > 0 && Math.abs(area - targetArea) / targetArea > 0.04) {
    const scale = Math.sqrt(targetArea / area);
    leadW = Math.max(minSide, Math.min(width - 48, Math.round(leadW * scale)));
    leadH = Math.max(minSide, Math.min(height - 48, Math.round(targetArea / Math.max(leadW, 1))));
  }
  return { x0: 0, y0: 0, x1: leadW, y1: leadH };
}

/**
 * Rank 1 top-left (~15% area, near-square). Rank 2 directly under it (same
 * column width). Ranks 3+ fill the full-height panel to the right.
 */
export function layoutHeatmapLeaves(
  items: HeatmapSizeInput[],
  width: number,
  height: number,
  padding = 2,
): TreemapBox[] {
  if (!items.length || width <= 0 || height <= 0) return [];

  if (items.length === 1) {
    return [{ id: items[0].id, rank: items[0].rank ?? 1, x0: 0, y0: 0, x1: width, y1: height }];
  }

  const allocation = calculateHeatmapSizeRatios(items);
  const gutter = Math.max(1, padding);
  const lead = rank1SquareBox(width, height);
  const colW = lead.x1;
  const rank1H = lead.y1;

  const boxes: TreemapBox[] = [
    {
      id: items[0].id,
      rank: items[0].rank ?? 1,
      x0: 0,
      y0: 0,
      x1: colW,
      y1: rank1H,
    },
  ];

  const rank2 = items[1];
  const rank2Y0 = Math.min(rank1H + gutter, height - 1);
  // Stretch rank 2 to the bottom edge so no empty gap sits under the left column.
  const rank2Y1 = height;

  boxes.push({
    id: rank2.id,
    rank: rank2.rank ?? 2,
    x0: 0,
    y0: rank2Y0,
    x1: colW,
    y1: rank2Y1,
  });

  const rightItems = items.slice(2);
  if (!rightItems.length) return boxes;

  const rightX = Math.min(colW + gutter, width);
  if (width - rightX < 8) return boxes;

  const rightNodes: PanelNode[] = rightItems.map((item, index) => ({
    id: item.id,
    rank: item.rank ?? index + 3,
    value: Math.max(allocation.ratios.get(item.id) ?? 0, 1e-6),
  }));

  boxes.push(...squarifyPanel(rightNodes, rightX, 0, width, height, padding));
  return boxes;
}

function fillRestPool(leaderShare: number, rest: number[], pool: number): number[] {
  let values = enforceDescending(leaderShare, rest);
  for (let round = 0; round < 4; round++) {
    const sum = values.reduce((total, value) => total + value, 0);
    if (sum <= 1e-12) break;
    values = enforceDescending(
      leaderShare,
      values.map((value) => (value / sum) * pool),
    );
    const used = values.reduce((total, value) => total + value, 0);
    if (Math.abs(used - pool) < 1e-6) break;
  }
  return values;
}

/**
 * Rank 1 is always 15% of the map. Rank 2+ share the other 85% by rank × index
 * score, each capped below 15% and strictly smaller than the tile above it.
 * Incoming order is the display rank (same as the list).
 */
export function calculateHeatmapSizeRatios(items: HeatmapSizeInput[]): HeatmapSizeAllocation {
  const ratios = new Map<string, number>();
  if (!items.length) return { ratios, leftover: 0 };

  if (items.length === 1) {
    ratios.set(items[0].id, 1);
    return { ratios, leftover: 0 };
  }

  ratios.set(items[0].id, RANK_1_AREA_RATIO);
  const rest = items.slice(1);
  const packed = items.length >= 20;
  const exponent = packed ? 1.12 : 1.28;
  const cap = packed ? Math.min(0.11, RANK_BELOW_CAP) : RANK_1_AREA_RATIO * 0.82;
  const peak = Math.max(...rest.map((item) => safeScore(item.score)), 1);
  const weights = rest.map((item, index) =>
    rankScoreWeight(item.rank ?? index + 2, item.score, peak, exponent),
  );
  const restRatios = fillRestPool(
    RANK_1_AREA_RATIO,
    allocatePool(weights, REMAINING_AREA_RATIO, cap),
    REMAINING_AREA_RATIO,
  );
  rest.forEach((item, index) => {
    ratios.set(item.id, restRatios[index] ?? 0);
  });
  const used = [...ratios.values()].reduce((sum, value) => sum + value, 0);
  const leftover = Math.max(0, 1 - used);
  return { ratios, leftover };
}

/** Area weight used by the strip fallback layout. */
export function tileAreaWeight(input: {
  rank: number;
  count: number;
  score?: number;
  volume?: number;
}): number {
  return rankAreaWeight(input.rank, input.count, input.score ?? 100);
}

export function rankAreaWeight(rank: number, count: number, score = 100): number {
  const items = Array.from({ length: Math.max(count, 1) }, (_, index) => ({
    id: String(index + 1),
    rank: index + 1,
    score: index === 0 ? Math.max(score, 1) : Math.max(score, 1) / (index + 1),
  }));
  return calculateHeatmapSizeRatios(items).ratios.get(String(rank)) ?? 0.01;
}

/**
 * Ordered strip treemap: rank 1 sits top-left and is the largest cell.
 * Lower ranks get smaller cells, filling left→right then top→bottom.
 */
export function layoutRankedTreemap(
  items: RankedTile[],
  width: number,
  height: number,
  padding = 4,
): TreemapBox[] {
  const ordered = [...items].sort((a, b) => a.rank - b.rank);
  const n = ordered.length;
  if (!n || width <= 0 || height <= 0) return [];

  const pad = Math.max(1, padding);
  const innerW = Math.max(1, width - pad);
  const innerH = Math.max(1, height - pad);
  const allocation = calculateHeatmapSizeRatios(
    ordered.map((item) => ({
      id: item.id,
      score: 1 / Math.max(item.rank, 1),
      rank: item.rank,
    })),
  );
  const weights = ordered.map((item) => allocation.ratios.get(item.id) ?? 0);
  const cols = Math.max(1, Math.round(Math.sqrt(n * (innerW / Math.max(innerH, 1)))));

  const rows: number[][] = [];
  for (let i = 0; i < n; i += cols) {
    rows.push(Array.from({ length: Math.min(cols, n - i) }, (_, offset) => i + offset));
  }

  const rowTotals = rows.map((indices) => indices.reduce((sum, i) => sum + weights[i], 0));
  const grand = rowTotals.reduce((sum, value) => sum + value, 0) || 1;
  const firstRowSum = rowTotals[0] || 1;

  const boxes: TreemapBox[] = [];
  let y = pad / 2;
  rows.forEach((indices, rowIndex) => {
    const isLast = rowIndex === rows.length - 1;
    const rowH = isLast ? height - pad / 2 - y : (innerH * rowTotals[rowIndex]) / grand;
    let x = pad / 2;
    indices.forEach((i, colIndex) => {
      const isLastCol = colIndex === indices.length - 1;
      const span = rows[rowIndex].length === cols;
      const cellW = span
        ? isLastCol
          ? width - pad / 2 - x
          : (innerW * weights[i]) / rowTotals[rowIndex]
        : (innerW * weights[i]) / firstRowSum;
      boxes.push({
        id: ordered[i].id,
        rank: ordered[i].rank,
        x0: Math.round(x * 10) / 10,
        y0: Math.round(y * 10) / 10,
        x1: Math.round((x + Math.max(cellW - padding, 18)) * 10) / 10,
        y1: Math.round((y + Math.max(rowH - padding, 18)) * 10) / 10,
      });
      x += cellW;
    });
    y += rowH;
  });
  return boxes;
}
