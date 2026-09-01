/** Where a context item came from — drives scoring and prompt labelling. */
export type ContextTier = "signal" | "news" | "web" | "youtube";

export interface ContextSource {
  title: string;
  url: string;
  publisher: string;
  publishedAt?: string;
  snippet?: string;
  tier: ContextTier;
}

export interface SignalFact {
  text: string;
  kind: "rank" | "measurement" | "rss" | "peer" | "board" | "trend" | "source";
}

export interface CollectedContext {
  keyword: string;
  /** Citable URLs for E-E-A-T and externalLink validation. */
  sources: ContextSource[];
  /** Non-URL facts from heatmap / ingestion — grounds thin-news keywords. */
  signalFacts: SignalFact[];
  providers: string[];
  /** Injected into LLM user messages. */
  block: string;
  unwrapped: { resolved: number; failed: number };
  lookbackHours: number;
  /** Weighted coverage score; generation requires >= MIN_CONTEXT_SCORE. */
  score: number;
  /** Tier 3: FAQ / section hints only — not treated as verifiable facts. */
  intentHints: string[];
}
