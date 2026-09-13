export function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

/**
 * KinDex desks are Korean/English only. Reject names whose letter mass is
 * primarily another script (Thai, Arabic, Cyrillic, Kana, etc.) so Google
 * Trends / YouTube noise cannot paint foreign-script tiles on heatmaps.
 */
export function isAllowedKrEnEntityName(name: string): boolean {
  const normalized = name.normalize("NFKC").trim();
  if (normalized.length < 2) return false;
  const letters = normalized.replace(/[^\p{L}]/gu, "");
  // Pure digits / punctuation (e.g. "19") are not entity names.
  if (letters.length < 1) return false;
  // Hard-reject even a single glyph from non-KR/EN scripts.
  if (
    /[\u0E00-\u0E7F\u0E80-\u0EFF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0400-\u04FF\u0500-\u052F\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0590-\u05FF\u10A0-\u10FF]/.test(
      letters,
    )
  ) {
    return false;
  }
  const allowed = (letters.match(/[A-Za-z가-힣]/g) ?? []).length;
  // Allow short Hangul labels like "20대" (one letter + digits).
  return allowed >= 1 && allowed / letters.length >= 0.7;
}

export function isDisallowedScriptName(name: string): boolean {
  return !isAllowedKrEnEntityName(name);
}

export function slugify(value: string): string {
  const latin = value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (latin && /^[a-z0-9-]+$/.test(latin) && latin.length >= 2) return latin.slice(0, 60);

  const compact = normalizeName(value).slice(0, 40);
  return compact || `entity-${hash(value)}`;
}

export function hash(input: string): string {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}

export function namesOverlap(a: string, b: string): boolean {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  return left === right || (left.length >= 2 && right.includes(left)) || (right.length >= 2 && left.includes(right));
}
