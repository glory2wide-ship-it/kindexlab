import { hasBriefingBoilerplate, hasGenericPadding, hasLeakedMetadata, hasRepetitiveDeclarativeEndings, hasTemplateConnectiveSpam } from "@/lib/editorial/rules";
import { BRIEFING_SHORTS_MIN_CHARS } from "@/lib/premium/briefing-editorial";
import { premiumCharCount } from "@/lib/premium/prompt";
import type { BriefingArticle } from "@/lib/types";

/** Flattens a briefing article into one string for quality checks. */
export function briefingPlainText(article: Pick<BriefingArticle, "title" | "excerpt" | "sections" | "faq">): string {
  const faqText = article.faq?.flatMap((item) => [item.question, item.answer]).join(" ") ?? "";
  return [
    article.title,
    article.excerpt,
    faqText,
    ...article.sections.flatMap((section) => [section.heading ?? "", ...section.paragraphs]),
  ]
    .join(" ")
    .trim();
}

/**
 * Persisted and live briefings must be OpenAI columns, not `editorial/copy.ts`
 * template padding. Template drafts are kept only as generation shells.
 */
export function isPersistableBriefing(article: BriefingArticle): boolean {
  const plain = briefingPlainText(article);
  if (hasTemplateConnectiveSpam(plain, 1)) return false;
  if (hasBriefingBoilerplate(plain)) return false;
  if (hasRepetitiveDeclarativeEndings(plain)) return false;
  if (hasGenericPadding(plain)) return false;
  if (hasLeakedMetadata(plain)) return false;
  if (premiumCharCount(plain) < BRIEFING_SHORTS_MIN_CHARS) return false;
  return true;
}
