import { heatmapLabelCharCount } from "@/lib/heatmap-display-name";

const MIN_NAME = 11;
const MAX_NAME = 26;
const MIN_RATE = 12;
const MAX_RATE = 18;
const MIN_ARTIST = 10;
const MAX_ARTIST = 14;
const NAME_LINE_HEIGHT = 1.16;

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
 * Prefer one clean line for Hangul. Two lines only when the tile is roomy and
 * the (already shortened) label is still long.
 */
function maxLinesForTile(width: number, height: number, charCount: number): number {
  if (charCount >= 8 && height >= 56 && width >= 72) return 2;
  return 1;
}

/**
 * Stable Hangul density sizing — not Finviz "fill the cell" maximization.
 *
 * Similar character counts → similar pt across tiles; box height still caps
 * the type so short labels stay tidy instead of exploding to fill the cell.
 */
function densityNameSize(input: {
  text: string;
  innerW: number;
  innerH: number;
  omitRate: boolean;
}): { size: number; lines: number; maxLines: number } {
  const chars = heatmapLabelCharCount(input.text);
  const maxLines = maxLinesForTile(input.innerW + 12, input.innerH + 12, chars);

  // Character-aware width budget (Hangul ≈ square em).
  const perChar = input.innerW / Math.max(chars, 1);
  let size = perChar * (chars <= 3 ? 0.96 : chars <= 5 ? 0.9 : chars <= 8 ? 0.86 : 0.8);

  // Short Hangul gets more of the vertical budget; tiny tiles need room too.
  const heightShare =
    chars <= 3 ? (input.omitRate ? 0.55 : 0.5) : input.omitRate ? 0.46 : 0.38;
  const heightCap = input.innerH * heightShare;
  const shortBoost = chars <= 4 ? 1.04 : chars >= 11 ? 0.92 : 1;
  size *= shortBoost;

  // Adaptive floor: demand MIN_NAME only when the cell can actually hold it.
  const floor = Math.min(MIN_NAME, Math.max(8.5, heightCap * 0.92));
  const ceiling = Math.max(floor, Math.min(MAX_NAME, heightCap));
  size = clamp(size, floor, ceiling);

  if (maxLines === 2) size *= 0.88;

  size = fitWrappedSize(input.text, size, input.innerW, floor, maxLines);
  let lines = Math.min(maxLines, wrapLineCount(input.text, size, input.innerW));
  while (size > floor && nameBlockHeight(size, lines) > input.innerH * 0.92) {
    size -= 0.3;
    lines = Math.min(maxLines, wrapLineCount(input.text, size, input.innerW));
  }
  return {
    size,
    lines: Math.min(maxLines, wrapLineCount(input.text, size, input.innerW)),
    maxLines,
  };
}

/**
 * Hangul-first treemap label: short names stay tidy; size follows density and
 * box geometry without overfilling the cell like Latin tickers on Finviz.
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
  const rateBudget = showRate ? Math.min(MAX_RATE + 2, innerH * 0.2) : 0;
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
  const nameH = () =>
    nameBlockHeight(nameSize, Math.min(maxLines, wrapLineCount(name, nameSize, innerW)));
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

  const fittedLines = Math.min(maxLines, wrapLineCount(name, nameSize, innerW));
  const displayName =
    fittedLines === 1 && wrapLineCount(name, nameSize, innerW) > 1
      ? ellipsize(name, nameSize, innerW)
      : name;
  const displayArtist = usedArtist && artist ? ellipsize(artist, artistSize, innerW) : "";
  const displayRate = usedRate ? ellipsize(rateText, rateSize, innerW) : "";
  const mid = y + h / 2 + 1;
  const finalNameBlock = nameBlockHeight(nameSize, fittedLines);
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
    nameLines: fittedLines,
    padX,
    padY: 4,
    nameY: Math.round(nameY * 10) / 10,
    rateY: Math.round(rateY * 10) / 10,
    typeY: Math.round(rateY * 10) / 10,
    metaY: Math.round(artistY * 10) / 10,
  };
}
