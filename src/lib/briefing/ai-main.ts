import { analysisLogger } from "@/lib/analysis/log";
import { llmConfigured } from "@/lib/analysis/chain/llm";
import { generatePremiumArticle, type PremiumArticle } from "@/lib/premium/generate";
import { delay } from "@/lib/premium/batch";
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

function mergePremiumDraft(draft: BriefingArticle, article: PremiumArticle, keyword: string): BriefingArticle {
  const sections = mapSections(article.sections);
  const wordCount = Math.max(
    draft.wordCount ?? 0,
    article.characterCount,
    sections
      .flatMap((section) => [section.heading ?? "", ...section.paragraphs])
      .join(" ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length,
  );

  return {
    ...draft,
    title: article.title.includes(keyword) ? article.title : draft.title,
    excerpt: article.excerpt || draft.excerpt,
    sections: sections.length ? sections : draft.sections,
    table: article.table,
    faq: article.faq,
    externalLink: article.externalLink,
    internalLink: article.internalLink ?? draft.internalLink,
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
  const peers = edition.filter((item) => item.slug !== article.slug);
  if (article.kind === "main") {
    return peers
      .map((item) => item.focusKeyword)
      .filter((keyword): keyword is string => Boolean(keyword?.trim()))
      .slice(0, 5);
  }
  const sameChannel = peers.filter((item) => item.channel === article.channel);
  const boardPeers = sameChannel
    .filter((item) => item.kind === "deep-dive")
    .map((item) => item.focusKeyword)
    .filter((keyword): keyword is string => Boolean(keyword?.trim()));
  return [...new Set(boardPeers)].filter((keyword) => keyword !== article.focusKeyword).slice(0, 4);
}

function enrichmentCategoryHint(article: BriefingArticle): string {
  if (article.kind === "main") return article.channel ?? "entertainment";
  return article.deskLabel ?? article.focusKeyword ?? article.channel ?? "entertainment";
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
  if (!llmConfigured()) return draft;

  const keyword = options?.leadKeyword?.trim() || enrichmentLeadKeyword(draft);
  const logger = analysisLogger(`briefing:${draft.slug}`);
  const request = () =>
    generatePremiumArticle({
      keyword,
      slug: draft.slug,
      category: options?.categoryHint ?? enrichmentCategoryHint(draft),
      related: options?.relatedKeywords,
      logger,
      timeoutMs: 180_000,
      publishedAt: draft.publishedAt,
    });

  let result = await request();
  if (!result.ok) {
    await delay(90_000);
    result = await request();
  }

  if (!result.ok) return draft;
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
  if (!llmConfigured() || !articles.length) return articles;

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
