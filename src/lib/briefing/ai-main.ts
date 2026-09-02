import { analysisLogger } from "@/lib/analysis/log";
import { openaiConfigured } from "@/lib/analysis/chain/llm";
import { briefingRelatedKeywords } from "@/lib/premium/briefing-editorial";
import { generatePremiumArticle, type PremiumArticle } from "@/lib/premium/generate";
import { articleWordCount } from "@/lib/premium/seo-format";
import { delay } from "@/lib/premium/batch";
import {
  dropRepeatedSentences,
  hasBriefingBoilerplate,
  hasGenericPadding,
  hasLeakedMetadata,
  hasRepetitiveDeclarativeEndings,
  hasTemplateConnectiveSpam,
} from "@/lib/editorial/rules";
import type { BriefingArticle, BriefingSection } from "@/lib/types";

function mapSections(
  sections: { heading: string; headingLevel: 2 | 3; paragraphs: string[] }[],
): BriefingSection[] {
  return sections.map((section, index) => ({
    heading: section.heading,
    headingLevel: section.headingLevel,
    paragraphs: section.paragraphs,
    kind: index === 0 ? "tape" : "briefing",
  }));
}

function cleanPremiumSections(sections: PremiumArticle["sections"]): PremiumArticle["sections"] {
  const seen = new Set<string>();
  return sections.map((section) => ({
    ...section,
    paragraphs: section.paragraphs
      .map((paragraph) => dropRepeatedSentences(paragraph, seen))
      .filter(Boolean),
  }));
}

function mergePremiumDraft(draft: BriefingArticle, article: PremiumArticle, keyword: string): BriefingArticle {
  const sections = mapSections(cleanPremiumSections(article.sections));
  const wordCount = articleWordCount({
    title: article.title.trim() || draft.title,
    excerpt: article.excerpt || draft.excerpt,
    sections,
    faq: article.faq ?? [],
    table: article.table,
  });

  return {
    ...draft,
    title: article.title.trim() || draft.title,
    excerpt: article.excerpt || draft.excerpt,
    sections: sections.length ? sections : draft.sections,
    table: article.table,
    faq: article.faq,
    externalLink: article.externalLink,
    internalLink: article.internalLink ?? draft.internalLink,
    bodyHtml: article.bodyHtml,
    bodyMarkdown: article.bodyMarkdown,
    focusKeyword: keyword,
    supportKeyword: draft.supportKeyword,
    wordCount,
    readingMinutes: Math.max(5, Math.round(wordCount / 180)),
    updatedAt: new Date().toISOString(),
  };
}

function enrichmentLeadKeyword(article: BriefingArticle): string {
  return article.focusKeyword?.trim() || article.title;
}

function enrichmentRelatedKeywords(article: BriefingArticle, edition: BriefingArticle[]): string[] {
  return briefingRelatedKeywords(article, edition);
}

function enrichmentCategoryHint(article: BriefingArticle): string {
  if (article.kind === "main") return article.channel ?? "entertainment";
  return article.category ?? article.deskLabel ?? article.channel ?? "entertainment";
}

function passesBriefingQualityGate(plain: string): boolean {
  if (hasTemplateConnectiveSpam(plain, 1)) return false;
  if (hasBriefingBoilerplate(plain)) return false;
  if (hasRepetitiveDeclarativeEndings(plain)) return false;
  if (hasGenericPadding(plain)) return false;
  if (hasLeakedMetadata(plain)) return false;
  return true;
}

/**
 * Replaces a template briefing draft with a premium OpenAI column when retrieval
 * and the LLM chain succeed. Falls back to the draft on any failure.
 */
export async function enrichBriefingWithAi(
  draft: BriefingArticle,
  options?: {
    leadKeyword?: string;
    relatedKeywords?: string[];
    categoryHint?: string;
  },
): Promise<BriefingArticle> {
  if (!openaiConfigured()) return draft;

  const keyword = options?.leadKeyword?.trim() || enrichmentLeadKeyword(draft);
  const logger = analysisLogger(`briefing:${draft.slug}`);
  const request = () =>
    generatePremiumArticle({
      keyword,
      slug: draft.slug,
      channel: draft.channel,
      category: options?.categoryHint ?? enrichmentCategoryHint(draft),
      related: options?.relatedKeywords,
      logger,
      timeoutMs: 360_000,
      publishedAt: draft.publishedAt,
      briefing: true,
    });

  let result = await request();
  if (!result.ok) {
    logger.warn("briefing-enrich-fail", { reason: result.reason, detail: result.detail });
    const retryable =
      result.reason === "llm-empty" ||
      result.reason === "malformed" ||
      result.reason === "too-short" ||
      result.reason === "banned-copy" ||
      result.reason === "keyword-stuffing";
    if (retryable) {
      await delay(8_000);
      result = await request();
      if (!result.ok) {
        logger.warn("briefing-enrich-retry-fail", { reason: result.reason, detail: result.detail });
      }
    }
  }

  if (!result.ok || result.article.characterCount < 700) return draft;
  const plain = [
    result.article.title,
    result.article.excerpt,
    ...result.article.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    ...(result.article.faq?.flatMap((item) => [item.question, item.answer]) ?? []),
  ].join(" ");
  if (!passesBriefingQualityGate(plain)) return draft;
  return mergePremiumDraft(draft, result.article, keyword);
}

/** @deprecated Use enrichBriefingWithAi */
export async function enrichMainBriefingWithAi(
  draft: BriefingArticle,
  options: {
    leadKeyword: string;
    relatedKeywords?: string[];
  },
): Promise<BriefingArticle> {
  return enrichBriefingWithAi(draft, {
    leadKeyword: options.leadKeyword,
    relatedKeywords: options.relatedKeywords,
    categoryHint: draft.channel,
  });
}


/** Briefing editions run many premium calls back-to-back; keep concurrency low. */
const BRIEFING_AI_BATCH_SIZE = 1;
const BRIEFING_AI_BATCH_DELAY_MS = 3_000;

/** Enriches every article in a channel edition (main + deep-dives) via OpenAI. */
export async function enrichChannelEditionWithAi(articles: BriefingArticle[]): Promise<BriefingArticle[]> {
  if (!openaiConfigured() || !articles.length) return articles;

  const enriched: BriefingArticle[] = [];

  for (let index = 0; index < articles.length; index += BRIEFING_AI_BATCH_SIZE) {
    const batch = articles.slice(index, index + BRIEFING_AI_BATCH_SIZE);
    const settled = await Promise.all(
      batch.map((draft) =>
        enrichBriefingWithAi(draft, {
          leadKeyword: enrichmentLeadKeyword(draft),
          relatedKeywords: enrichmentRelatedKeywords(draft, articles),
          categoryHint: enrichmentCategoryHint(draft),
        }),
      ),
    );
    enriched.push(...settled);
    if (index + BRIEFING_AI_BATCH_SIZE < articles.length && BRIEFING_AI_BATCH_DELAY_MS > 0) {
      await delay(BRIEFING_AI_BATCH_DELAY_MS);
    }
  }

  return enriched;
}
