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

/** Rank 1 target share of the map's area (within the 12–15% band). */
export const RANK_1_AREA_RATIO = 0.14;
export const REMAINING_AREA_RATIO = 1 - RANK_1_AREA_RATIO;
/**
 * Rank 2+ must stay strictly below the rank-1 share, otherwise the leader stops
 * reading as the leader. Derived rather than written out so the two cannot drift
 * apart when the share is retuned.
 */
export const RANK_BELOW_CAP = RANK_1_AREA_RATIO - 0.001;
/** Soft ceiling for rank-1 box aspect (max(w,h)/min(w,h)). */
export const RANK_1_MAX_ASPECT = 1.2;

export interface HeatmapSizeInput {
  id: string;
  score: number;
  rank?: number;
}

export interface HeatmapSizeAllocation {
  /** id → area share of the full treemap (sums to ≤ 1). */
  ratios: Map<string, number>;
  /** Unassigned share after caps. Layout never paints this as a hole — leftover is redistributed. */
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
  // ~6% step-down per rank keeps 2 > 3 > … visible while still filling the
  // remaining ~86% pool at typical heatmap counts (15–20 tiles).
  const step = 0.94;
  for (let i = 0; i < out.length; i++) {
    const ceiling = previous * step;
    if (out[i] >= ceiling) out[i] = ceiling;
    previous = out[i];
  }
  return out;
}

/** Split a pool by weight, capping every tile below the rank-1 share. */
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
  id: string;
  rank: number;
  value: number;
}

/**
 * Near-square pixel size for rank 1 at `areaRatio` of the map.
 * Prefers a true square; softens to at most `RANK_1_MAX_ASPECT` when clamped.
 */
export function nearSquareRank1Size(
  width: number,
  height: number,
  areaRatio = RANK_1_AREA_RATIO,
): { w: number; h: number } {
  const mapArea = Math.max(width * height, 1);
  const targetArea = mapArea * areaRatio;
  // Leave room for the L-shaped remainder on both axes.
  const maxW = Math.max(24, width * 0.62);
  const maxH = Math.max(24, height * 0.62);
  let side = Math.min(Math.sqrt(targetArea), maxW, maxH);
  let w = side;
  let h = targetArea / Math.max(w, 1);

  if (h > maxH) {
    h = maxH;
    w = targetArea / h;
  }
  if (w > maxW) {
    w = maxW;
    h = targetArea / w;
  }

  const aspect = Math.max(w / Math.max(h, 1), h / Math.max(w, 1));
  if (aspect > RANK_1_MAX_ASPECT) {
    const s = Math.sqrt(Math.max(w * h, 1));
    w = Math.min(s, maxW);
    h = Math.min(s, maxH);
  }

  w = Math.max(16, Math.min(Math.round(w), Math.max(16, width - 16)));
  h = Math.max(16, Math.min(Math.round(h), Math.max(16, height - 16)));
  return { w, h };
}

/** Pixel box for rank 1: near-square block in the top-left (≈12–15% area). */
export function rank1Rectangle(
  width: number,
  height: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const { w, h } = nearSquareRank1Size(width, height);
  return { x0: 0, y0: 0, x1: Math.min(w, width), y1: Math.min(h, height) };
}

function rowWorstAspect(row: PanelNode[], rowValue: number, shortSide: number): number {
  if (rowValue <= 0 || shortSide <= 0) return Number.POSITIVE_INFINITY;
  const thickness = rowValue / shortSide;
  if (thickness <= 0) return Number.POSITIVE_INFINITY;
  let worst = 0;
  for (const node of row) {
    const along = node.value / thickness;
    const aspect = along > thickness ? along / thickness : thickness / Math.max(along, 1e-9);
    if (aspect > worst) worst = aspect;
  }
  return worst;
}

/** Last cell in a strip always reaches the far edge so rounding cannot leave a hole. */
function layoutStrip(
  row: PanelNode[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  gap: number,
  splitAlongY: boolean,
): TreemapBox[] {
  const sum = row.reduce((total, node) => total + node.value, 0) || row.length;
  const boxes: TreemapBox[] = [];
  if (splitAlongY) {
    let y = y0;
    const span = y1 - y0;
    row.forEach((node, index) => {
      const last = index === row.length - 1;
      const share = span * (node.value / sum);
      const next = last ? y1 : y + share;
      boxes.push({
        id: node.id,
        rank: node.rank,
        x0,
        y0: y,
        x1,
        y1: last ? y1 : Math.max(y + 1, next - gap),
      });
      y = next;
    });
    return boxes;
  }
  let x = x0;
  const span = x1 - x0;
  row.forEach((node, index) => {
    const last = index === row.length - 1;
    const share = span * (node.value / sum);
    const next = last ? x1 : x + share;
    boxes.push({
      id: node.id,
      rank: node.rank,
      x0: x,
      y0,
      x1: last ? x1 : Math.max(x + 1, next - gap),
      y1,
    });
    x = next;
  });
  return boxes;
}

/**
 * Squarify that always emits one box per node and paints every pixel of the
 * panel (minus gutters). Rows are packed against the shorter side so tiles
 * stay near 1:1 instead of full-height strips.
 */
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
  const gap = Math.max(0, padding);
  if (!nodes.length) return [];
  if (w < 1 || h < 1) {
    return nodes.map((node) => ({ id: node.id, rank: node.rank, x0, y0, x1, y1 }));
  }
  if (nodes.length === 1) {
    return [{ id: nodes[0].id, rank: nodes[0].rank, x0, y0, x1, y1 }];
  }

  const total = nodes.reduce((sum, node) => sum + Math.max(node.value, 0), 0) || nodes.length;
  const area = Math.max(w * h, 1);
  const scaled = nodes.map((node) => ({
    ...node,
    value: (Math.max(node.value, total / (nodes.length * 6)) / total) * area,
  }));
  const scaleTotal = scaled.reduce((sum, node) => sum + node.value, 0) || 1;
  const normalized = scaled.map((node) => ({ ...node, value: (node.value / scaleTotal) * area }));
  return squarifyFill(normalized, x0, y0, x1, y1, gap);
}

function squarifyFill(
  nodes: PanelNode[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  gap: number,
): TreemapBox[] {
  if (!nodes.length) return [];
  if (nodes.length === 1) {
    return [{ id: nodes[0].id, rank: nodes[0].rank, x0, y0, x1, y1 }];
  }
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 2 || h < 2) {
    return layoutStrip(nodes, x0, y0, x1, y1, 0, h >= w);
  }

  const total = nodes.reduce((sum, node) => sum + node.value, 0) || 1;
  const short = Math.min(w, h);
  const row: PanelNode[] = [];
  let rowValue = 0;
  let take = 0;
  while (take < nodes.length) {
    const trial = row.concat(nodes[take]!);
    const trialValue = rowValue + nodes[take]!.value;
    const nextWorst = rowWorstAspect(trial, trialValue, short);
    const currentWorst = row.length ? rowWorstAspect(row, rowValue, short) : Number.POSITIVE_INFINITY;
    if (row.length && nextWorst > currentWorst) break;
    row.push(nodes[take]!);
    rowValue = trialValue;
    take += 1;
  }
  const rest = nodes.slice(take);
  if (!rest.length) {
    return layoutStrip(row, x0, y0, x1, y1, gap, w >= h);
  }

  const rowArea = row.reduce((sum, node) => sum + node.value, 0);
  if (w >= h) {
    const stripW = Math.min(w - 8, Math.max(8, rowArea / total * w));
    const cut = x0 + stripW;
    return [
      ...layoutStrip(row, x0, y0, cut, y1, gap, true),
      ...squarifyFill(rest, Math.min(cut + gap, x1), y0, x1, y1, gap),
    ];
  }
  const stripH = Math.min(h - 8, Math.max(8, rowArea / total * h));
  const cut = y0 + stripH;
  return [
    ...layoutStrip(row, x0, y0, x1, cut, gap, false),
    ...squarifyFill(rest, x0, Math.min(cut + gap, y1), x1, y1, gap),
  ];
}

/**
 * Rank 1 is placed as a near-square (≈14% of the map). Rank 2+ fill the
 * remaining L-shaped region via squarified panels, still strictly smaller than
 * the tile above them.
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
  const nodes: PanelNode[] = items.map((item, index) => ({
    id: item.id,
    rank: item.rank ?? index + 1,
    value: Math.max(allocation.ratios.get(item.id) ?? 0, 1e-6),
  }));

  const gap = Math.max(0, padding);
  const leader = nodes[0]!;
  const rest = nodes.slice(1);
  const { w: leadW, h: leadH } = nearSquareRank1Size(width, height);
  const leaderBox: TreemapBox = {
    id: leader.id,
    rank: leader.rank,
    x0: 0,
    y0: 0,
    x1: leadW,
    y1: leadH,
  };

  if (!rest.length) {
    return [{ ...leaderBox, x1: width, y1: height }];
  }

  const rightX0 = Math.min(leadW + gap, width);
  const bottomY0 = Math.min(leadH + gap, height);
  const rightW = width - rightX0;
  const bottomH = height - bottomY0;
  const usableRight = rightW >= 24 && leadH >= 24;
  const usableBottom = width >= 24 && bottomH >= 24;

  if (!usableRight && !usableBottom) {
    return squarifyPanel(nodes, 0, 0, width, height, gap);
  }

  const restTotal = rest.reduce((sum, node) => sum + node.value, 0) || rest.length;
  const rightArea = Math.max(rightW, 0) * Math.max(leadH, 0);
  const bottomArea = Math.max(width, 0) * Math.max(bottomH, 0);

  let rightNodes: PanelNode[] = [];
  let bottomNodes: PanelNode[] = [];

  if (usableRight && usableBottom) {
    const targetRight = restTotal * (rightArea / Math.max(rightArea + bottomArea, 1));
    let acc = 0;
    for (let i = 0; i < rest.length; i++) {
      const node = rest[i]!;
      const remainingAfter = rest.length - i - 1;
      // Keep at least one tile for the bottom panel when possible.
      if (rightNodes.length && (acc >= targetRight || remainingAfter === 0)) {
        bottomNodes.push(node);
      } else {
        rightNodes.push(node);
        acc += node.value;
      }
    }
    if (!bottomNodes.length && rightNodes.length > 1) {
      bottomNodes.push(rightNodes.pop()!);
    }
    if (!rightNodes.length && bottomNodes.length > 1) {
      rightNodes.push(bottomNodes.shift()!);
    }
  } else if (usableRight) {
    rightNodes = rest;
  } else {
    bottomNodes = rest;
  }

  const boxes: TreemapBox[] = [leaderBox];
  if (rightNodes.length && usableRight) {
    boxes.push(...squarifyPanel(rightNodes, rightX0, 0, width, leadH, gap));
  }
  if (bottomNodes.length && usableBottom) {
    boxes.push(...squarifyPanel(bottomNodes, 0, bottomY0, width, height, gap));
  }

  // If a panel was empty after partitioning, fall back so we never leave a hole.
  if (boxes.length < nodes.length) {
    return squarifyPanel(nodes, 0, 0, width, height, gap);
  }
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
 * Rank 1 is always ~14% of the map (12–15% band). Rank 2+ share the rest by
 * rank × index score, each capped below rank 1 and strictly smaller than the
 * tile above it so box size steps down with rank.
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
  // Stronger Zipf decay → clearer size drop from 2 → 3 → … even when scores bunch.
  const exponent = packed ? 1.12 : 1.2;
  const cap = packed ? Math.min(0.12, RANK_BELOW_CAP) : RANK_1_AREA_RATIO * 0.88;
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
