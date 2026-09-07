/**
 * Hard floor for reader-facing editorial content.
 * Anything before 2026-09-04 00:00 KST must never reach visitors.
 */
export const PUBLIC_CONTENT_SINCE_DATE = "2026-09-04";
export const PUBLIC_CONTENT_SINCE_ISO = "2026-09-04T00:00:00+09:00";

const CUTOFF_MS = Date.parse(PUBLIC_CONTENT_SINCE_ISO);

const ADSENSE_QUALITY_PHRASE =
  /애드센스\s*고품질\s*본문\s*기준\s*충족|고품질\s*본문\s*기준\s*충족/g;

function stamp(value?: string | null): number | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * True when this edition/timestamp is allowed on public surfaces.
 * Prefer editionDate (KST calendar day); fall back to created/published stamps.
 */
export function isPublicEditorialContent(input: {
  editionDate?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  generatedAt?: string | null;
}): boolean {
  const edition = input.editionDate?.trim();
  if (edition && /^\d{4}-\d{2}-\d{2}$/.test(edition)) {
    return edition >= PUBLIC_CONTENT_SINCE_DATE;
  }
  const ms =
    stamp(input.generatedAt) ?? stamp(input.updatedAt) ?? stamp(input.publishedAt);
  if (ms == null) return false;
  return ms >= CUTOFF_MS;
}

/** Strip internal AdSense QA phrases that must never appear in reader copy. */
export function scrubAdsenseQualityPhrase(text: string): string {
  if (!text) return text;
  return text.replace(ADSENSE_QUALITY_PHRASE, "").replace(/[ \t]{2,}/g, " ");
}

export function contentContainsAdsenseQualityPhrase(text: string): boolean {
  ADSENSE_QUALITY_PHRASE.lastIndex = 0;
  return ADSENSE_QUALITY_PHRASE.test(text);
}
