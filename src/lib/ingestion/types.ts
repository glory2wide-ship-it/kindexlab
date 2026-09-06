import type {
  AffiliateProduct,
  EntityType,
  MarketIndex,
  Measurement,
  RankingEntity,
} from "@/lib/types";

export interface ChartRow {
  rank: number;
  previousRank?: number;
  title: string;
  subtitle?: string;
  /**
   * Scoring input. Its meaning varies by source and several sources synthesise
   * it from the rank, so it feeds the index but must never be quoted as a fact.
   * Use `measurement` for anything user-facing.
   */
  metric?: number;
  volume?: number;
  /** The source's published number, set only when it is a real observation. */
  measurement?: Omit<Measurement, "observedAt" | "changeRate">;
  imageUrl?: string;
  tags?: string[];
}

export interface SourceResult {
  id: string;
  label: string;
  ok: boolean;
  count: number;
  error?: string;
  fetchedAt: string;
  items: ChartRow[];
}

export interface IngestSnapshot {
  updatedAt: string;
  status: "open" | "closed";
  sources: { id: string; ok: boolean; count: number; error?: string }[];
  indices: MarketIndex[];
  items: RankingEntity[];
  scoreHistory: Record<string, number[]>;
  /**
   * Observed values per slug, oldest first, timestamped so a real change rate
   * can be computed across ingests. Kept separate from `scoreHistory`, which
   * holds derived index values and so cannot answer "did the rating move".
   */
  measurementHistory?: Record<string, MeasurementPoint[]>;
}

export interface MeasurementPoint {
  /** ISO time of the observation. */
  t: string;
  /** Value in the unit the source published. */
  v: number;
}

export interface CatalogMatch {
  slug: string;
  name: string;
  nameEn: string;
  type: EntityType;
  products: AffiliateProduct[];
  tags: string[];
}

export interface IngestReport {
  updatedAt: string;
  persisted: boolean;
  usedPreviousSnapshot: boolean;
  sources: SourceResult["id"][];
  sourceResults: Pick<SourceResult, "id" | "ok" | "count" | "error">[];
  itemCount: number;
  payload: import("@/lib/types").RankingsPayload;
}
