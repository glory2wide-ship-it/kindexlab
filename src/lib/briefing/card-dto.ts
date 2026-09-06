import type { BriefingArticle } from "@/lib/types";

/**
 * Drop heavy body fields before briefing cards cross the RSC → client boundary.
 * Desk cards only read title / excerpt / metadata (~1 KB); full articles ship
 * sections + HTML that bloat every `/{channel}` soft navigation.
 */
export function slimBriefingForCard(article: BriefingArticle): BriefingArticle {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    readingMinutes: article.readingMinutes,
    wordCount: article.wordCount,
    sections: [],
    kind: article.kind,
    category: article.category,
    channel: article.channel,
    deskId: article.deskId,
    deskLabel: article.deskLabel,
    editionDate: article.editionDate,
    relatedEntitySlugs: article.relatedEntitySlugs ?? [],
    focusKeyword: article.focusKeyword,
    supportKeyword: article.supportKeyword,
  };
}

export function slimBriefingsForCards(articles: BriefingArticle[]): BriefingArticle[] {
  return articles.map(slimBriefingForCard);
}
