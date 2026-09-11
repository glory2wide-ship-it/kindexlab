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

/** Soft typical share for the leader — kept modest so lower tiles stay readable. */
export const RANK_1_AREA_RATIO = 0.15;
/** Soft ceiling for rank 1 on dense boards (~20% above prior compact era). */
export const RANK_TOP_AREA_CAP = 0.15;
export const REMAINING_AREA_RATIO = 1 - RANK_1_AREA_RATIO;
/** Soft ceiling used by helpers; live layout uses dynamic caps by tile count. */
export const RANK_BELOW_CAP = RANK_1_AREA_RATIO - 0.001;
/** Soft ceiling for near-square helper aspect (max(w,h)/min(w,h)). */
export const RANK_1_MAX_ASPECT = 1.35;
/** Neighbor step after #1 — keeps #2 well below the leader without starving the tail. */
export const RANK_AREA_STEP = 0.78;
/** Soft floor so lower-rank tiles keep readable label area. */
export const RANK_TAIL_FLOOR = 0.03;
/** Max tile aspect (max/min side). Prefer near-square; never beyond 16:9 / 9:16. */
export const MAX_TILE_ASPECT = 16 / 9;

export type HeatmapLayoutVariant =
  | "squarify"
  | "bands-top"
  | "spine-left"
  | "slice-dice"
  | "cascade-br"
  | "cascade-row";

export interface HeatmapLayoutOptions {
  /** Packing recipe — mobile picks a seeded variant for visual variety. */
  variant?: HeatmapLayoutVariant;
  /** Stable seed (category / top id) so the same board keeps one look per session. */
  seed?: string;
}

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

/** Mild Zipf — #1/#2 stay modest so lower ranks get usable area for names. */
function zipfExponent(count: number): number {
  if (count >= 20) return 0.48;
  if (count >= 15) return 0.55;
  if (count >= 10) return 0.62;
  if (count >= 6) return 0.72;
  return 0.85;
}

/** Soft max share for #1 — prefers the visual cap; additive floor fills the rest. */
function maxLeaderShare(count: number, _step = RANK_AREA_STEP): number {
  void _step;
  // #1 is fixed at 15% on normal heatmaps (8+ tiles). Fewer tiles need a
  // larger leader so a strict descending ladder can still fill the map
  // (n × 15% < 100% is impossible when every tile is ≤ the previous).
  if (count >= 8) return RANK_1_AREA_RATIO;
  if (count === 7) return 0.17;
  if (count === 6) return 0.2;
  if (count === 5) return 0.26;
  if (count === 4) return 0.32;
  if (count === 3) return 0.42;
  if (count === 2) return 0.58;
  return 1;
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

/** Longer Korean names need a larger cell so the title stays readable. */
function readabilityAreaBoost(name?: string): number {
  if (!name) return 1;
  const chars = name.replace(/\s+/g, "").length;
  if (chars <= 4) return 1;
  if (chars <= 8) return 1.06;
  if (chars <= 12) return 1.14;
  if (chars <= 18) return 1.22;
  return 1.3;
}

/**
 * Strict 1 ≥ 2 ≥ 3 … with a steep step so top ranks read as a clear ladder.
 * `step` is the max share of the previous tile (e.g. 0.82 → at most 82% of #n-1).
 */
function enforceStrictDescending(values: number[], step = RANK_AREA_STEP): number[] {
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
 * Near-square pixel size for a lead tile at `areaRatio` of the map.
 * Prefers a true square; softens to at most `maxAspect` when clamped.
 */
export function nearSquareRank1Size(
  width: number,
  height: number,
  areaRatio = RANK_1_AREA_RATIO,
  maxAspect = RANK_1_MAX_ASPECT,
): { w: number; h: number } {
  const mapArea = Math.max(width * height, 1);
  const targetArea = mapArea * areaRatio;
  // Leave room for the L-shaped remainder on both axes.
  const maxW = Math.max(24, width * 0.58);
  const maxH = Math.max(24, height * 0.58);
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
  if (aspect > maxAspect) {
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
    // Prefer stopping before a row would push tiles past 16:9 when the current row is already ok.
    if (row.length && nextWorst > MAX_TILE_ASPECT && currentWorst <= MAX_TILE_ASPECT) break;
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

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pickHeatmapLayoutVariant(seed: string): HeatmapLayoutVariant {
  // Prefer near-square packs (squarify family). Cascade variants place a near-square
  // #1 then L-fill so tiles stay within 16:9. Seeded for category / filter variety.
  const variants: HeatmapLayoutVariant[] = [
    "squarify",
    "bands-top",
    "spine-left",
    "cascade-br",
    "squarify",
    "bands-top",
    "cascade-row",
    "spine-left",
    "squarify",
    "slice-dice",
    "bands-top",
    "cascade-br",
  ];
  return variants[hashSeed(seed) % variants.length]!;
}

function mirrorBoxes(
  boxes: TreemapBox[],
  width: number,
  height: number,
  axis: "x" | "y",
): TreemapBox[] {
  return boxes.map((box) => {
    if (axis === "x") {
      return {
        ...box,
        x0: width - box.x1,
        x1: width - box.x0,
      };
    }
    return {
      ...box,
      y0: height - box.y1,
      y1: height - box.y0,
    };
  });
}

/** Top band for #1–#2, squarified remainder below — reads differently from pure squarify. */
function layoutBandsTop(
  nodes: PanelNode[],
  width: number,
  height: number,
  padding: number,
): TreemapBox[] {
  const ordered = [...nodes].sort((a, b) => a.rank - b.rank || b.value - a.value);
  if (ordered.length <= 2) {
    return squarifyPanel(ordered, 0, 0, width, height, padding);
  }
  const total = ordered.reduce((sum, node) => sum + node.value, 0) || 1;
  const head = ordered.slice(0, Math.min(2, ordered.length));
  const tail = ordered.slice(head.length);
  const headShare = head.reduce((sum, node) => sum + node.value, 0) / total;
  // Full-width band height matches allocated area share so #1/#2 stay ≤10% each.
  const bandH = Math.max(36, Math.min(height - 36, height * headShare));
  const gap = Math.max(0, padding);
  return [
    ...squarifyPanel(head, 0, 0, width, bandH, padding),
    ...squarifyPanel(tail, 0, Math.min(bandH + gap, height), width, height, padding),
  ];
}

/** Left spine for #1–#3, squarified remainder on the right. */
function layoutSpineLeft(
  nodes: PanelNode[],
  width: number,
  height: number,
  padding: number,
): TreemapBox[] {
  const ordered = [...nodes].sort((a, b) => a.rank - b.rank || b.value - a.value);
  if (ordered.length <= 3) {
    return squarifyPanel(ordered, 0, 0, width, height, padding);
  }
  const total = ordered.reduce((sum, node) => sum + node.value, 0) || 1;
  const head = ordered.slice(0, 3);
  const tail = ordered.slice(3);
  const headShare = head.reduce((sum, node) => sum + node.value, 0) / total;
  // Full-height spine width matches allocated area share.
  const spineW = Math.max(40, Math.min(width - 40, width * headShare));
  const gap = Math.max(0, padding);
  return [
    ...squarifyPanel(head, 0, 0, spineW, height, padding),
    ...squarifyPanel(tail, Math.min(spineW + gap, width), 0, width, height, padding),
  ];
}

/** Alternate horizontal/vertical strips (slice-and-dice) for a distinct mobile rhythm. */
function layoutSliceDice(
  nodes: PanelNode[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  gap: number,
  vertical: boolean,
): TreemapBox[] {
  if (!nodes.length) return [];
  if (nodes.length === 1) {
    return [{ id: nodes[0]!.id, rank: nodes[0]!.rank, x0, y0, x1, y1 }];
  }
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 8 || h < 8) {
    return layoutStrip(nodes, x0, y0, x1, y1, 0, h >= w);
  }

  // Split off the head chunk (1–3 tiles), recurse on the remainder with flipped axis.
  const take = Math.min(nodes.length - 1, nodes.length >= 8 ? 3 : nodes.length >= 5 ? 2 : 1);
  const head = nodes.slice(0, take);
  const rest = nodes.slice(take);
  const total = nodes.reduce((sum, node) => sum + node.value, 0) || 1;
  const headValue = head.reduce((sum, node) => sum + node.value, 0);
  const headShare = headValue / total;

  if (vertical) {
    const cut = y0 + Math.max(12, Math.min(h - 12, h * headShare));
    return [
      ...layoutStrip(head, x0, y0, x1, cut, gap, false),
      ...layoutSliceDice(rest, x0, Math.min(cut + gap, y1), x1, y1, gap, false),
    ];
  }
  const cut = x0 + Math.max(12, Math.min(w - 12, w * headShare));
  return [
    ...layoutStrip(head, x0, y0, cut, y1, gap, true),
    ...layoutSliceDice(rest, Math.min(cut + gap, x1), y0, x1, y1, gap, true),
  ];
}

/**
 * Squarified (or variant) treemap over the full canvas.
 * Mobile can seed a different packing recipe so boards do not all look identical.
 */




/**
 * Cascade: near-square #1 in the top-left at its area share, then L-shaped
 * remainder packed with squarify so lower ranks sit right/bottom — and every
 * tile stays within the 16:9 aspect budget whenever geometry allows.
 */
function layoutCascadeBr(
  nodes: PanelNode[],
  width: number,
  height: number,
  padding: number,
): TreemapBox[] {
  const ordered = [...nodes].sort((a, b) => a.rank - b.rank || b.value - a.value);
  return packCascadeNearSquare(ordered, width, height, Math.max(0, padding), false);
}

function layoutCascadeRow(
  nodes: PanelNode[],
  width: number,
  height: number,
  padding: number,
): TreemapBox[] {
  const ordered = [...nodes].sort((a, b) => a.rank - b.rank || b.value - a.value);
  return packCascadeNearSquare(ordered, width, height, Math.max(0, padding), true);
}

function clampTileAspect(w: number, h: number, area: number): { w: number; h: number } {
  let tw = Math.max(8, w);
  let th = Math.max(8, h);
  const aspect = Math.max(tw / th, th / tw);
  if (aspect <= MAX_TILE_ASPECT) return { w: tw, h: th };
  // Rebuild from area with the max allowed aspect.
  if (tw >= th) {
    tw = Math.sqrt(Math.max(area, 1) * MAX_TILE_ASPECT);
    th = Math.max(area, 1) / tw;
  } else {
    th = Math.sqrt(Math.max(area, 1) * MAX_TILE_ASPECT);
    tw = Math.max(area, 1) / th;
  }
  return { w: Math.max(8, tw), h: Math.max(8, th) };
}

function packCascadeNearSquare(
  nodes: PanelNode[],
  width: number,
  height: number,
  gap: number,
  preferWideLead: boolean,
): TreemapBox[] {
  if (!nodes.length) return [];
  if (nodes.length === 1) {
    return [{ id: nodes[0]!.id, rank: nodes[0]!.rank, x0: 0, y0: 0, x1: width, y1: height }];
  }

  const total = nodes.reduce((sum, node) => sum + Math.max(node.value, 1e-9), 0) || 1;
  const lead = nodes[0]!;
  const rest = nodes.slice(1);
  const mapArea = Math.max(width * height, 1);
  const leadArea = mapArea * (lead.value / total);

  // Near-square lead, capped to 16:9 and to ~58% of each axis so the L remains usable.
  let side = Math.sqrt(leadArea);
  let leadW = side;
  let leadH = leadArea / Math.max(leadW, 1);
  if (preferWideLead) {
    leadW = Math.min(width * 0.58, Math.max(side, Math.sqrt(leadArea * 1.35)));
    leadH = leadArea / Math.max(leadW, 1);
  }
  ({ w: leadW, h: leadH } = clampTileAspect(leadW, leadH, leadArea));
  leadW = Math.min(leadW, Math.max(24, width * 0.58));
  leadH = Math.min(leadH, Math.max(24, height * 0.58));
  // Re-assert area after clamps.
  const areaNow = leadW * leadH;
  if (areaNow > 1e-6 && Math.abs(areaNow - leadArea) / leadArea > 0.08) {
    const scale = Math.sqrt(leadArea / areaNow);
    leadW *= scale;
    leadH *= scale;
    leadW = Math.min(leadW, width - 16);
    leadH = Math.min(leadH, height - 16);
    ({ w: leadW, h: leadH } = clampTileAspect(leadW, leadH, leadW * leadH));
    leadW = Math.min(leadW, width - 16);
    leadH = Math.min(leadH, height - 16);
  }

  const x1 = Math.min(width, Math.max(16, leadW));
  const y1 = Math.min(height, Math.max(16, leadH));
  const boxes: TreemapBox[] = [
    { id: lead.id, rank: lead.rank, x0: 0, y0: 0, x1, y1 },
  ];
  if (!rest.length) return boxes;

  const rightW = width - x1 - gap;
  const bottomH = height - y1 - gap;
  const restTotal = rest.reduce((sum, node) => sum + node.value, 0) || 1;

  if (rightW >= 28 && bottomH >= 28) {
    const rightArea = rightW * y1;
    const bottomArea = width * bottomH;
    const rightTarget = rightArea / Math.max(rightArea + bottomArea, 1);
    let acc = 0;
    let split = Math.max(1, Math.min(rest.length - 1, Math.ceil(rest.length * 0.4)));
    for (let i = 0; i < rest.length - 1; i++) {
      acc += rest[i]!.value / restTotal;
      if (acc >= rightTarget * 0.9) {
        split = i + 1;
        break;
      }
    }
    const rightNodes = rest.slice(0, split);
    const bottomNodes = rest.slice(split);
    boxes.push(...squarifyPanel(rightNodes, Math.min(x1 + gap, width), 0, width, y1, gap));
    if (bottomNodes.length) {
      boxes.push(...squarifyPanel(bottomNodes, 0, Math.min(y1 + gap, height), width, height, gap));
    }
    return boxes;
  }
  if (rightW >= 28) {
    boxes.push(...squarifyPanel(rest, Math.min(x1 + gap, width), 0, width, height, gap));
    return boxes;
  }
  boxes.push(...squarifyPanel(rest, 0, Math.min(y1 + gap, height), width, height, gap));
  return boxes;
}

function tileAspect(box: TreemapBox): number {
  const w = Math.max(box.x1 - box.x0, 1e-6);
  const h = Math.max(box.y1 - box.y0, 1e-6);
  return Math.max(w / h, h / w);
}

function worstTileAspect(boxes: TreemapBox[]): number {
  return boxes.reduce((worst, box) => Math.max(worst, tileAspect(box)), 1);
}

export function layoutHeatmapLeaves(
  items: HeatmapSizeInput[],
  width: number,
  height: number,
  padding = 2,
  options?: HeatmapLayoutOptions,
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
  nodes.sort((a, b) => b.value - a.value || a.rank - b.rank);

  const variant =
    options?.variant ??
    (options?.seed ? pickHeatmapLayoutVariant(options.seed) : "squarify");

  const pack = (): TreemapBox[] => {
    if (variant === "bands-top") {
      return layoutBandsTop(nodes, width, height, padding);
    }
    if (variant === "spine-left") {
      return layoutSpineLeft(nodes, width, height, padding);
    }
    if (variant === "slice-dice") {
      const ordered = [...nodes].sort((a, b) => a.rank - b.rank || b.value - a.value);
      return layoutSliceDice(ordered, 0, 0, width, height, Math.max(0, padding), height >= width);
    }
    if (variant === "cascade-br") {
      return layoutCascadeBr(nodes, width, height, padding);
    }
    if (variant === "cascade-row") {
      return layoutCascadeRow(nodes, width, height, padding);
    }
    return squarifyPanel(nodes, 0, 0, width, height, padding);
  };

  const packed = pack();
  if (!packed.length) return packed;
  if (worstTileAspect(packed) <= MAX_TILE_ASPECT + 0.12) return packed;
  // Variant produced strips beyond ~16:9 — fall back to squarify for readability.
  return squarifyPanel(nodes, 0, 0, width, height, padding);
}

/**
 * Continuous area shares for every tile.
 * Strict rank order: #1 ≥ #2 ≥ #3 ≥ … ≥ #N, summing to 1 (fills the map).
 * Soft-caps the leader (~18–24%) so #1 stays largest without swallowing the board.
 */
export function calculateHeatmapSizeRatios(items: HeatmapSizeInput[]): HeatmapSizeAllocation {
  const ratios = new Map<string, number>();
  if (!items.length) return { ratios, leftover: 0 };

  if (items.length === 1) {
    ratios.set(items[0]!.id, 1);
    return { ratios, leftover: 0 };
  }

  const ordered = items
    .map((item, index) => ({ item, index, rank: item.rank ?? index + 1 }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index);

  const n = ordered.length;
  const leader = maxLeaderShare(n);

  /**
   * Solve geometric ratio r so leader·(1−r^n)/(1−r) = 1 and each next tile is
   * smaller. Guarantees a full map with #1 pinned (15% on 8+ tile boards).
   */
  let lo = 0.5;
  let hi = 0.999;
  for (let iter = 0; iter < 40; iter++) {
    const mid = (lo + hi) / 2;
    const span = mid >= 0.999999 ? n : (1 - Math.pow(mid, n)) / (1 - mid);
    if (leader * span > 1) hi = mid;
    else lo = mid;
  }
  const ratio = lo;
  let values = Array.from({ length: n }, (_, index) => leader * Math.pow(ratio, index));
  values = renormalize(values);
  // Re-assert #1 target after float drift, then keep strict descent.
  const scale = leader / values[0]!;
  values = values.map((value) => value * scale);
  values = renormalize(enforceStrictDescending(values, Math.min(0.98, ratio + 0.02)));
  // Prefer exact leader on dense boards; accept tiny float error elsewhere.
  if (n >= 8) {
    values[0] = leader;
    const rest = values.slice(1);
    const restSum = rest.reduce((sum, value) => sum + value, 0) || 1;
    values = [leader, ...rest.map((value) => (value / restSum) * (1 - leader))];
    values = enforceStrictDescending(values, 0.995);
    values[0] = leader;
    const rest2 = values.slice(1);
    const restSum2 = rest2.reduce((sum, value) => sum + value, 0) || 1;
    values = [leader, ...rest2.map((value) => (value / restSum2) * (1 - leader))];
  }

  // Mild score/name texture that cannot flip order.
  const peak = Math.max(...ordered.map(({ item }) => safeScore(item.score)), 1);
  values = values.map((value, index) => {
    const item = ordered[index]!.item;
    const scoreNorm = Math.min(1, safeScore(item.score) / peak);
    const scoreAssist = 0.97 + 0.03 * Math.pow(scoreNorm, 0.9);
    const nameAssist = Math.min(1.04, readabilityAreaBoost(item.name));
    return value * scoreAssist * nameAssist;
  });
  values = renormalize(enforceStrictDescending(values, 0.995));
  if (n >= 8) {
    values[0] = leader;
    const rest = values.slice(1);
    const restSum = rest.reduce((sum, value) => sum + value, 0) || 1;
    values = [leader, ...rest.map((value) => (value / restSum) * (1 - leader))];
    values = enforceStrictDescending(values, 0.995);
    values[0] = leader;
    const rest2 = values.slice(1);
    const restSum2 = rest2.reduce((sum, value) => sum + value, 0) || 1;
    values = [leader, ...rest2.map((value) => (value / restSum2) * (1 - leader))];
  }


  // Keep the last tiles paintable on dense boards (≥ ~1.8%).
  if (n >= 12) {
    const floor = n >= 18 ? 0.018 : 0.02;
    for (let i = values.length - 1; i >= 1; i--) {
      if (values[i]! >= floor) continue;
      let need = floor - values[i]!;
      values[i] = floor;
      for (let j = i - 1; j >= 1 && need > 1e-10; j--) {
        const minKeep = Math.max(floor, values[j + 1]!);
        const give = Math.min(need, Math.max(0, values[j]! - minKeep));
        if (give <= 0) continue;
        values[j] = values[j]! - give;
        need -= give;
      }
    }
    values = enforceStrictDescending(values, 0.995);
    if (n >= 8) {
      values[0] = leader;
      const rest = values.slice(1);
      const restSum = rest.reduce((sum, value) => sum + value, 0) || 1;
      values = [leader, ...rest.map((value) => (value / restSum) * (1 - leader))];
      values = enforceStrictDescending(values, 0.995);
      values[0] = leader;
      const rest2 = values.slice(1);
      const restSum2 = rest2.reduce((sum, value) => sum + value, 0) || 1;
      values = [leader, ...rest2.map((value) => (value / restSum2) * (1 - leader))];
    }
  }

  ordered.forEach(({ item }, index) => {

    ratios.set(item.id, values[index] ?? 0);
  });
  const used = [...ratios.values()].reduce((sum, value) => sum + value, 0);
  return { ratios, leftover: Math.max(0, 1 - used) };
}


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
