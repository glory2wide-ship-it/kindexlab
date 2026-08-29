import type { PostChannel, PostFaq, PostTable } from "@/lib/posts/types";
import type { TodayAnalysisSection } from "@/lib/editorial/today-analysis";

export type GenderSegment = "male" | "female";

export type AgeSegment = "10s" | "20s" | "30s" | "40s" | "50s" | "60s" | "70s";

export type RegionSegment =
  | "seoul"
  | "gyeonggi"
  | "incheon"
  | "busan"
  | "daegu"
  | "gwangju"
  | "daejeon"
  | "ulsan"
  | "sejong"
  | "gangwon"
  | "chungbuk"
  | "chungnam"
  | "jeonbuk"
  | "jeonnam"
  | "gyeongbuk"
  | "gyeongnam"
  | "jeju";

/** Every filter the board UI can be switched to, including the unfiltered view. */
export type SegmentKey = "total" | GenderSegment | AgeSegment;

export interface BoardRankEntry {
  rank: number;
  name: string;
  /** Index score on a 100 point scale. */
  score: number;
  /** Movement against the previous edition, in percent. */
  changeRate: number;
  /** One clause explaining why the entry sits at this rank. */
  note: string;
  /** 시/도 태그. 음식/맛집 랭킹에서 `[서울] 상호` 형식과 함께 저장한다. */
  region?: RegionSegment;
}

export interface DemographicRanking {
  gender: Record<GenderSegment, BoardRankEntry[]>;
  age: Record<AgeSegment, BoardRankEntry[]>;
  /** Present on 음식/맛집 랭킹. Optional so older cached boards still parse. */
  region?: Record<RegionSegment, BoardRankEntry[]>;
}

export interface BoardReport {
  title: string;
  excerpt: string;
  sections: TodayAnalysisSection[];
  table: PostTable;
  faq: PostFaq[];
  /** The mandated "why does this segment care" paragraph block. */
  targetAnalysis: TodayAnalysisSection;
  characterCount: number;
  readingMinutes: number;
}

export interface BoardPump {
  shortsTitle: string;
  /** Spoken lines for a ~15 second vertical short, in ranking format. */
  shortsScript: string[];
  pinnedComment: string;
}

export type BoardSourceKind = "chain" | "template";

export interface BoardProvenance {
  kind: BoardSourceKind;
  newsDocs: number;
  publishers: string[];
  model?: string;
  /** True when the LLM returned a usable demographic block. */
  demographicsFromLlm: boolean;
  buildMs: number;
}

export interface CachedBoard {
  slug: string;
  boardId: string;
  channel: PostChannel;
  title: string;
  editionDate: string;
  generatedAt: string;
  expiresAt: string;
  /** Index value for the board as a whole, on the same 100 point scale. */
  indexValue: number;
  indexChangeRate: number;
  ranking: BoardRankEntry[];
  demographics: DemographicRanking;
  report: BoardReport;
  pump?: BoardPump;
  provenance: BoardProvenance;
}

/** Special politics desks that are not LLM heatmap rankings. */
export type BoardDeskKind = "headlines" | "party-poll" | "politician-poll";

export interface BoardDefinition {
  id: string;
  slug: string;
  channel: PostChannel;
  /** When set, the category rail opens a custom desk instead of the treemap. */
  deskKind?: BoardDeskKind;
  /** Hidden from the category rail / 종합 heatmap but still reachable by URL. */
  railHidden?: boolean;
  /** Menu label, e.g. "재테크 유튜버 영향력 랭킹". */
  title: string;
  /** Short form for tabs and cards. */
  shortTitle: string;
  /** The RAG sourcing rule this board is scored from. */
  criteria: string;
  /** Affiliate product category the widget defaults to. */
  affiliateCategory: string;
  /** Search terms used to pull news context for this board. */
  queries: string[];
  focusKeyword: string;
  supportKeyword: string;
  /** Names used when the LLM is unavailable and the board falls back. */
  seeds: string[];
  /** Label for the ranked unit, e.g. "채널", "종목". */
  unitLabel: string;
  /** Extra ranking-prompt rules (age/gender targeting, banned placeholders). */
  rankGuidance?: string;
  /** Names forced to the front of a gender/age slice. */
  demographicSeeds?: {
    gender?: Partial<Record<GenderSegment, string[]>>;
    age?: Partial<Record<AgeSegment, string[]>>;
  };
  /** Names that must not lead a given gender/age slice. */
  demographicExclude?: {
    always?: string[];
    gender?: Partial<Record<GenderSegment, string[]>>;
    age?: Partial<Record<AgeSegment, string[]>>;
  };
}
