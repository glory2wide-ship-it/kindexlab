import type { BriefingArticle } from "@/lib/types";
import { ensureSectionsDisclaimer } from "@/lib/editorial/disclaimer";

/**
 * Article covers are disabled site-wide — text-only briefings and columns.
 * Strips any persisted coverImage and never assigns a new one.
 * Also guarantees the trend-analysis disclaimer on every briefing body.
 */
export function withBriefingCover(
  article: BriefingArticle,
  _options?: { keyword?: string; imageUrl?: string },
): BriefingArticle {
  const sections = ensureSectionsDisclaimer(article.sections ?? []);
  if (!article.coverImage) {
    return sections === article.sections ? article : { ...article, sections };
  }
  const { coverImage: _removed, ...rest } = article;
  return { ...rest, sections };
}
