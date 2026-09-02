import { analysisLogger } from "@/lib/analysis/log";
import { llmConfigured } from "@/lib/analysis/chain/llm";
import { generatePremiumArticle } from "@/lib/premium/generate";
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

/**
 * Replaces the deterministic board-summary main briefing with a premium OpenAI
 * column when retrieval + the LLM chain succeed. Falls back to the template draft.
 */
export async function enrichMainBriefingWithAi(
  draft: BriefingArticle,
  options: {
    leadKeyword: string;
    relatedKeywords?: string[];
  },
): Promise<BriefingArticle> {
  if (!llmConfigured()) return draft;

  const keyword = options.leadKeyword.trim() || draft.focusKeyword || draft.title;
  const result = await generatePremiumArticle({
    keyword,
    slug: draft.slug,
    category: draft.channel,
    related: options.relatedKeywords,
    logger: analysisLogger(`briefing:${draft.slug}`),
    timeoutMs: 120_000,
    publishedAt: draft.publishedAt,
  });

  if (!result.ok) return draft;

  const article = result.article;
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
    internalLink: article.internalLink,
    focusKeyword: keyword,
    supportKeyword: options.relatedKeywords?.[0] ?? draft.supportKeyword,
    wordCount,
    readingMinutes: Math.max(5, Math.round(wordCount / 180)),
    updatedAt: new Date().toISOString(),
  };
}
