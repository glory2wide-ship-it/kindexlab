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
 * Persisted and live briefings must be LLM columns, not `editorial/copy.ts`
 * template padding. Template drafts are kept only as generation shells.
 */
export function isPersistableBriefing(article: BriefingArticle): boolean {
  const plain = briefingPlainText(article);
  const prose = briefingPlainText({ ...article, title: "" });
  if (hasTemplateConnectiveSpam(prose, 1)) return false;
  if (hasBriefingBoilerplate(prose)) return false;
  if (hasRepetitiveDeclarativeEndings(prose)) return false;
  if (hasGenericPadding(prose)) return false;
  if (hasLeakedMetadata(prose)) return false;
  if (premiumCharCount(plain) < BRIEFING_SHORTS_MIN_CHARS) return false;
  return true;
}
