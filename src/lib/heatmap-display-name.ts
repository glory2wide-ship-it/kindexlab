import { isTwoLineBracketHeatmap } from "@/lib/boards/culture-grants";
import { heatmapNameLines } from "@/lib/musicTitle";
import { parseBracketLabel } from "@/lib/politics/labeled-rank";
import type { RankingEntity } from "@/lib/types";

/**
 * UI-only heatmap tile labels.
 *
 * Never mutate `entity.name` — briefing / 오늘의 분석 / magazine pipelines keep
 * the canonical subject. These helpers only shorten what the treemap paints.
 */

const MAX_PRIMARY_CHARS = 12;
const PREFERRED_PRIMARY_CHARS = 10;

function compactSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Drop marketing / season wrappers that bloat tiles without adding identity. */
function stripNoisePrefix(value: string): string {
  return compactSpaces(
    value
      .replace(/^\[[^\]]{1,24}\]\s*/g, "")
      .replace(/\s*\[[^\]]{4,}\]\s*$/g, "")
      .replace(/^[\(（][^)）]{1,20}[\)）]\s*/g, "")
      .replace(/^20\d{2}\s*(년\s*)?/g, "")
      .replace(/^(라스트\s*)?얼리버드\s*/gi, "")
      .replace(/^뮤지컬\s*[〈<\[]\s*/g, "")
      .replace(/^연극\s*[〈<\[]\s*/g, "")
      .replace(/^콘서트\s*[〈<\[]\s*/g, "")
      .replace(/^전시\s*[〈<\[]\s*/g, "")
      .replace(/^[〈《「『"“']+/g, "")
      .replace(/[〉》」』"”']+$/g, ""),
  );
}

/** Prefer 1–2 English tokens over a single cryptic first word. */
function shortenLatinLabel(text: string, maxChars: number): string | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9\s\-'.&]+$/.test(text)) return null;
  const words = text.split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return null;
  if (words.length === 1) return words[0].slice(0, maxChars);
  const two = `${words[0]} ${words[1]}`;
  if (two.length <= maxChars + 2) return two.slice(0, maxChars + 2).trim();
  return words[0].slice(0, maxChars);
}

function stripTrailingVenue(value: string): string {
  return compactSpaces(
    value
      .replace(/\s*[-–—]\s*(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주).*$/u, "")
      .replace(/\s+in\s+[A-Za-z].*$/i, ""),
  );
}

/**
 * Prefer a clean Hangul/core phrase under ~10–12 chars.
 * Word-aware trim — never cut mid-syllable (Hangul is already one char).
 */
export function shortenHeatmapLabel(raw: string, maxChars = MAX_PRIMARY_CHARS): string {
  let text = stripTrailingVenue(stripNoisePrefix(raw));
  if (!text) text = compactSpaces(raw);
  if (text.length <= maxChars) return text;

  const latin = shortenLatinLabel(text, maxChars);
  if (latin) return latin;

  // Prefer cutting at space / middle-dot / slash before hard trim.
  const soft = Math.min(PREFERRED_PRIMARY_CHARS, maxChars);
  const window = text.slice(0, maxChars + 1);
  const breakAt = Math.max(
    window.lastIndexOf(" "),
    window.lastIndexOf("·"),
    window.lastIndexOf("/"),
    window.lastIndexOf("-"),
  );
  if (breakAt >= Math.floor(soft * 0.55)) {
    return compactSpaces(text.slice(0, breakAt));
  }
  return text.slice(0, maxChars);
}

export interface HeatmapTileLabel {
  /** Short primary line painted on the tile. */
  title: string;
  /** Optional secondary (org / artist / price) — layout may hide on small tiles. */
  secondary?: string;
  /** Canonical name for accessibility / hover — never shortened. */
  fullName: string;
}

/**
 * Build the treemap paint label from an entity without touching generation keywords.
 */
export function heatmapTileLabel(
  entity: Pick<RankingEntity, "name" | "nameEn" | "type" | "heatmapGroup">,
): HeatmapTileLabel {
  const fullName = entity.name;
  const lines = heatmapNameLines(entity);
  const bracket = parseBracketLabel(entity.name);

  // Two-line grant / region boards: keep subject short, org as secondary.
  if (bracket && isTwoLineBracketHeatmap(entity.heatmapGroup)) {
    return {
      title: shortenHeatmapLabel(bracket.subject, PREFERRED_PRIMARY_CHARS),
      secondary: shortenHeatmapLabel(bracket.org, 10),
      fullName,
    };
  }

  if (bracket && (entity.type === "local_policy" || entity.type === "subsidy")) {
    return {
      title: shortenHeatmapLabel(bracket.subject, PREFERRED_PRIMARY_CHARS),
      secondary: bracket.org ? `[${shortenHeatmapLabel(bracket.org, 8)}]` : undefined,
      fullName,
    };
  }

  const primary = shortenHeatmapLabel(lines.title || fullName, MAX_PRIMARY_CHARS);
  const secondary =
    lines.artist && lines.artist.length <= 16
      ? shortenHeatmapLabel(lines.artist, 12)
      : lines.artist
        ? shortenHeatmapLabel(lines.artist, 10)
        : undefined;

  return {
    title: primary || shortenHeatmapLabel(fullName),
    secondary,
    fullName,
  };
}

/** Character count used for density-based type sizing (spaces ignored). */
export function heatmapLabelCharCount(label: string): number {
  return label.replace(/\s+/g, "").length || 1;
}
