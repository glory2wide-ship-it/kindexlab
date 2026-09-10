/**
 * UI-only heatmap tile labels.
 *
 * Never mutate `entity.name` — briefing / 오늘의 분석 / magazine pipelines keep
 * the canonical subject. Tiles strip leading `[qualifier]` so only the subject
 * paints; wrap/size use the stripped display string.
 */

import { heatmapNameLines } from "@/lib/musicTitle";
import { parseBracketLabel } from "@/lib/politics/labeled-rank";
import type { RankingEntity } from "@/lib/types";

function compactSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Paint-only: drop leading `[qualifier]` (mirrors `stripRowQualifier`). */
function stripBracketQualifier(name: string): string {
  const match = name.trim().match(/^\[[^\]]+\]\s*(.+)$/);
  return match?.[1]?.trim() || name.trim();
}

/**
 * Optional helper kept for scripts / non-tile surfaces that still want a trim.
 * Heatmap tiles themselves use the stripped subject name.
 */
export function shortenHeatmapLabel(raw: string, maxChars = 12): string {
  const text = compactSpaces(raw);
  if (text.length <= maxChars) return text;
  const window = text.slice(0, maxChars + 1);
  const breakAt = Math.max(
    window.lastIndexOf(" "),
    window.lastIndexOf("·"),
    window.lastIndexOf("/"),
    window.lastIndexOf("-"),
  );
  if (breakAt >= Math.floor(maxChars * 0.55)) {
    return compactSpaces(text.slice(0, breakAt));
  }
  return text.slice(0, maxChars);
}

export interface HeatmapTileLabel {
  /** Primary line painted on the tile (brackets stripped). */
  title: string;
  /** Optional secondary (artist / price) — layout may hide on small tiles. */
  secondary?: string;
  /** Canonical name for accessibility / hover. */
  fullName: string;
}

/**
 * Build the treemap paint label from an entity without touching generation keywords.
 * Leading `[기관·지역]` qualifiers are removed for paint only.
 */
export function heatmapTileLabel(
  entity: Pick<RankingEntity, "name" | "nameEn" | "type" | "heatmapGroup">,
): HeatmapTileLabel {
  const fullName = entity.name;
  const title = stripBracketQualifier(fullName) || compactSpaces(fullName);
  const lines = heatmapNameLines(entity);
  const bracket = parseBracketLabel(entity.name);

  // Artist / price-style secondary only — never re-print the stripped org/region.
  const artist =
    lines.artist && lines.artist !== fullName && lines.artist !== title && !bracket
      ? lines.artist
      : undefined;

  return {
    title,
    secondary: artist,
    fullName,
  };
}

/** Character count used for density sizing (spaces ignored — Hangul density). */
export function heatmapLabelCharCount(label: string): number {
  return label.replace(/\s+/g, "").length || 1;
}

/**
 * Display length including spaces and symbols — used to decide multi-line wrap
 * (10+ → 2 lines or more so type can stay larger).
 */
export function heatmapLabelDisplayLength(label: string): number {
  return label.length || 1;
}

/** Soft-wrap threshold: spaces and symbols count. */
export const HEATMAP_WRAP_MIN_CHARS = 10;
