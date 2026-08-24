const MIN_NAME = 13;
const MAX_NAME = 44;
const MIN_RATE = 12;
const MAX_RATE = 28;

export interface TreemapLabelLayout {
  showName: boolean;
  showRate: boolean;
  showType: boolean;
  name: string;
  nameSize: number;
  rateSize: number;
  typeSize: number;
  padX: number;
  padY: number;
  nameY: number;
  rateY: number;
  typeY: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Approximate rendered width in px for Pretendard/Inter at `fontSize`. */
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
 * Name + fluctuation are always shown. Sector is optional.
 * Shrink or ellipsize the title instead of dropping the percentage.
 */
export function layoutTreemapLabel(input: {
  width: number;
  height: number;
  y: number;
  name: string;
  rate: string;
  typeLabel: string;
}): TreemapLabelLayout | null {
  const { width: w, height: h, y, name, rate, typeLabel } = input;
  if (w < 48 || h < 36) return null;

  const padX = w < 96 ? 6 : clamp(Math.round(Math.min(16, w * 0.08)), 8, 16);
  const padY = h < 72 ? 5 : clamp(Math.round(Math.min(14, h * 0.1)), 7, 14);
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  if (innerW < 28 || innerH < 24) return null;

  const areaScale = Math.sqrt(Math.max(1, w * h));
  let nameSize = clamp(areaScale * 0.132, MIN_NAME, MAX_NAME);
  nameSize = Math.min(nameSize, innerH * 0.42, innerW * 0.42);
  nameSize = fitSizeToWidth(name, nameSize, innerW, MIN_NAME);

  let rateSize = clamp(nameSize * 0.78, MIN_RATE, MAX_RATE);
  rateSize = fitSizeToWidth(rate, rateSize, innerW, Math.min(MIN_RATE, innerW * 0.22));

  const lineGap = Math.max(2, nameSize * 0.16);
  const stacked = () => nameSize + lineGap + rateSize * 0.92;

  if (stacked() > innerH) {
    const scale = innerH / stacked();
    nameSize = Math.max(11, nameSize * scale);
    rateSize = Math.max(11, rateSize * scale);
  }
  if (stacked() > innerH) {
    rateSize = Math.min(rateSize, Math.max(11, innerH * 0.32));
    nameSize = Math.max(11, innerH - lineGap - rateSize * 0.92);
  }

  nameSize = fitSizeToWidth(name, nameSize, innerW, 11);
  rateSize = fitSizeToWidth(rate, rateSize, innerW, 11);
  const displayName = ellipsize(name, nameSize, innerW);

  let typeSize = clamp(nameSize * 0.48, 10, 13);
  const typeGap = Math.max(2, nameSize * 0.12);
  let showType =
    innerH > stacked() + typeGap + typeSize + 2 &&
    w >= 108 &&
    measureTextWidth(typeLabel, typeSize) <= innerW;

  const nameY = y + padY + nameSize * 0.84;
  let rateY = nameY + lineGap + rateSize * 0.9;
  const maxRateY = y + h - padY - 1;
  if (rateY > maxRateY) {
    rateY = maxRateY;
    showType = false;
  }
  const typeY = rateY + typeGap + typeSize * 0.88;
  if (typeY > y + h - 2) showType = false;

  return {
    showName: true,
    showRate: true,
    showType,
    name: displayName,
    nameSize: Math.round(nameSize * 10) / 10,
    rateSize: Math.round(rateSize * 10) / 10,
    typeSize: Math.round(typeSize * 10) / 10,
    padX,
    padY,
    nameY: Math.round(nameY * 10) / 10,
    rateY: Math.round(rateY * 10) / 10,
    typeY: Math.round(typeY * 10) / 10,
  };
}
