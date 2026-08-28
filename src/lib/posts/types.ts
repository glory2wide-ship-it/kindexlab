import type { AffiliateProduct, BriefingCoverImage } from "@/lib/types";

export type PostSlot = "morning" | "afternoon" | "evening";

export type PostChannel = "entertainment" | "economy" | "politics" | "culture";

export interface PostSection {
  heading: string;
  headingLevel: 2 | 3;
  paragraphs: string[];
  kind?: "tape" | "briefing";
}

export interface MarketFact {
  id: string;
  label: string;
  ok: boolean;
  summary: string;
}

export interface PostTable {
  caption: string;
  headers: string[];
  rows: string[][];
  markdown?: string;
}

export interface PostFaq {
  question: string;
  answer: string;
}

export interface PostLink {
  href: string;
  label: string;
  rel?: string;
}

export interface GeneratedPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  slot: PostSlot;
  channel: PostChannel;
  editionDate: string;
  wordCount: number;
  characterCount: number;
  readingMinutes: number;
  focusKeyword: string;
  supportKeyword: string;
  table: PostTable;
  faq: PostFaq[];
  externalLink: PostLink;
  internalLink: PostLink;
  sources: MarketFact[];
  products?: AffiliateProduct[];
  sections: PostSection[];
  coverImage?: BriefingCoverImage;
}
