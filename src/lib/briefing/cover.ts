import type { BriefingArticle } from "@/lib/types";

/**
 * Article covers are disabled site-wide — text-only briefings and columns.
 * Strips any persisted coverImage and never assigns a new one.
 */
export function withBriefingCover(
  article: BriefingArticle,
  _options?: { keyword?: string; imageUrl?: string },
): BriefingArticle {
  if (!article.coverImage) return article;
  const { coverImage: _removed, ...rest } = article;
  return rest;
}
