const MIN_NAME = 12;
const MAX_NAME = 38;
const MIN_RATE = 10;
const MAX_RATE = 18;
const MIN_ARTIST = 10;
const MAX_ARTIST = 16;

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

/**
 * Centered stack: title, optional artist, then change % (and pt when it fits).
 * Rank is drawn separately in the tile corner — do not prepend it here.
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
  const innerH = Math.max(12, h - 18);
  const areaScale = Math.sqrt(Math.max(1, w * h));
  let nameSize = clamp(areaScale * 0.13, MIN_NAME, MAX_NAME);
  nameSize = Math.min(nameSize, innerH * 0.42, innerW * 0.42);
  nameSize = fitSizeToWidth(name, nameSize, innerW, MIN_NAME);

  const showArtist = Boolean(artist) && w >= 48 && h >= 32;
  let artistSize = 0;
  if (showArtist && artist) {
    artistSize = clamp(nameSize * 0.78, MIN_ARTIST, MAX_ARTIST);
    artistSize = fitSizeToWidth(artist, artistSize, innerW, MIN_ARTIST);
  }

  const combine = Boolean(typeLabel) && w >= 72 && h >= 40;
  const rateText = combine ? `${rate}  ${typeLabel}` : rate;
  const showRate = h >= 28;
  let rateSize = showRate ? clamp(nameSize * 0.68, MIN_RATE, MAX_RATE) : 0;
  if (showRate) rateSize = fitSizeToWidth(rateText, rateSize, innerW, MIN_RATE);

  const gap = Math.max(3, nameSize * 0.14);
  let stack = nameSize;
  if (showArtist) stack += gap + artistSize;
  if (showRate) stack += gap + rateSize;

  if (stack > innerH) {
    const scale = innerH / stack;
    nameSize = Math.max(MIN_NAME, nameSize * scale);
    if (showArtist) artistSize = Math.max(MIN_ARTIST, artistSize * scale);
    if (showRate) rateSize = Math.max(MIN_RATE, rateSize * scale);
    stack = nameSize;
    if (showArtist) stack += gap + artistSize;
    if (showRate) stack += gap + rateSize;
  }

  const displayName = ellipsize(name, nameSize, innerW);
  const displayArtist = showArtist && artist ? ellipsize(artist, artistSize, innerW) : "";
  const displayRate = showRate ? ellipsize(rateText, rateSize, innerW) : "";
  const mid = y + h / 2 + 2;
  let cursor = mid - stack / 2;
  const nameY = cursor + nameSize * 0.82;
  cursor += nameSize;
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
    padX: 6,
    padY: 4,
    nameY: Math.round(nameY * 10) / 10,
    rateY: Math.round(rateY * 10) / 10,
    typeY: Math.round(rateY * 10) / 10,
    metaY: Math.round(artistY * 10) / 10,
  };
}
