/**
 * Fact extraction for Today's Analysis was removed.
 * Briefing single-pass RAG (`collectPremiumContext`) replaces the separate
 * facts LLM step. `FactBrief` remains for optional traffic-pump callers.
 */
export interface FactBrief {
  /** Exactly three fact lines: background, why topical, follow-up. */
  facts: string[];
  /** Concrete event names or dates the draft may cite. */
  events: string[];
  /** Outlets the facts came from, for provenance. */
  publishers: string[];
}
