/**
 * Mandatory closing line for every KinDex editorial surface:
 * daily briefings, Update briefings, Update keyword / 오늘의 분석 articles.
 */
export const TREND_ANALYSIS_DISCLAIMER =
  "본 글은 단순 트렌드 분석이며 투자 권유가 아닙니다.";

export function hasTrendDisclaimer(text: string | null | undefined): boolean {
  if (!text) return false;
  return text.includes(TREND_ANALYSIS_DISCLAIMER);
}

/** Append the disclaimer once when the body does not already carry it. */
export function withTrendDisclaimer(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return TREND_ANALYSIS_DISCLAIMER;
  if (hasTrendDisclaimer(trimmed)) return trimmed;
  return `${trimmed}\n\n${TREND_ANALYSIS_DISCLAIMER}`;
}

/** Last-paragraph helper for section-based articles. */
export function ensureDisclaimerParagraph(paragraphs: string[]): string[] {
  const joined = paragraphs.join("\n");
  if (hasTrendDisclaimer(joined)) return paragraphs;
  return [...paragraphs, TREND_ANALYSIS_DISCLAIMER];
}

/** Ensure the disclaimer is the final paragraph of the last section. */
export function ensureSectionsDisclaimer<T extends { paragraphs: string[] }>(
  sections: T[],
): T[] {
  if (!sections.length) return sections;
  const text = sections.flatMap((section) => section.paragraphs).join("\n");
  if (hasTrendDisclaimer(text)) return sections;
  const last = sections[sections.length - 1]!;
  return [
    ...sections.slice(0, -1),
    { ...last, paragraphs: ensureDisclaimerParagraph(last.paragraphs) },
  ];
}
