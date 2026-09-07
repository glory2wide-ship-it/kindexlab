const MIN_NAME = 15;
const MAX_NAME = 57;
const MIN_RATE = 15;
const MAX_RATE = 27;
const MIN_ARTIST = 13;
const MAX_ARTIST = 24;
const NAME_LINE_HEIGHT = 1.22;

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

/** Pick the largest size that still wraps onto `maxLines` in the tile. */
function fitWrappedSize(text: string, start: number, maxWidth: number, min: number, maxLines: number): number {
  let next = start;
  while (next > min && wrapLineCount(text, next, maxWidth) > maxLines) {
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

function minReadableName(width: number, height: number): number {
  if (width >= 100 && height >= 64) return 17;
  if (width >= 72 && height >= 48) return 15;
  return MIN_NAME;
}

/**
 * Centered stack: title (up to two wrapped lines), optional artist, then change %.
 * Rank is drawn separately in the tile corner — do not prepend it here.
 *
 * Long Korean names used to shrink to a single SVG line, then were cut another 40%.
 * Wrapping keeps type near the box scale instead of collapsing to ~11px.
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

  const innerW = Math.max(12, w - 16);
  const innerH = Math.max(12, h - 22);
  const areaScale = Math.sqrt(Math.max(1, w * h));
  const readableMin = minReadableName(w, h);
  const maxLines = h >= 44 ? 2 : 1;

  let nameSize = clamp(areaScale * 0.21, readableMin, MAX_NAME);
  nameSize = Math.min(nameSize, innerH * (maxLines === 2 ? 0.42 : 0.5), innerW * 0.55);
  nameSize = fitWrappedSize(name, nameSize, innerW, readableMin, maxLines);

  const showArtist = Boolean(artist) && w >= 48 && h >= 40;
  let artistSize = 0;
  if (showArtist && artist) {
    artistSize = clamp(nameSize * 0.72, MIN_ARTIST, MAX_ARTIST);
    artistSize = fitSizeToWidth(artist, artistSize, innerW, MIN_ARTIST);
  }

  const combine = Boolean(typeLabel) && w >= 72 && h >= 40;
  const rateText = combine ? `${rate}  ${typeLabel}` : rate;
  const showRate = h >= 28;
  let rateSize = showRate ? clamp(nameSize * 0.68, MIN_RATE, MAX_RATE) : 0;
  if (showRate) rateSize = fitSizeToWidth(rateText, rateSize, innerW, MIN_RATE);

  const nameBlockH = (size: number) => {
    const lines = Math.min(maxLines, wrapLineCount(name, size, innerW));
    return size * (lines === 1 ? 1 : 1 + (lines - 1) * NAME_LINE_HEIGHT);
  };

  const gap = Math.max(3, nameSize * 0.12);
  let stack = nameBlockH(nameSize);
  if (showArtist) stack += gap + artistSize;
  if (showRate) stack += gap + rateSize;

  if (stack > innerH) {
    const scale = innerH / stack;
    nameSize = Math.max(readableMin, nameSize * scale);
    if (showArtist) artistSize = Math.max(MIN_ARTIST, artistSize * scale);
    if (showRate) rateSize = Math.max(MIN_RATE, rateSize * scale);
  }

  const nameLines = Math.min(maxLines, wrapLineCount(name, nameSize, innerW));
  const displayName = nameLines === 1 ? ellipsize(name, nameSize, innerW) : name;
  const displayArtist = showArtist && artist ? ellipsize(artist, artistSize, innerW) : "";
  const displayRate = showRate ? ellipsize(rateText, rateSize, innerW) : "";
  const mid = y + h / 2 + 2;
  const finalNameBlock = nameBlockH(nameSize);
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
