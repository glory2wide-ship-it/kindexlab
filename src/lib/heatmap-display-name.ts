import { isTwoLineBracketHeatmap } from "@/lib/boards/culture-grants";
import { heatmapNameLines } from "@/lib/musicTitle";
import { parseBracketLabel } from "@/lib/politics/labeled-rank";
import type { RankingEntity } from "@/lib/types";

/**
 * UI-only heatmap tile labels.
 *
 * Never mutate `entity.name` — briefing / 오늘의 분석 / magazine pipelines keep
 * the canonical subject. Paint the full on-screen name (no ticker shortening).
 */

function compactSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Optional helper kept for scripts / non-tile surfaces that still want a trim.
 * Heatmap tiles themselves use the full `entity.name`.
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
  /** Full primary line painted on the tile (canonical name). */
  title: string;
  /** Optional secondary (org / artist / price) — layout may hide on small tiles. */
  secondary?: string;
  /** Canonical name for accessibility / hover. */
  fullName: string;
}

/**
 * Build the treemap paint label from an entity without touching generation keywords.
 * Title is the full entity name — no ticker-style shortening.
 */
export function heatmapTileLabel(
  entity: Pick<RankingEntity, "name" | "nameEn" | "type" | "heatmapGroup">,
): HeatmapTileLabel {
  const fullName = entity.name;
  const lines = heatmapNameLines(entity);
  const bracket = parseBracketLabel(entity.name);

  // Grant / region boards: full name on the tile; org as optional secondary meta.
  if (bracket && isTwoLineBracketHeatmap(entity.heatmapGroup)) {
    return {
      title: fullName,
      secondary: bracket.org || undefined,
      fullName,
    };
  }

  if (bracket && (entity.type === "local_policy" || entity.type === "subsidy")) {
    return {
      title: fullName,
      secondary: bracket.org ? `[${bracket.org}]` : undefined,
      fullName,
    };
  }

  return {
    title: fullName,
    secondary: lines.artist && lines.artist !== fullName ? lines.artist : undefined,
    fullName,
  };
}

/** Character count used for density sizing (spaces ignored — Hangul density). */
export function heatmapLabelCharCount(label: string): number {
  return label.replace(/\s+/g, "").length || 1;
}

/**
 * Display length including spaces and symbols — used to decide multi-line wrap
 * (6+ → 2 lines or more so type can stay larger).
 */
export function heatmapLabelDisplayLength(label: string): number {
  return label.length || 1;
}
