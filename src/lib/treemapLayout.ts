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
/** Fewest tiles for which the fixed rank-1 share still exceeds an equal split. */
const MIN_ITEMS_FOR_FIXED_LEAD = Math.ceil(1 / RANK_1_AREA_RATIO);

export interface HeatmapSizeInput {
  id: string;
  score: number;
  rank?: number;
}

export interface HeatmapSizeAllocation {
  /** id → area share of the full treemap (sums to ≤ 1). */
  ratios: Map<string, number>;
  /** Unassigned share after the 24.9% cap; rendered as empty gap. */
  leftover: number;
}

function safeScore(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Rank Zipf × normalized score. Rank 2 leads; a higher index still enlarges a tile. */
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
  const scorePart = 0.28 + 0.72 * scoreNorm ** 1.12;
  return rankPart * scorePart;
}

/** Split a pool by weight, capping every tile below the rank-1 25% share. */
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

/**
 * Rank 1 is always 25% of the map. Rank 2+ share the other 75% by rank × score,
 * each capped below 25%. Incoming order is the display rank (same as the list).
 */
export function calculateHeatmapSizeRatios(items: HeatmapSizeInput[]): HeatmapSizeAllocation {
  const ratios = new Map<string, number>();
  if (!items.length) return { ratios, leftover: 0 };

  if (items.length === 1) {
    ratios.set(items[0].id, 1);
    return { ratios, leftover: 0 };
  }

  // Below this count an equal split would already hand every tile more than the
  // leader's fixed share, so pinning rank 1 to it would shrink the leader below
  // its followers and force the rest into a wall of identical capped tiles.
  // Small maps fall back to a straight weighted split, where rank 1 leads on its
  // own merits.
  if (items.length < MIN_ITEMS_FOR_FIXED_LEAD) {
    const peak = Math.max(...items.map((item) => safeScore(item.score)), 1);
    const weights = items.map((item, index) =>
      rankScoreWeight(item.rank ?? index + 1, item.score, peak, 1.28, 1),
    );
    const total = weights.reduce((sum, value) => sum + value, 0) || 1;
    items.forEach((item, index) => ratios.set(item.id, weights[index] / total));
    return { ratios, leftover: 0 };
  }

  ratios.set(items[0].id, RANK_1_AREA_RATIO);
  const rest = items.slice(1);
  const packed = items.length >= 20;
  const exponent = packed ? 0.88 : 1.28;
  // Held clearly under the leader rather than just below it. At the bare cap the
  // runner-up lands within a tenth of a point of rank 1 and the two read as the
  // same size, which defeats the fixed share. A packed map is squeezed further
  // still so the tail keeps usable area.
  const cap = packed ? Math.min(0.11, RANK_BELOW_CAP) : RANK_1_AREA_RATIO * 0.8;
  const peak = Math.max(...rest.map((item) => safeScore(item.score)), 1);
  const weights = rest.map((item, index) =>
    rankScoreWeight(item.rank ?? index + 2, item.score, peak, exponent),
  );
  const restRatios = allocatePool(weights, REMAINING_AREA_RATIO, cap);
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
