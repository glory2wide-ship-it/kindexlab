const MIN_NAME = 11;
const MAX_NAME = 34;
const MIN_RATE = 12;
const MAX_RATE = 20;
const MIN_ARTIST = 11;
const MAX_ARTIST = 16;
const NAME_LINE_HEIGHT = 1.18;

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
    next -= 0.35;
  }
  return next;
}

function fitWrappedSize(text: string, start: number, maxWidth: number, min: number, maxLines: number): number {
  let next = start;
  while (next > min && wrapLineCount(text, next, maxWidth) > maxLines) {
    next -= 0.35;
  }
  return next;
}

/**
 * Grow toward the largest size that still fits width/height — Finviz fills the
 * cell with ticker text rather than leaving a small caption in the middle.
 */
function maximizeReadableNameSize(
  text: string,
  maxWidth: number,
  maxHeight: number,
  min: number,
  max: number,
  maxLines: number,
): { size: number; lines: number } {
  let lo = min;
  let hi = max;
  let best = min;
  let bestLines = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const lines = Math.min(maxLines, wrapLineCount(text, mid, maxWidth));
    const block = nameBlockHeight(mid, lines);
    const fitsWidth = wrapLineCount(text, mid, maxWidth) <= maxLines;
    const fitsHeight = block <= maxHeight + 0.5;
    if (fitsWidth && fitsHeight) {
      best = mid;
      bestLines = lines;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  // Final safety pass if binary search landed slightly over.
  best = fitWrappedSize(text, best, maxWidth, min, maxLines);
  bestLines = Math.min(maxLines, wrapLineCount(text, best, maxWidth));
  while (best > min && nameBlockHeight(best, bestLines) > maxHeight) {
    best -= 0.35;
    bestLines = Math.min(maxLines, wrapLineCount(text, best, maxWidth));
  }
  return { size: best, lines: bestLines };
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

function maxLinesForTile(width: number, height: number): number {
  if (height >= 48 && width >= 56) return 2;
  return 1;
}

/**
 * Finviz-style label: name size tracks tile area so the ticker stays readable.
 * Larger boxes get larger type; small boxes shrink/ellipsize rather than clip.
 */
export function layoutTreemapLabel(input: {
  width: number;
  height: number;
  y: number;
  name: string;
  rate: string;
  typeLabel: string;
  rank?: string;
  /** Display rank on the heatmap (1-based). Reserved for callers; size follows the box. */
  heatmapRank?: number;
  /** Skip ±% so the name can use the full tile (mobile ranks 8+). */
  omitRate?: boolean;
  artist?: string;
  metaLabel?: string;
  forceType?: boolean;
}): TreemapLabelLayout | null {
  const { width: w, height: h, y, name, rate, typeLabel, artist, omitRate } = input;
  if (w < 28 || h < 18) return null;

  const padX = w >= 100 ? 10 : 6;
  const padY = h >= 90 ? 14 : h >= 56 ? 10 : 6;
  const innerW = Math.max(12, w - padX * 2);
  const innerH = Math.max(12, h - padY * 2);
  const maxLines = maxLinesForTile(w, h);
  const areaScale = Math.sqrt(Math.max(1, w * h));

  // Seed from tile geometry — Finviz names dominate the cell.
  const minName = w < 64 || h < 40 ? MIN_NAME : w < 100 || h < 64 ? 13 : 15;
  const maxName = clamp(areaScale * 0.22, 18, MAX_NAME);
  let seed = clamp(areaScale * 0.185, minName, maxName);
  seed = Math.min(seed, innerH * (omitRate ? 0.72 : 0.58), innerW * 0.42);

  const showRate = !omitRate && h >= 32;
  const rateBudget = showRate ? Math.min(MAX_RATE + 4, innerH * 0.22) : 0;
  const nameBudget = Math.max(minName, innerH - (showRate ? rateBudget + 4 : 0));

  const fitted = maximizeReadableNameSize(name, innerW, nameBudget, minName, maxName, maxLines);
  let nameSize = fitted.size;
  // Prefer the larger of seed vs fitted when fitted under-fills a big tile.
  if (fitted.size < seed * 0.92) {
    const retry = maximizeReadableNameSize(name, innerW, nameBudget, minName, maxName, maxLines);
    nameSize = Math.max(fitted.size, Math.min(seed, retry.size));
  }

  const nameLines = Math.min(maxLines, wrapLineCount(name, nameSize, innerW));
  const combine = Boolean(typeLabel) && w >= 88 && h >= 56;
  const rateText = combine ? `${rate}  ${typeLabel}` : rate;
  let rateSize = showRate ? clamp(Math.min(nameSize * 0.55, 17), MIN_RATE, MAX_RATE) : 0;
  if (showRate) rateSize = fitSizeToWidth(rateText, rateSize, innerW, MIN_RATE);

  const showArtist = Boolean(artist) && w >= 72 && h >= 72;
  let artistSize = 0;
  if (showArtist && artist) {
    artistSize = clamp(nameSize * 0.5, MIN_ARTIST, MAX_ARTIST);
    artistSize = fitSizeToWidth(artist, artistSize, innerW, MIN_ARTIST);
  }

  const gap = 3;
  let usedArtist = showArtist;
  let usedRate = showRate;
  const nameH = () => nameBlockHeight(nameSize, Math.min(maxLines, wrapLineCount(name, nameSize, innerW)));
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

  // If the stack still overflows, shrink the name — keep it visible first.
  while (stack > innerH && nameSize > minName) {
    nameSize -= 0.4;
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
  const mid = y + h / 2 + 2;
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
