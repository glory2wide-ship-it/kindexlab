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

/** Soft typical share for the leader on a ~15–20 tile Finviz-style board. */
export const RANK_1_AREA_RATIO = 0.15;
export const REMAINING_AREA_RATIO = 1 - RANK_1_AREA_RATIO;
/** Soft ceiling used by helpers; live layout uses dynamic caps by tile count. */
export const RANK_BELOW_CAP = RANK_1_AREA_RATIO - 0.001;
/** Soft ceiling for near-square helper aspect (max(w,h)/min(w,h)). */
export const RANK_1_MAX_ASPECT = 1.25;

export interface HeatmapSizeInput {
  id: string;
  score: number;
  rank?: number;
  /** Optional display name — longer labels get a mild area boost for readability. */
  name?: string;
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

/** Milder Zipf on denser boards — Finviz market maps step down smoothly, not cliff-like. */
function zipfExponent(count: number): number {
  if (count >= 20) return 0.92;
  if (count >= 15) return 0.98;
  if (count >= 10) return 1.05;
  return 1.15;
}

/** Soft max share for the largest tile so one box does not dominate the map. */
function maxLeaderShare(count: number): number {
  if (count <= 4) return 0.38;
  if (count <= 6) return 0.34;
  if (count <= 10) return 0.26;
  if (count <= 15) return 0.2;
  return 0.17;
}

/**
 * Rank-primary Finviz weight: higher rank → larger tile.
 * Score only nudges neighbors; it must not let #3 outsize #2.
 */
function finvizWeight(rank: number, score: number, peakScore: number, exponent: number): number {
  const place = Math.max(Math.round(rank), 1);
  const peak = Math.max(peakScore, 1);
  const scoreNorm = Math.min(1, safeScore(score) / peak);
  // Mild assist (±12%) so ties break toward hotter names without flipping order.
  const scoreAssist = 0.88 + 0.12 * Math.pow(scoreNorm, 0.85);
  const rankPart = 1 / place ** exponent;
  return Math.max(rankPart * scoreAssist, 1e-6);
}

/** Longer Korean names need a slightly larger cell so the title stays readable. */
function readabilityAreaBoost(name?: string): number {
  if (!name) return 1;
  const chars = name.replace(/\s+/g, "").length;
  if (chars <= 4) return 1;
  if (chars <= 8) return 1.04;
  if (chars <= 12) return 1.1;
  if (chars <= 18) return 1.16;
  return 1.22;
}

/**
 * Strict 1 ≥ 2 ≥ 3 … with a visible step so each next rank is smaller on screen.
 * `step` is the max share of the previous tile (e.g. 0.94 → at most 94% of #n-1).
 */
function enforceStrictDescending(values: number[], step = 0.94): number[] {
  const out = [...values];
  for (let i = 1; i < out.length; i++) {
    const ceiling = out[i - 1]! * step;
    if (out[i]! > ceiling) out[i] = Math.max(ceiling, 1e-9);
  }
  return out;
}

function renormalize(values: number[]): number[] {
  const sum = values.reduce((total, value) => total + value, 0);
  if (sum <= 1e-12) return values.map(() => 1 / Math.max(values.length, 1));
  return values.map((value) => value / sum);
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
  // Preserve rank-area order — do not inflate tiny nodes enough to outsize mid ranks.
  const scaled = nodes.map((node) => ({
    ...node,
    value: (Math.max(node.value, 1e-9) / total) * area,
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
 * Finviz-style squarified treemap over the full canvas.
 * Largest tiles (by score×rank weight) are packed first so the leader naturally
 * anchors near a corner with near-square neighbors — no forced left-column stack.
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
  // Squarify expects largest-first; that also tends to park #1 top-left like Finviz.
  nodes.sort((a, b) => b.value - a.value || a.rank - b.rank);
  return squarifyPanel(nodes, 0, 0, width, height, padding);
}

/**
 * Continuous Finviz-like area shares for every tile (including rank 1).
 * Rank order is strict (1 > 2 > 3 …). Score and name length only nudge sizes.
 */
export function calculateHeatmapSizeRatios(items: HeatmapSizeInput[]): HeatmapSizeAllocation {
  const ratios = new Map<string, number>();
  if (!items.length) return { ratios, leftover: 0 };

  if (items.length === 1) {
    ratios.set(items[0].id, 1);
    return { ratios, leftover: 0 };
  }

  // Work in display-rank order so descending enforcement matches on-screen #1…#N.
  const ordered = items
    .map((item, index) => ({ item, index, rank: item.rank ?? index + 1 }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index);

  const n = ordered.length;
  const peak = Math.max(...ordered.map(({ item }) => safeScore(item.score)), 1);
  const exponent = zipfExponent(n);
  let values = ordered.map(({ item, rank }) =>
    finvizWeight(rank, item.score, peak, exponent) * readabilityAreaBoost(item.name),
  );
  values = renormalize(enforceStrictDescending(renormalize(values), 0.94));

  const leaderCap = maxLeaderShare(n);
  for (let guard = 0; guard < 8 && values[0]! > leaderCap + 1e-9; guard += 1) {
    const excess = values[0]! - leaderCap;
    values[0] = leaderCap;
    const restSum = values.slice(1).reduce((sum, value) => sum + value, 0) || 1;
    for (let i = 1; i < values.length; i++) {
      values[i] = values[i]! + excess * (values[i]! / restSum);
    }
    values = renormalize(enforceStrictDescending(values, 0.94));
  }
  // Final hard clamp — never let #1 reclaim share above the cap.
  if (values[0]! > leaderCap) {
    const scale = (1 - leaderCap) / Math.max(1e-9, 1 - values[0]!);
    const head = leaderCap;
    const tail = values.slice(1).map((value) => value * scale);
    values = [head, ...tail];
    values = renormalize(enforceStrictDescending(values, 0.94));
    values[0] = Math.min(values[0]!, leaderCap);
    const used = values.reduce((sum, value) => sum + value, 0) || 1;
    if (Math.abs(used - 1) > 1e-6) {
      const fix = (1 - values[0]!) / Math.max(1e-9, used - values[0]!);
      for (let i = 1; i < values.length; i++) values[i] = values[i]! * fix;
    }
  }

  // Tiny-tile floor so the tail stays clickable — then re-assert rank order.
  const minShare = Math.min(0.016, 0.48 / n);
  let deficit = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i]! < minShare) {
      deficit += minShare - values[i]!;
      values[i] = minShare;
    }
  }
  if (deficit > 0) {
    const headLen = Math.max(1, Math.ceil(n * 0.35));
    const headSum = values.slice(0, headLen).reduce((sum, value) => sum + value, 0) || 1;
    for (let i = 0; i < headLen; i++) {
      values[i] = Math.max(minShare, values[i]! - deficit * (values[i]! / headSum));
    }
  }
  values = renormalize(enforceStrictDescending(values, 0.94));

  ordered.forEach(({ item }, index) => {
    ratios.set(item.id, values[index] ?? 0);
  });
  const used = [...ratios.values()].reduce((sum, value) => sum + value, 0);
  return { ratios, leftover: Math.max(0, 1 - used) };
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
