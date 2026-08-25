import type { AffiliateProduct, EntityType, MarketIndex, RankingEntity } from "@/lib/types";

export interface ChartRow {
  rank: number;
  previousRank?: number;
  title: string;
  subtitle?: string;
  metric?: number;
  volume?: number;
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
