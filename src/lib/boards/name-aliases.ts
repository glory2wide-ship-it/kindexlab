import { normalizeName } from "@/lib/ingestion/names";

/**
 * EN ↔ KR artist/group aliases for heatmap dedupe (especially K POP).
 * Canonical key prefers the Hangul form when one exists.
 */
const ALIAS_GROUPS: string[][] = [
  ["에스파", "aespa"],
  ["아이브", "ive"],
  ["뉴진스", "newjeans", "new jeans"],
  ["르세라핌", "le sserafim", "lesserafim"],
  ["아일릿", "illit"],
  ["베이비몬스터", "babymonster", "baemon"],
  ["라이즈", "riize"],
  ["투어스", "tws"],
  ["보이넥스트도어", "boynextdoor", "boy next door"],
  ["스트레이 키즈", "stray kids", "straykids", "skz"],
  ["엔하이픈", "enhypen"],
  ["세븐틴", "seventeen", "svt"],
  ["블랙핑크", "blackpink", "black pink"],
  ["방탄소년단", "bts", "bangtan"],
  ["(여자)아이들", "gidle", "(g)i-dle", "g-idle", "여자아이들"],
  ["투모로우바이투게더", "txt", "tomorrow x together", "투바투"],
  ["엔시티 드림", "nct dream", "nct드림", "nct 드림"],
  ["엔시티 127", "nct 127", "nct127"],
  ["엔시티 위시", "nct wish", "nctwish"],
  ["제로베이스원", "zerobaseone", "zb1"],
  ["키스오브라이프", "kiss of life", "kissoflife"],
  ["넥스지", "nexz"],
  ["아이유", "iu"],
  ["리센느", "rescene", "re scene"],
  ["키키", "kiki"],
  ["있지", "itzy"],
  ["에이티즈", "ateez"],
  ["더보이즈", "the boyz", "theboyz"],
  ["프로미스나인", "fromis 9", "fromis9"],
  ["케플러", "kep1er"],
  ["아이즈원", "izone", "iz*one"],
  ["오마이걸", "oh my girl", "ohmygirl"],
  ["레드벨벳", "red velvet", "redvelvet"],
  ["트와이스", "twice"],
  ["엑소", "exo"],
  ["엔믹스", "nmixx"],
  ["싸이", "psy"],
  ["빅뱅", "bigbang", "big bang"],
  ["동방신기", "tvxq", "dbsg"],
  ["슈퍼주니어", "super junior", "superjunior"],
];

const CANONICAL_BY_ALIAS = new Map<string, string>();

function aliasKey(value: string): string {
  return normalizeName(value);
}

for (const group of ALIAS_GROUPS) {
  const hangul = group.find((item) => /[가-힣]/.test(item)) ?? group[0]!;
  const canonical = aliasKey(hangul);
  for (const item of group) {
    CANONICAL_BY_ALIAS.set(aliasKey(item), canonical);
  }
}

/** True when the display name is mostly Latin (EN label on a KR desk). */
export function isMostlyLatinName(name: string): boolean {
  const letters = name.replace(/[^A-Za-z가-힣]/g, "");
  if (!letters) return false;
  const latin = letters.replace(/[^A-Za-z]/g, "").length;
  return latin / letters.length >= 0.6;
}

export function hasHangulName(name: string): boolean {
  return /[가-힣]/.test(name);
}

/**
 * Stable heatmap identity for EN/KR duplicates (e.g. RESCENE / 리센느).
 * Also folds "Name (한글)" / "한글 (Name)" into one key.
 */
export function canonicalEntityNameKey(name: string): string {
  const trimmed = name.trim();
  const withoutBrackets = trimmed.replace(/^\[[^\]]+\]\s*/, "");
  const paren = withoutBrackets.match(
    /^(.+?)\s*[\(（]\s*([^\)）]+)\s*[\)）]\s*$/,
  );
  const candidates = paren
    ? [paren[1]!, paren[2]!, withoutBrackets]
    : [withoutBrackets];

  for (const candidate of candidates) {
    const key = aliasKey(candidate);
    const mapped = CANONICAL_BY_ALIAS.get(key);
    if (mapped) return mapped;
  }

  // Prefer Hangul token inside parentheses as the identity when present.
  if (paren) {
    const hangulSide = [paren[1]!, paren[2]!].find((part) => hasHangulName(part));
    if (hangulSide) return aliasKey(hangulSide);
  }

  return aliasKey(withoutBrackets);
}

/** Prefer Hangul display names when merging EN/KR duplicates. */
export function preferEntityDisplayName(current: string, incoming: string): string {
  if (hasHangulName(incoming) && isMostlyLatinName(current)) return incoming;
  if (hasHangulName(current)) return current;
  if (hasHangulName(incoming)) return incoming;
  return current.length <= incoming.length ? current : incoming;
}
