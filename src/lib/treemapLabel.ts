const MIN_NAME = 15;
const MAX_NAME = 64;
const MIN_RATE = 15;
const MAX_RATE = 27;
const MIN_ARTIST = 12;
const MAX_ARTIST = 20;
const NAME_LINE_HEIGHT = 1.2;

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
  if (height >= 108 && width >= 88) return 3;
  if (height >= 52 && width >= 56) return 2;
  return 1;
}

function minReadableName(width: number, height: number): number {
  const area = width * height;
  if (area >= 28_000 || (width >= 150 && height >= 110)) return 24;
  if (area >= 16_000 || (width >= 110 && height >= 80)) return 20;
  if (width >= 90 && height >= 56) return 17;
  return MIN_NAME;
}

/**
 * Largest type that still wraps into `maxLines` and fits `budgetH`.
 * Top-10 tiles are large enough that long names should grow onto 3 lines
 * instead of shrinking to stay on 2.
 */
function largestNameSize(
  text: string,
  maxWidth: number,
  budgetH: number,
  maxLines: number,
  min: number,
  max: number,
): { size: number; lines: number } {
  let lo = min;
  let hi = Math.max(min, max);
  let best = min;
  let bestLines = 1;
  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2;
    const needed = wrapLineCount(text, mid, maxWidth);
    const lines = Math.min(maxLines, Math.max(1, needed));
    const fitsWrap = needed <= maxLines;
    const fitsH = nameBlockHeight(mid, lines) <= budgetH + 0.5;
    if (fitsWrap && fitsH) {
      best = mid;
      bestLines = lines;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { size: Math.round(best * 10) / 10, lines: bestLines };
}

/**
 * Centered stack: title (up to three wrapped lines on tall tiles), optional
 * artist, then change %. Rank sits in the corner and is not part of this stack.
 *
 * Name size is chosen to fill the tile. Secondary lines shrink or drop first so
 * long 10위권 titles do not sit in a large box at ~18px.
 */
export function layoutTreemapLabel(input: {
  width: number;
  height: number;
  y: number;
  name: string;
  rate: string;
  typeLabel: string;
  rank?: string;
  artist?: string;
  metaLabel?: string;
  forceType?: boolean;
}): TreemapLabelLayout | null {
  const { width: w, height: h, y, name, rate, typeLabel, artist } = input;
  if (w < 28 || h < 18) return null;

  const innerW = Math.max(12, w - 14);
  const innerH = Math.max(12, h - 24);
  const readableMin = minReadableName(w, h);
  const maxLines = maxLinesForTile(w, h);
  const showRate = h >= 28;
  const combine = Boolean(typeLabel) && w >= 72 && h >= 40;
  const rateText = combine ? `${rate}  ${typeLabel}` : rate;
  const rateSizeBase = showRate ? clamp(Math.min(innerW * 0.12, 22), MIN_RATE, MAX_RATE) : 0;
  const rateSizeFitted = showRate ? fitSizeToWidth(rateText, rateSizeBase, innerW, MIN_RATE) : 0;
  const gap = 4;
  const rateReserve = showRate ? rateSizeFitted + gap : 0;

  const wantArtist = Boolean(artist) && w >= 64 && h >= 56;
  const artistReserve = wantArtist ? MIN_ARTIST + gap : 0;

  let nameBudget = Math.max(readableMin, innerH - rateReserve);
  let showArtist = false;
  let artistSize = 0;

  // Keep the title large; only add the org/artist line when the name still
  // has a healthy budget (typical on #1–#4 tiles).
  if (wantArtist && innerH - rateReserve - artistReserve >= readableMin * 1.15) {
    showArtist = true;
    nameBudget = Math.max(readableMin, innerH - rateReserve - artistReserve);
  }

  const fitted = largestNameSize(name, innerW, nameBudget, maxLines, readableMin, MAX_NAME);
  let nameSize = fitted.size;
  let nameLines = fitted.lines;

  if (showArtist && artist) {
    artistSize = clamp(Math.min(nameSize * 0.48, 18), MIN_ARTIST, MAX_ARTIST);
    artistSize = fitSizeToWidth(artist, artistSize, innerW, MIN_ARTIST);
  }

  let rateSize = rateSizeFitted;
  if (showRate) {
    rateSize = clamp(Math.min(rateSizeFitted, nameSize * 0.62), MIN_RATE, MAX_RATE);
    rateSize = fitSizeToWidth(rateText, rateSize, innerW, MIN_RATE);
  }

  const stackH = () => {
    let stack = nameBlockHeight(nameSize, nameLines);
    if (showArtist) stack += gap + artistSize;
    if (showRate) stack += gap + rateSize;
    return stack;
  };

  if (stackH() > innerH && showArtist) {
    showArtist = false;
    artistSize = 0;
    nameBudget = Math.max(readableMin, innerH - rateReserve);
    const retry = largestNameSize(name, innerW, nameBudget, maxLines, readableMin, MAX_NAME);
    nameSize = retry.size;
    nameLines = retry.lines;
  }

  if (stackH() > innerH && showRate) {
    const overflow = stackH() - innerH;
    rateSize = Math.max(MIN_RATE, rateSize - overflow);
  }

  const displayName = nameLines === 1 ? ellipsize(name, nameSize, innerW) : name;
  const displayArtist = showArtist && artist ? ellipsize(artist, artistSize, innerW) : "";
  const displayRate = showRate ? ellipsize(rateText, rateSize, innerW) : "";
  const mid = y + h / 2 + 2;
  const finalNameBlock = nameBlockHeight(nameSize, nameLines);
  let finalStack = finalNameBlock;
  if (showArtist) finalStack += gap + artistSize;
  if (showRate) finalStack += gap + rateSize;
  let cursor = mid - finalStack / 2;
  const nameY = cursor + nameSize * 0.82;
  cursor += finalNameBlock;
  let artistY = 0;
  if (showArtist) {
    cursor += gap;
    artistY = cursor + artistSize * 0.82;
    cursor += artistSize;
  }
  let rateY = nameY;
  if (showRate) {
    cursor += gap;
    rateY = cursor + rateSize * 0.82;
  }

  return {
    showName: true,
    showRate,
    showType: combine,
    showMeta: showArtist,
    name: displayName,
    rate: displayRate,
    meta: displayArtist,
    nameSize: Math.round(nameSize * 10) / 10,
    rateSize: Math.round(rateSize * 10) / 10,
    typeSize: Math.round(rateSize * 10) / 10,
    metaSize: Math.round(artistSize * 10) / 10,
    nameLines,
    padX: 6,
    padY: 4,
    nameY: Math.round(nameY * 10) / 10,
    rateY: Math.round(rateY * 10) / 10,
    typeY: Math.round(rateY * 10) / 10,
    metaY: Math.round(artistY * 10) / 10,
  };
}
