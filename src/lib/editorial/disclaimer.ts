/**
 * Legacy closing line formerly appended to KinDex editorial surfaces.
 * Kept only so existing copy can be detected and stripped — never re-injected.
 */
export const TREND_ANALYSIS_DISCLAIMER =
  "본 글은 단순 트렌드 분석이며 투자 권유가 아닙니다.";

export function hasTrendDisclaimer(text: string | null | undefined): boolean {
  if (!text) return false;
  return text.includes(TREND_ANALYSIS_DISCLAIMER);
}

/** Remove the legacy disclaimer so section bodies can be judged on real copy. */
export function stripTrendDisclaimer(text: string): string {
  return text
    .split(TREND_ANALYSIS_DISCLAIMER)
    .join(" ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.。])/g, "$1")
    .trim();
}

/** True when the text is empty once the disclaimer is removed. */
export function isTrendDisclaimerOnly(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return !stripTrendDisclaimer(text);
}

/** @deprecated Pass-through that strips — never appends the disclaimer. */
export function withTrendDisclaimer(text: string): string {
  return stripTrendDisclaimer(text);
}

/** Strip disclaimer sentences from paragraph lists (no re-injection). */
export function ensureDisclaimerParagraph(paragraphs: string[]): string[] {
  return paragraphs
    .map((paragraph) => stripTrendDisclaimer(paragraph))
    .filter((paragraph) => paragraph.length > 0);
}

/** Strip the legacy disclaimer from every section (no re-injection). */
export function ensureSectionsDisclaimer<T extends { paragraphs: string[] }>(
  sections: T[],
): T[] {
  return sections
    .map((section) => ({
      ...section,
      paragraphs: ensureDisclaimerParagraph(section.paragraphs),
    }))
    .filter((section) => section.paragraphs.length > 0);
}
