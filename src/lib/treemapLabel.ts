import {
  HEATMAP_WRAP_MIN_CHARS,
  heatmapLabelCharCount,
  heatmapLabelDisplayLength,
} from "@/lib/heatmap-display-name";

const MIN_NAME = 15.5;
/** Shrink below MIN_NAME before ever clipping a name. */
const ABSOLUTE_NAME_FLOOR = 8;
const MAX_NAME = 26;
const MIN_RATE = 12;
const MAX_RATE = 18;
const MIN_ARTIST = 10;
const MAX_ARTIST = 14;
const NAME_LINE_HEIGHT = 1.28;
const ABSOLUTE_MAX_LINES = 2;

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
    next -= 0.25;
  }
  return next;
}

/** Secondary fields (rate / artist) may ellipsize — never used for the primary name. */
function ellipsizeSecondary(text: string, fontSize: number, maxWidth: number): string {
  if (measureTextWidth(text, fontSize) <= maxWidth) return text;
  const ellipsis = "…";
  let cut = text.length;
  while (cut > 1 && measureTextWidth(`${text.slice(0, cut)}${ellipsis}`, fontSize) > maxWidth) {
    cut -= 1;
  }
  return cut <= 1 ? ellipsis : `${text.slice(0, cut)}${ellipsis}`;
}

function nameBlockHeight(size: number, lines: number): number {
  if (lines <= 1) return size;
  return size * (1 + (lines - 1) * NAME_LINE_HEIGHT);
}

/**
 * How many lines the tile may use. Prefer wrapping over clipping — even short
 * Hangul stock names (5–9 chars) wrap when the box is narrow.
 */
function maxLinesForTile(width: number, height: number, displayLen: number): number {
  // SoftWrap enforces ≤7 → 1 line (except strong brands like 상인|푸르지오).
  // Tile geometry may still allow 2 lines so brand splits can paint.
  if (displayLen <= 3) return 1;
  if (height >= 28 && width >= 36 && displayLen >= 5) return 2;
  if (height >= 32 && width >= 40) return 2;
  if (displayLen >= HEATMAP_WRAP_MIN_CHARS) return 2;
  return 1;
}

/** Soft font-size ceiling — area budget below is the binding 25% rule. */
function maxNameSizeForTile(width: number, height: number): number {
  return Math.min(MAX_NAME, Math.min(width, height) * 0.4);
}

/** Painted name block (longest line × block height) must stay ≤ 25% of tile area. */
const NAME_AREA_RATIO = 0.25;

function namePaintArea(size: number, lines: string[]): number {
  const rows = lines.length ? lines : [""];
  let longest = 0;
  for (const line of rows) {
    longest = Math.max(longest, measureTextWidth(line, size));
  }
  return longest * nameBlockHeight(size, Math.max(1, rows.length));
}

function shrinkNameToAreaBudget(
  size: number,
  lines: string[],
  tileW: number,
  tileH: number,
  floor: number,
): number {
  const budget = Math.max(1, tileW * tileH * NAME_AREA_RATIO);
  let next = size;
  // Keep stepping while over budget; allow one step onto the floor.
  while (next > floor && namePaintArea(next, lines) > budget) {
    next = Math.max(floor, next - 0.25);
  }
  return next;
}

/** True when index sits inside paired brackets / quotes. */
function insidePairedMarks(text: string, index: number): boolean {
  const pairs: Array<[string, string]> = [
    ["(", ")"],
    ["[", "]"],
    ["（", "）"],
    ["〈", "〉"],
    ["《", "》"],
    ["「", "」"],
    ["『", "』"],
    ["<", ">"],
    ["＜", "＞"],
  ];
  for (const [open, close] of pairs) {
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === open) depth += 1;
      if (i === index && depth > 0) return true;
      if (text[i] === close && depth > 0) depth -= 1;
    }
  }
  return false;
}

/**
 * Prefer breaking *before* these compound tails.
 * Examples: 기후동행|카드, 스포츠강좌|이용권, 든든|전세주택, 청년|도약계좌
 * Longer units first.
 */
const COMPOUND_TAIL_UNITS = [
  "에어로스페이스",
  "에너지솔루션",
  "강좌이용권",
  "전세주택",
  "도약계좌",
  "지원사업",
  "지원금",
  "이용권",
  "솔루션",
  "서비스",
  "플랫폼",
  "시스템",
  "인덱스",
  "휴가지원",
  "전기요금",
  "푸르지오",
  "힐스테이트",
  "래미안",
  "아이파크",
  "롯데캐슬",
  "센트레빌",
  "전세",
  "주택",
  "계좌",
  "요금",
  "지원",
  "사업",
  "카드",
  "바우처",
  "패스",
  "보험",
  "대출",
  "연금",
  "급여",
  "관광",
  "시장",
  "김밥",
  "찌개",
  "센터",
  "클럽",
  "하우스",
  "파크",
  "타워",
  "랭킹",
  "펀드",
  "은행",
  "증권",
  "항공",
  "호텔",
  "리조트",
] as const;

/**
 * Apartment / branded place tails — may wrap even when compact length ≤ 7
 * (e.g. 상인|푸르지오). Closed compounds like SK하이닉스 stay one line.
 */
const STRONG_BRAND_TAILS = [
  "푸르지오",
  "힐스테이트",
  "래미안",
  "아이파크",
  "롯데캐슬",
  "센트레빌",
  "더샵",
  "e편한세상",
] as const;

/**
 * Prefer breaking *after* these semantic heads (policy / genre / demographic openers).
 * Examples: 든든|전세주택, 청년|도약계좌, 연극|〈더 헬멧〉
 */
const COMPOUND_HEAD_UNITS = [
  "스포츠강좌",
  "소상공인",
  "지역사랑",
  "기후동행",
  "든든",
  "청년",
  "신혼",
  "노인",
  "행복",
  "희망",
  "국민",
  "지역",
  "연극",
  "뮤지컬",
  "영화",
  "전시",
  "콘서트",
] as const;

type BreakKind = "space" | "paren" | "semantic" | "mid";

function classifyBreak(text: string, index: number): BreakKind {
  if (/\s/.test(text.slice(Math.max(0, index - 1), index + 1))) return "space";
  if (/[·\/-]/.test(text.slice(Math.max(0, index - 1), index + 1))) return "space";
  const left = text.slice(0, index);
  const right = text.slice(index);
  if (
    /[)\]〉》」』）>＞]$/.test(left.trimEnd()) ||
    /^[(\[〈《「『（<＜]/.test(right)
  ) {
    return "paren";
  }
  for (const tail of COMPOUND_TAIL_UNITS) {
    if (right.startsWith(tail) && left.replace(/\s+/g, "").length >= 2) return "semantic";
  }
  for (const head of COMPOUND_HEAD_UNITS) {
    if (left.replace(/\s+/g, "").endsWith(head) && right.replace(/\s+/g, "").length >= 2) {
      return "semantic";
    }
  }
  return "mid";
}

function spaceOrDelimBreaks(text: string): number[] {
  const breaks: number[] = [];
  const tokens = text.split(/(\s+|·|\/|-)/);
  let cursor = 0;
  for (const token of tokens) {
    if (!token) continue;
    const next = cursor + token.length;
    if (/^\s+$/.test(token) || token === "·" || token === "/" || token === "-") {
      // Never break on whitespace that sits inside 〈…〉 / (…) / <…>.
      if (next > 0 && next < text.length && !insidePairedMarks(text, next)) {
        breaks.push(next);
      }
    }
    cursor = next;
  }
  return breaks;
}

function parenEdgeBreaks(text: string): number[] {
  const breaks: number[] = [];
  for (let i = 1; i < text.length; i++) {
    const ch = text[i]!;
    const prev = text[i - 1]!;
    if (/^[)\]〉》」』）>＞]$/.test(prev)) breaks.push(i);
    if (/^[(\[〈《「『（<＜]$/.test(ch)) breaks.push(i);
  }
  return breaks;
}

function semanticCompoundBreaks(text: string): number[] {
  const breaks: number[] = [];
  for (const tail of COMPOUND_TAIL_UNITS) {
    let from = 0;
    while (from < text.length) {
      const at = text.indexOf(tail, from);
      if (at < 0) break;
      if (at >= 2 && at + tail.length <= text.length && !insidePairedMarks(text, at)) {
        breaks.push(at);
      }
      from = at + 1;
    }
  }
  for (const head of COMPOUND_HEAD_UNITS) {
    let from = 0;
    while (from < text.length) {
      const at = text.indexOf(head, from);
      if (at < 0) break;
      const after = at + head.length;
      if (after >= 2 && after < text.length - 1 && !insidePairedMarks(text, after)) {
        breaks.push(after);
      }
      from = at + 1;
    }
  }
  return breaks;
}

/**
 * Soft-break candidates by linguistic quality.
 * Spaces inside paired marks are ignored so "연극〈더 헬멧〉" breaks before 〈,
 * not inside the title.
 */
function softBreakCandidates(text: string): number[] {
  const spaces = spaceOrDelimBreaks(text);
  const parens = parenEdgeBreaks(text);
  const semantic = semanticCompoundBreaks(text);

  // Always keep paren + semantic with spaces — paren must beat inner spaces.
  const preferred = [...new Set([...spaces, ...parens, ...semantic])].sort((a, b) => a - b);
  if (preferred.length) return preferred;

  const mid: number[] = [];
  if (text.length >= 5) {
    for (let i = 2; i < text.length - 1; i++) {
      if (insidePairedMarks(text, i)) continue;
      const rest = text.slice(i);
      if (TRAILING_JOSA.test(rest)) continue;
      const nextChunk = rest.match(/^\S{1,3}/)?.[0] ?? "";
      if (TRAILING_JOSA.test(nextChunk)) continue;
      mid.push(i);
    }
  }
  return mid;
}

function pickBreakNear(_text: string, target: number, candidates: number[]): number {
  if (!candidates.length) return target;
  return candidates.reduce(
    (best, index) => (Math.abs(index - target) < Math.abs(best - target) ? index : best),
    candidates[0]!,
  );
}


function compactNameLen(text: string): number {
  return text.replace(/\s+/g, "").length;
}

/** Map a compact-string index back onto the spaced source string. */
function indexInSpacedText(text: string, compactIndex: number): number {
  let compact = 0;
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i]!)) continue;
    if (compact === compactIndex) return i;
    compact += 1;
  }
  return text.length;
}

function strongBrandBreakAt(text: string): number | null {
  const compact = text.replace(/\s+/g, "");
  for (const tail of STRONG_BRAND_TAILS) {
    if (!compact.endsWith(tail)) continue;
    const headLen = compact.length - tail.length;
    if (headLen < 2) continue;
    return indexInSpacedText(text, headLen);
  }
  return null;
}

/**
 * Soft-wrap the full name. Never truncates — callers shrink type instead.
 * Break priority: whitespace (outside brackets) → paren edges → compound
 * head/tail units → mid-Hangul last resort.
 * Compact length ≤ 7 stays one line unless a strong brand tail splits it.
 */
export function softWrapHeatmapName(name: string, maxLines = 2): string {
  const text = name.replace(/\s+/g, " ").trim();
  if (!text || maxLines < 2) return text;

  const compactLen = compactNameLen(text);
  // ≤7 chars: one line by default (SK하이닉스, 소비자물가지수). Brand compounds may wrap.
  if (compactLen <= 7) {
    if (maxLines < 2) return text;
    const brandAt = strongBrandBreakAt(text);
    if (brandAt == null || brandAt < 2) return text;
    const left = text.slice(0, brandAt).trim();
    const right = text.slice(brandAt).trim();
    return left && right ? `${left}\n${right}` : text;
  }

  const linesWanted = Math.min(2, maxLines);
  const candidates = softBreakCandidates(text);

  if (linesWanted === 2) {
    const mid = Math.ceil(text.length / 2);
    const pool = candidates.length ? candidates : [mid];
    let best = mid;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const index of pool) {
      if (index < 2 || text.length - index < 2) continue;
      const left = text.slice(0, index).trim();
      const right = text.slice(index).trim();
      if (!left || !right) continue;
      // Linguistic breaks dominate; width only tie-breaks.
      const kind = classifyBreak(text, index);
      const kindPenalty =
        kind === "paren" ? 0 : kind === "space" ? 10 : kind === "semantic" ? 20 : 500;
      const longerWidth = Math.max(measureTextWidth(left, 10), measureTextWidth(right, 10));
      const skew = Math.abs(left.length - right.length);
      // Prefer a short meaningful head (2–6 chars) when kinds tie —
      // "든든"/"전세주택", "청년"/"도약계좌", "연극"/"〈…〉".
      const headBonus = left.length >= 2 && left.length <= 6 ? -15 : 0;
      // Prefer longer known tails ("이용권" over splitting earlier at "스포츠").
      let tailBonus = 0;
      for (const tail of COMPOUND_TAIL_UNITS) {
        if (right.startsWith(tail) && tail.length >= 3) {
          tailBonus = -30 - tail.length;
          break;
        }
      }
      // Prefer longer known heads when left ends with one ("스포츠강좌" > "스포츠").
      let headUnitBonus = 0;
      for (const head of COMPOUND_HEAD_UNITS) {
        if (left.replace(/\s+/g, "").endsWith(head) && head.length >= 4) {
          headUnitBonus = -20 - head.length;
          break;
        }
      }
      const score =
        kindPenalty * 1000 + longerWidth * 10 + skew + headBonus + tailBonus + headUnitBonus;
      if (score < bestScore) {
        bestScore = score;
        best = index;
      }
    }
    const left = text.slice(0, best).trim();
    const right = text.slice(best).trim();
    if (!left || !right) return text;
    return `${left}\n${right}`;
  }
  const segment = Math.ceil(text.length / linesWanted);
  const cuts: number[] = [];
  for (let i = 1; i < linesWanted; i++) {
    const target = segment * i;
    const filtered = candidates.filter((index) => index > (cuts[cuts.length - 1] ?? 0) + 1);
    cuts.push(pickBreakNear(text, target, filtered.length ? filtered : candidates));
  }
  const parts: string[] = [];
  let startAt = 0;
  for (const cut of cuts) {
    const slice = text.slice(startAt, cut).trim();
    if (slice) parts.push(slice);
    startAt = cut;
  }
  const tail = text.slice(startAt).trim();
  if (tail) parts.push(tail);
  return parts.join("\n") || text;
}

/**
 * Density sizing for the *full* name — wrap + shrink, never clip.
 */
function densityNameSize(input: {
  text: string;
  innerW: number;
  innerH: number;
  omitRate: boolean;
}): { size: number; lines: number; maxLines: number; wrapped: string } {
  const displayLen = heatmapLabelDisplayLength(input.text);
  const chars = heatmapLabelCharCount(input.text);
  let maxLines = maxLinesForTile(input.innerW + 12, input.innerH + 12, displayLen);

  // Short names (≤7) stay one line unless a strong brand split exists.
  // Longer names may force wrap when a single line cannot fit at MIN_NAME.
  const compactLen = compactNameLen(input.text);
  if (
    maxLines === 1 &&
    input.innerH >= 28 &&
    measureTextWidth(input.text, MIN_NAME) > input.innerW
  ) {
    if (compactLen > 7 || strongBrandBreakAt(input.text) != null) {
      maxLines = 2;
    }
  }

  const perLineChars = Math.max(1, Math.ceil(chars / maxLines));
  const perChar = input.innerW / perLineChars;
  let size = perChar * (perLineChars <= 3 ? 0.94 : perLineChars <= 5 ? 0.9 : 0.84);

  const heightShare =
    maxLines >= 2
      ? input.omitRate
        ? 0.72
        : 0.62
      : chars <= 3
        ? input.omitRate
          ? 0.55
          : 0.5
        : input.omitRate
          ? 0.46
          : 0.38;
  const heightCap = input.innerH * heightShare;
  const shortBoost = chars <= 4 && maxLines === 1 ? 1.1 : chars <= 6 && maxLines === 1 ? 1.05 : 1;
  size *= shortBoost;

  const preferredFloor = Math.min(MIN_NAME, Math.max(ABSOLUTE_NAME_FLOOR, heightCap * 0.55));
  const ceiling = Math.max(preferredFloor, Math.min(MAX_NAME, heightCap, maxNameSizeForTile(input.innerW + 12, input.innerH + 12)));
  size = clamp(size, preferredFloor, ceiling);

  if (maxLines >= 2 && displayLen >= 5) {
    size = Math.min(ceiling, size * 1.08);
  }

  let wrapped = softWrapHeatmapName(input.text, maxLines);
  let longestLine = wrapped
    .split("\n")
    .reduce((best, line) => (line.length > best.length ? line : best), "");
  size = fitSizeToWidth(longestLine || input.text, size, input.innerW, ABSOLUTE_NAME_FLOOR);

  let lines = Math.min(maxLines, Math.max(1, wrapped.split("\n").length));
  while (size - 0.25 >= ABSOLUTE_NAME_FLOOR && nameBlockHeight(size, lines) > input.innerH * 0.94) {
    size -= 0.25;
  }

  // Still overflowing width at the absolute floor → add a line if possible.
  while (
    maxLines < ABSOLUTE_MAX_LINES &&
    input.innerH >= 28 &&
    measureTextWidth(longestLine || input.text, size) > input.innerW
  ) {
    maxLines += 1;
    wrapped = softWrapHeatmapName(input.text, maxLines);
    longestLine = wrapped
      .split("\n")
      .reduce((best, line) => (line.length > best.length ? line : best), "");
    lines = Math.min(maxLines, Math.max(1, wrapped.split("\n").length));
    size = fitSizeToWidth(
      longestLine || input.text,
      Math.max(size, preferredFloor),
      input.innerW,
      ABSOLUTE_NAME_FLOOR,
    );
    while (size > ABSOLUTE_NAME_FLOOR && nameBlockHeight(size, lines) > input.innerH * 0.94) {
      size -= 0.25;
    }
  }

  return { size, lines, maxLines, wrapped };
}

/**
 * Hangul-first treemap label: always paints the full name (wrap + shrink).
 * No ticker-style abbreviation or ellipsis on the primary name.
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

  const fullName = name.replace(/\s+/g, " ").trim();
  if (!fullName) return null;

  const padX = w >= 100 ? 10 : 6;
  const padY = h >= 90 ? 12 : h >= 56 ? 9 : 6;
  const innerW = Math.max(12, w - padX * 2);
  const innerH = Math.max(12, h - padY * 2);

  // Tiny tiles: drop ±% early so the full name can claim the height budget.
  const cramped = w < 72 || h < 44;
  let showRate = !omitRate && !cramped && h >= 34;
  const rateBudget = showRate ? Math.min(MAX_RATE + 2, innerH * 0.18) : 0;
  const nameBudget = Math.max(ABSOLUTE_NAME_FLOOR, innerH - (showRate ? rateBudget + 3 : 0));

  // Full name only — never prefix-truncate for readability.
  const fitted = densityNameSize({
    text: fullName,
    innerW,
    innerH: nameBudget,
    omitRate: !showRate,
  });
  let nameSize = fitted.size;
  let maxLines = fitted.maxLines;
  let wrappedName = fitted.wrapped;

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
  let wrappedLines = Math.max(1, wrappedName.split("\n").length);
  const nameH = () => nameBlockHeight(nameSize, Math.min(maxLines, wrappedLines));
  let stack = nameH();
  if (usedArtist) stack += gap + artistSize;
  if (usedRate) stack += gap + rateSize;

  // Prefer dropping secondary fields over clipping the name.
  if (stack > innerH && usedArtist) {
    usedArtist = false;
    artistSize = 0;
    stack = nameH() + (usedRate ? gap + rateSize : 0);
  }
  if (stack > innerH && usedRate) {
    usedRate = false;
    rateSize = 0;
    showRate = false;
    // Re-fit name with the recovered height.
    const refit = densityNameSize({
      text: fullName,
      innerW,
      innerH,
      omitRate: true,
    });
    nameSize = refit.size;
    maxLines = refit.maxLines;
    wrappedName = refit.wrapped;
    wrappedLines = Math.max(1, wrappedName.split("\n").length);
    stack = nameH();
  }

  while (stack > innerH && nameSize - 0.25 >= ABSOLUTE_NAME_FLOOR) {
    nameSize -= 0.25;
    stack = nameH();
  }

  const fittedLines = Math.min(maxLines, wrappedLines);
  // Force full name — never ellipsize primary lines.
  let displayName = wrappedName;
  let longest = displayName
    .split("\n")
    .reduce(
      (best, line) =>
        measureTextWidth(line, nameSize) > measureTextWidth(best, nameSize) ? line : best,
      "",
    );
  while (nameSize - 0.25 >= ABSOLUTE_NAME_FLOOR && measureTextWidth(longest, nameSize) > innerW) {
    nameSize -= 0.25;
  }

  // Verify every glyph of the canonical name is present (no abbreviation).
  const paintedCompact = displayName.replace(/\s+/g, "");
  const fullCompact = fullName.replace(/\s+/g, "");
  if (paintedCompact !== fullCompact) {
    displayName = softWrapHeatmapName(fullName, maxLines);
  }

  const displayArtist =
    usedArtist && artist ? ellipsizeSecondary(artist, artistSize, innerW) : "";
  const displayRate = usedRate ? ellipsizeSecondary(rateText, rateSize, innerW) : "";
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

  // Soft size ceiling, then enforce painted-name area ≤ 25% of the tile box.
  const sizeCap = maxNameSizeForTile(w, h);
  nameSize = Math.min(sizeCap, Math.max(ABSOLUTE_NAME_FLOOR, nameSize));
  // Re-balance wrap at the capped size, then shrink until width + area budgets pass.
  wrappedName = softWrapHeatmapName(fullName, Math.min(2, maxLines));
  wrappedLines = Math.max(1, wrappedName.split("\n").length);
  let nameRows = wrappedName.split("\n");
  let longestRow = nameRows.reduce(
    (best, line) =>
      measureTextWidth(line, nameSize) > measureTextWidth(best, nameSize) ? line : best,
    "",
  );
  while (nameSize - 0.25 >= ABSOLUTE_NAME_FLOOR && measureTextWidth(longestRow, nameSize) > innerW) {
    nameSize -= 0.25;
  }
  nameSize = shrinkNameToAreaBudget(nameSize, nameRows, w, h, ABSOLUTE_NAME_FLOOR);
  // Width may need one more pass after area shrink (same glyphs, smaller size is fine).
  longestRow = nameRows.reduce(
    (best, line) =>
      measureTextWidth(line, nameSize) > measureTextWidth(best, nameSize) ? line : best,
    "",
  );
  while (nameSize - 0.25 >= ABSOLUTE_NAME_FLOOR && measureTextWidth(longestRow, nameSize) > innerW) {
    nameSize -= 0.25;
  }
  // Re-apply area budget after width pass, then publish the wrap we sized against.
  nameSize = shrinkNameToAreaBudget(nameSize, nameRows, w, h, ABSOLUTE_NAME_FLOOR);
  // Floor to 0.1px so rounding up cannot push painted area back over 25%.
  nameSize = Math.floor(nameSize * 10) / 10;
  nameSize = shrinkNameToAreaBudget(nameSize, nameRows, w, h, ABSOLUTE_NAME_FLOOR);
  const publishedName = nameRows.join("\n");
  const publishedLines = Math.max(1, nameRows.length);

  return {
    showName: true,
    showRate: usedRate,
    showType: combine,
    showMeta: usedArtist,
    name: publishedName,
    rate: displayRate,
    meta: displayArtist,
    nameSize,
    rateSize: Math.round(rateSize * 10) / 10,
    typeSize: Math.round(rateSize * 10) / 10,
    metaSize: Math.round(artistSize * 10) / 10,
    nameLines: publishedLines,
    padX,
    padY: 4,
    nameY: Math.round(nameY * 10) / 10,
    rateY: Math.round(rateY * 10) / 10,
    typeY: Math.round(rateY * 10) / 10,
    metaY: Math.round(artistY * 10) / 10,
  };
}
