import type { BoardRankEntry } from "@/lib/boards/types";

/** Rows from a board ranking or live heatmap tiles. */
export type BoardIndexSource = {
  rank?: number;
  score?: number;
  changeRate?: number;
  buzzScore?: number;
  fluctuationRate?: number;
};

const TOP_N = 25;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/** Stable 0..1 from a board slug (and optional salt). */
export function boardSeedUnit(slug: string, salt = ""): number {
  const input = `${slug}:${salt}`;
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0) / 4294967296;
}

/** Per-menu mock tone so identical fallback curves do not collapse to one average. */
export function boardIndexTone(slug: string): { multiplier: number; changeBias: number; wave: number } {
  const unit = boardSeedUnit(slug);
  return {
    multiplier: 0.84 + unit * 0.32,
    changeBias: (boardSeedUnit(slug, "bias") - 0.5) * 5.4,
    wave: 0.28 + boardSeedUnit(slug, "wave") * 1.15,
  };
}

export function isHeatmapEntityRow(row: BoardIndexSource): boolean {
  return Number.isFinite(row.buzzScore) && (row.buzzScore ?? 0) > 100;
}

export function sourceScore(row: BoardIndexSource): number {
  if (isHeatmapEntityRow(row)) return Number((((row.buzzScore ?? 0) as number) / 10).toFixed(2));
  if (Number.isFinite(row.score) && (row.score ?? 0) > 0) return Number(row.score);
  return 12;
}

export function sourceChange(row: BoardIndexSource): number {
  if (isHeatmapEntityRow(row)) {
    return Number.isFinite(row.fluctuationRate) ? Number(row.fluctuationRate) : 0;
  }
  return Number.isFinite(row.changeRate) ? Number(row.changeRate) : 0;
}

/** Apply menu-specific tone to a raw ranking row (not already-scaled heatmap entities). */
export function toneRankEntry(row: BoardRankEntry, slug: string): BoardRankEntry {
  const tone = boardIndexTone(slug);
  const rank = Number.isFinite(row.rank) && (row.rank ?? 0) > 0 ? Number(row.rank) : 1;
  const wobble = Math.sin(rank * tone.wave + boardSeedUnit(slug) * Math.PI * 2) * 3.6;
  const score = clamp(sourceScore(row) * tone.multiplier + wobble, 8, 99.9);
  const changeScale = 0.62 + boardSeedUnit(slug, "chg") * 0.9;
  const change = clamp(
    sourceChange(row) * changeScale + tone.changeBias * Math.max(0.35, 1 - (rank - 1) * 0.028),
    -15,
    15,
  );
  return {
    ...row,
    score: round2(score),
    changeRate: round2(change),
  };
}

function prepareRows(rows: BoardIndexSource[] | undefined, slug: string): BoardRankEntry[] {
  return (rows ?? []).map((row, index) => {
    const rank = Number.isFinite(row.rank) && (row.rank ?? 0) > 0 ? Number(row.rank) : index + 1;
    if (isHeatmapEntityRow(row)) {
      return {
        rank,
        name: "",
        note: "",
        score: sourceScore(row),
        changeRate: sourceChange(row),
      };
    }
    return toneRankEntry(
      {
        rank,
        name: "",
        note: "",
        score: sourceScore(row),
        changeRate: sourceChange(row),
      },
      slug,
    );
  });
}

/**
 * Menu index = rank-weighted average of the top N items on that board.
 * Heatmap entities are used as-is (already toned); raw ranking rows are toned by slug.
 */
export function computeBoardIndex(
  rows: BoardIndexSource[] | undefined,
  slug: string,
): { value: number; changeRate: number } {
  const prepared = prepareRows(rows, slug)
    .filter((row) => Number.isFinite(row.score))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, TOP_N);

  if (!prepared.length) {
    const unit = boardSeedUnit(slug);
    return {
      value: round2(46 + unit * 36),
      changeRate: round2((boardSeedUnit(slug, "empty") - 0.5) * 6.2),
    };
  }

  let weightSum = 0;
  let scoreSum = 0;
  let changeSum = 0;
  prepared.forEach((row, index) => {
    const weight = prepared.length - index;
    scoreSum += row.score * weight;
    changeSum += row.changeRate * weight;
    weightSum += weight;
  });

  return {
    value: round2(scoreSum / weightSum),
    changeRate: round2(changeSum / weightSum),
  };
}
