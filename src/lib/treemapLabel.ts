import {
  heatmapLabelCharCount,
  heatmapLabelDisplayLength,
} from "@/lib/heatmap-display-name";

const MIN_NAME = 11;
const MAX_NAME = 28;
const MIN_RATE = 12;
const MAX_RATE = 18;
const MIN_ARTIST = 10;
const MAX_ARTIST = 14;
const NAME_LINE_HEIGHT = 1.14;

export interface TreemapLabelLayout {
  showName: boolean;
  showRate: boolean;
  showType: boolean;
  showMeta: boolean;
  name: string;
  rate: string;
  nameSize: number;
  rateSize: number;
  typeSize: number;
  metaSize: number;
  nameLines: number;
  padX: number;
  padY: number;
  nameY: number;
  rateY: number;
  typeY: number;
  metaY: number;
  meta: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function measureTextWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const char of text) {
    if (char === "." || char === "%" || char === " " || char === "+" || char === "-") {
      units += 0.48;
    } else if (/[0-9]/.test(char)) {
      units += 0.62;
    } else if (/[A-Za-z]/.test(char)) {
      units += 0.64;
    } else if (char === "·") {
      units += 0.4;
    } else {
      units += 0.98;
    }
  }
  return units * fontSize;
}

function wrapLineCount(text: string, fontSize: number, maxWidth: number): number {
  const width = measureTextWidth(text, fontSize);
  if (width <= maxWidth) return 1;
  return Math.ceil(width / Math.max(8, maxWidth));
}

function fitSizeToWidth(text: string, size: number, maxWidth: number, min: number): number {
  let next = size;
  while (next > min && measureTextWidth(text, next) > maxWidth) {
    next -= 0.3;
  }
  return next;
}

function fitWrappedSize(text: string, start: number, maxWidth: number, min: number, maxLines: number): number {
  let next = start;
  while (next > min && wrapLineCount(text, next, maxWidth) > maxLines) {
    next -= 0.3;
  }
  return next;
}

function ellipsize(text: string, fontSize: number, maxWidth: number): string {
  if (measureTextWidth(text, fontSize) <= maxWidth) return text;
  const ellipsis = "…";
  let cut = text.length;
  while (cut > 1 && measureTextWidth(text.slice(0, cut) + ellipsis, fontSize) > maxWidth) {
    cut -= 1;
  }
  return cut <= 1 ? ellipsis : `${text.slice(0, cut)}${ellipsis}`;
}

function nameBlockHeight(size: number, lines: number): number {
  if (lines <= 1) return size;
  return size * (1 + (lines - 1) * NAME_LINE_HEIGHT);
}

/**
 * Names with 6+ characters (spaces/symbols included) wrap to 2+ lines so type
 * can stay larger. Very long titles may use a third line when the tile allows.
 */
function maxLinesForTile(width: number, height: number, displayLen: number): number {
  if (displayLen < 6) return 1;
  if (displayLen >= 16 && height >= 64 && width >= 70) return 3;
  if (height >= 36 && width >= 44) return 2;
  return 1;
}

/**
 * Insert soft line breaks so names with 6+ characters (spaces/symbols included)
 * paint on 2+ lines and can keep a larger type size.
 */
export function softWrapHeatmapName(name: string, maxLines = 2): string {
  const text = name.replace(/\s+/g, " ").trim();
  if (text.length < 6 || maxLines < 2) return text;

  const linesWanted = text.length >= 16 && maxLines >= 3 ? 3 : 2;
  // Prefer existing spaces / punctuation as break points.
  const softBreaks: number[] = [];
  for (let i = 1; i < text.length - 1; i++) {
    const ch = text[i]!;
    if (ch === " " || ch === "·" || ch === "/" || ch === "-" || ch === "·") softBreaks.push(i);
  }

  if (linesWanted === 2) {
    const mid = Math.ceil(text.length / 2);
    const atSpace = softBreaks.reduce(
      (best, index) => (Math.abs(index - mid) < Math.abs(best - mid) ? index : best),
      softBreaks[0] ?? mid,
    );
    if (softBreaks.length && Math.abs(atSpace - mid) <= Math.max(3, Math.floor(text.length * 0.35))) {
      return `${text.slice(0, atSpace).trim()}\n${text.slice(atSpace).trim()}`;
    }
    return `${text.slice(0, mid)}\n${text.slice(mid)}`;
  }

  const third = Math.ceil(text.length / 3);
  return `${text.slice(0, third)}\n${text.slice(third, third * 2)}\n${text.slice(third * 2)}`;
}

/**
 * Density sizing with forced multi-line for long names — wrapping shortens each
 * line so the font can grow instead of shrinking to fit one row.
 */
function densityNameSize(input: {
  text: string;
  innerW: number;
  innerH: number;
  omitRate: boolean;
}): { size: number; lines: number; maxLines: number } {
  const displayLen = heatmapLabelDisplayLength(input.text);
  const chars = heatmapLabelCharCount(input.text);
  const maxLines = maxLinesForTile(input.innerW + 12, input.innerH + 12, displayLen);

  // When wrapping, size against chars-per-line so long names stay large.
  const perLineChars = Math.max(1, Math.ceil(chars / maxLines));
  const perChar = input.innerW / perLineChars;
  let size = perChar * (perLineChars <= 3 ? 0.94 : perLineChars <= 5 ? 0.9 : 0.84);

  const heightShare =
    maxLines >= 2
      ? input.omitRate
        ? 0.58
        : 0.5
      : chars <= 3
        ? input.omitRate
          ? 0.55
          : 0.5
        : input.omitRate
          ? 0.46
          : 0.38;
  const heightCap = input.innerH * heightShare;
  const shortBoost = chars <= 4 && maxLines === 1 ? 1.04 : 1;
  size *= shortBoost;

  const floor = Math.min(MIN_NAME, Math.max(8.5, heightCap * 0.9));
  const ceiling = Math.max(floor, Math.min(MAX_NAME, heightCap));
  size = clamp(size, floor, ceiling);

  // Multi-line long names: nudge size up — wrapping already frees width.
  if (maxLines >= 2 && displayLen >= 6) {
    size = Math.min(ceiling, size * 1.12);
  }

  // Measure against the longest soft-wrapped line so type can grow.
  const wrapped = softWrapHeatmapName(input.text, maxLines);
  const longestLine = wrapped
    .split("\n")
    .reduce((best, line) => (line.length > best.length ? line : best), "");
  size = fitSizeToWidth(longestLine || input.text, size, input.innerW, floor);

  let lines = Math.min(maxLines, Math.max(1, wrapped.split("\n").length));
  while (size > floor && nameBlockHeight(size, lines) > input.innerH * 0.92) {
    size -= 0.3;
  }
  return { size, lines, maxLines };
}

/**
 * Hangul-first treemap label: full names wrap at 6+ chars; size follows density
 * and box geometry without ticker-style clipping.
 */
export function layoutTreemapLabel(input: {
  width: number;
  height: number;
  y: number;
  name: string;
  rate: string;
  typeLabel: string;
  rank?: string;
  heatmapRank?: number;
  omitRate?: boolean;
  artist?: string;
  metaLabel?: string;
  forceType?: boolean;
}): TreemapLabelLayout | null {
  const { width: w, height: h, y, name, rate, typeLabel, artist, omitRate } = input;
  if (w < 28 || h < 18) return null;

  const padX = w >= 100 ? 10 : 6;
  const padY = h >= 90 ? 12 : h >= 56 ? 9 : 6;
  const innerW = Math.max(12, w - padX * 2);
  const innerH = Math.max(12, h - padY * 2);

  const showRate = !omitRate && h >= 34;
  const rateBudget = showRate ? Math.min(MAX_RATE + 2, innerH * 0.18) : 0;
  const nameBudget = Math.max(MIN_NAME, innerH - (showRate ? rateBudget + 3 : 0));

  const fitted = densityNameSize({
    text: name,
    innerW,
    innerH: nameBudget,
    omitRate: Boolean(omitRate),
  });
  let nameSize = fitted.size;
  const maxLines = fitted.maxLines;

  const combine = Boolean(typeLabel) && w >= 88 && h >= 56;
  const rateText = combine ? `${rate}  ${typeLabel}` : rate;
  let rateSize = showRate ? clamp(Math.min(nameSize * 0.5, 16), MIN_RATE, MAX_RATE) : 0;
  if (showRate) rateSize = fitSizeToWidth(rateText, rateSize, innerW, MIN_RATE);

  const showArtist = Boolean(artist) && w >= 80 && h >= 78;
  let artistSize = 0;
  if (showArtist && artist) {
    artistSize = clamp(nameSize * 0.48, MIN_ARTIST, MAX_ARTIST);
    artistSize = fitSizeToWidth(artist, artistSize, innerW, MIN_ARTIST);
  }

  const gap = 3;
  let usedArtist = showArtist;
  let usedRate = showRate;
  const wrappedName = softWrapHeatmapName(name, maxLines);
  const wrappedLines = Math.max(1, wrappedName.split("\n").length);
  const nameH = () => nameBlockHeight(nameSize, Math.min(maxLines, wrappedLines));
  let stack = nameH();
  if (usedArtist) stack += gap + artistSize;
  if (usedRate) stack += gap + rateSize;

  if (stack > innerH && usedArtist) {
    usedArtist = false;
    artistSize = 0;
    stack = nameH() + (usedRate ? gap + rateSize : 0);
  }
  if (stack > innerH && usedRate) {
    const leftover = innerH - nameH() - gap;
    if (leftover < MIN_RATE) {
      usedRate = false;
      rateSize = 0;
    } else {
      rateSize = Math.min(rateSize, leftover);
      stack = nameH() + gap + rateSize;
    }
  }

  const nameFloor = Math.min(MIN_NAME, Math.max(8.5, nameBudget * 0.28));
  while (stack > innerH && nameSize > nameFloor) {
    nameSize -= 0.3;
    stack = nameH();
    if (usedArtist) stack += gap + artistSize;
    if (usedRate) stack += gap + rateSize;
  }

  const fittedLines = Math.min(maxLines, wrappedLines);
  const longest = wrappedName.split("\n").reduce((best, line) =>
    measureTextWidth(line, nameSize) > measureTextWidth(best, nameSize) ? line : best,
  "");
  const displayName =
    measureTextWidth(longest, nameSize) > innerW
      ? wrappedName
          .split("\n")
          .map((line) => ellipsize(line, nameSize, innerW))
          .join("\n")
      : wrappedName;
  const displayArtist = usedArtist && artist ? ellipsize(artist, artistSize, innerW) : "";
  const displayRate = usedRate ? ellipsize(rateText, rateSize, innerW) : "";
  const mid = y + h / 2 + 1;
  const finalNameBlock = nameBlockHeight(nameSize, Math.max(1, fittedLines));
  let finalStack = finalNameBlock;
  if (usedArtist) finalStack += gap + artistSize;
  if (usedRate) finalStack += gap + rateSize;
  let cursor = mid - finalStack / 2;
  const nameY = cursor + nameSize * 0.82;
  cursor += finalNameBlock;
  let artistY = 0;
  if (usedArtist) {
    cursor += gap;
    artistY = cursor + artistSize * 0.82;
    cursor += artistSize;
  }
  let rateY = nameY;
  if (usedRate) {
    cursor += gap;
    rateY = cursor + rateSize * 0.82;
  }

  return {
    showName: true,
    showRate: usedRate,
    showType: combine,
    showMeta: usedArtist,
    name: displayName,
    rate: displayRate,
    meta: displayArtist,
    nameSize: Math.round(nameSize * 10) / 10,
    rateSize: Math.round(rateSize * 10) / 10,
    typeSize: Math.round(rateSize * 10) / 10,
    metaSize: Math.round(artistSize * 10) / 10,
    nameLines: Math.max(1, fittedLines),
    padX,
    padY: 4,
    nameY: Math.round(nameY * 10) / 10,
    rateY: Math.round(rateY * 10) / 10,
    typeY: Math.round(rateY * 10) / 10,
    metaY: Math.round(artistY * 10) / 10,
  };
}
