import {
  HEATMAP_WRAP_MIN_CHARS,
  heatmapLabelCharCount,
  heatmapLabelDisplayLength,
} from "@/lib/heatmap-display-name";

const MIN_NAME = 12;
const READABLE_NAME = 13;
const MAX_NAME = 28;
const MIN_RATE = 12;
const MAX_RATE = 18;
const MIN_ARTIST = 10;
const MAX_ARTIST = 14;
const NAME_LINE_HEIGHT = 1.14;

/** Korean particles / endings — keep with the preceding word when breaking. */
const TRAILING_JOSA =
  /^(은|는|이|가|을|를|의|에|에서|으로|로써|로서|로|와|과|도|만|부터|까지|에게|한테|께|이며|이고|이나|나|며|고|요|다)$/;

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

function fitSizeToWidth(text: string, size: number, maxWidth: number, min: number): number {
  let next = size;
  while (next > min && measureTextWidth(text, next) > maxWidth) {
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
 * Names with 10+ characters (spaces/symbols included) wrap to 2+ lines so type
 * can stay larger. Very long titles may use a third line when the tile allows.
 */
function maxLinesForTile(width: number, height: number, displayLen: number): number {
  if (displayLen < HEATMAP_WRAP_MIN_CHARS) return 1;
  if (displayLen >= 18 && height >= 64 && width >= 70) return 3;
  // Cramped tiles: wrap earlier so each line stays short and type can grow.
  if (height >= 32 && width >= 40 && displayLen >= 8) return 2;
  if (height >= 36 && width >= 44) return 2;
  return 1;
}

/** Candidate soft-break indices (between chars), preferring spaces / sense boundaries. */
function softBreakCandidates(text: string): number[] {
  const breaks: number[] = [];
  const tokens = text.split(/(\s+|·|\/|-)/);
  let cursor = 0;
  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t] ?? "";
    if (!token) continue;
    const next = cursor + token.length;
    if (/^\s+$/.test(token) || token === "·" || token === "/" || token === "-") {
      // Break after the separator so the next word starts the new line.
      if (next > 0 && next < text.length) breaks.push(next);
    } else if (t + 2 < tokens.length && /^\s+$/.test(tokens[t + 1] ?? "")) {
      // Break before space when following token looks like a josa-only particle.
      const following = tokens[t + 2] ?? "";
      if (!TRAILING_JOSA.test(following) && cursor > 0) {
        /* space break handled above */
      }
    }
    cursor = next;
  }

  // Hangul compounds without spaces: prefer mid breaks after 2+ syllables,
  // avoiding a trailing josa stranded alone on the next line.
  if (!/\s/.test(text) && text.length >= HEATMAP_WRAP_MIN_CHARS) {
    for (let i = 2; i < text.length - 1; i++) {
      const rest = text.slice(i);
      if (TRAILING_JOSA.test(rest)) continue;
      // Prefer breaks near the middle.
      breaks.push(i);
    }
  }

  return [...new Set(breaks)].sort((a, b) => a - b);
}

function pickBreakNear(text: string, target: number, candidates: number[]): number {
  if (!candidates.length) return target;
  return candidates.reduce(
    (best, index) => (Math.abs(index - target) < Math.abs(best - target) ? index : best),
    candidates[0]!,
  );
}

/**
 * Insert soft line breaks so names with 10+ characters (spaces/symbols included)
 * paint on 2+ lines. Prefers spaces, punctuation, and Hangul sense boundaries
 * (조사·띄어쓰기) over raw mid-string cuts.
 */
export function softWrapHeatmapName(name: string, maxLines = 2): string {
  const text = name.replace(/\s+/g, " ").trim();
  if (text.length < HEATMAP_WRAP_MIN_CHARS || maxLines < 2) return text;

  const linesWanted = text.length >= 18 && maxLines >= 3 ? 3 : 2;
  const candidates = softBreakCandidates(text);

  if (linesWanted === 2) {
    const mid = Math.ceil(text.length / 2);
    const at = pickBreakNear(text, mid, candidates);
    const loose =
      candidates.length && Math.abs(at - mid) <= Math.max(4, Math.floor(text.length * 0.4));
    const cut = loose ? at : mid;
    const left = text.slice(0, cut).trim();
    const right = text.slice(cut).trim();
    if (!left || !right) return text;
    // Avoid a one-syllable orphan on either line when a nearby candidate exists.
    if (left.length === 1 || right.length === 1) {
      const safer = candidates.find((index) => index >= 2 && text.length - index >= 2);
      if (safer != null) {
        return `${text.slice(0, safer).trim()}\n${text.slice(safer).trim()}`;
      }
    }
    return `${left}\n${right}`;
  }

  const third = Math.ceil(text.length / 3);
  const a = pickBreakNear(text, third, candidates);
  const b = pickBreakNear(
    text,
    third * 2,
    candidates.filter((index) => index > a + 1),
  );
  const l1 = text.slice(0, a).trim();
  const l2 = text.slice(a, b).trim();
  const l3 = text.slice(b).trim();
  return [l1, l2, l3].filter(Boolean).join("\n");
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

  const floor = Math.min(MIN_NAME, Math.max(11, heightCap * 0.9));
  const ceiling = Math.max(floor, Math.min(MAX_NAME, heightCap));
  size = clamp(size, floor, ceiling);

  // Multi-line long names: nudge size up — wrapping already frees width.
  if (maxLines >= 2 && displayLen >= HEATMAP_WRAP_MIN_CHARS) {
    size = Math.min(ceiling, size * 1.14);
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
 * Prefer truncating a long name over painting it unreadably small.
 * Keeps type near READABLE_NAME whenever the box can hold ≥4 glyphs.
 */
function preferReadableName(
  name: string,
  innerW: number,
  innerH: number,
  omitRate: boolean,
): { name: string; size: number; lines: number; maxLines: number } {
  const fitted = densityNameSize({ text: name, innerW, innerH, omitRate });
  if (fitted.size >= READABLE_NAME || name.length <= 4) {
    return { name, ...fitted };
  }

  // Binary-search a shorter prefix that paints at readable size.
  let lo = 4;
  let hi = name.length;
  let best = { name, ...fitted };
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = ellipsize(name.slice(0, mid), READABLE_NAME, innerW);
    const trial = densityNameSize({ text: candidate, innerW, innerH, omitRate });
    if (trial.size >= READABLE_NAME - 0.2) {
      best = { name: candidate, ...trial };
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // Absolute floor: never drop below MIN_NAME when any text can fit.
  if (best.size < MIN_NAME) {
    const short = ellipsize(name, MIN_NAME, innerW);
    const trial = densityNameSize({ text: short, innerW, innerH, omitRate: true });
    return { name: short, size: Math.max(MIN_NAME, trial.size), lines: trial.lines, maxLines: trial.maxLines };
  }
  return best;
}

/**
 * Hangul-first treemap label: full names wrap at 10+ chars; size follows density
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

  // Tiny tiles: drop ±% early so the name can claim the height budget.
  const cramped = w < 72 || h < 44;
  const showRate = !omitRate && !cramped && h >= 34;
  const rateBudget = showRate ? Math.min(MAX_RATE + 2, innerH * 0.18) : 0;
  const nameBudget = Math.max(MIN_NAME, innerH - (showRate ? rateBudget + 3 : 0));

  const readable = preferReadableName(name, innerW, nameBudget, !showRate);
  let nameSize = readable.size;
  const maxLines = readable.maxLines;
  const paintName = readable.name;

  const combine = Boolean(typeLabel) && w >= 88 && h >= 56;
  const rateText = combine ? `${rate}  ${typeLabel}` : rate;
  let rateSize = showRate ? clamp(Math.min(nameSize * 0.5, 16), MIN_RATE, MAX_RATE) : 0;
  if (showRate) rateSize = fitSizeToWidth(rateText, rateSize, innerW, MIN_RATE);

  const showArtist = Boolean(artist) && w >= 80 && h >= 78 && !cramped;
  let artistSize = 0;
  if (showArtist && artist) {
    artistSize = clamp(nameSize * 0.48, MIN_ARTIST, MAX_ARTIST);
    artistSize = fitSizeToWidth(artist, artistSize, innerW, MIN_ARTIST);
  }

  const gap = 3;
  let usedArtist = showArtist;
  let usedRate = showRate;
  const wrappedName = softWrapHeatmapName(paintName, maxLines);
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

  const nameFloor = Math.min(MIN_NAME, Math.max(11, nameBudget * 0.28));
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
