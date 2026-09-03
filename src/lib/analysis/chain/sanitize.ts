/**
 * Cleans a paragraph coming back from the model before it enters the editorial
 * normalizer. That normalizer splits on sentence-final punctuation, so a raw URL
 * ("https://kindexlab.com/...") gets severed at its dots and leaves a broken
 * fragment in the body. Links belong to the article's link fields, not the prose.
 */
import { ensureSentencePunctuation } from "@/lib/premium/seo-format";

export function sanitizeParagraph(raw: string): string {
  return ensureSentencePunctuation(
    raw
      .replace(/!?\[([^\]]*)\]\(([^)]*)\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\s*,\s*\./g, ".")
      .replace(/\s+([.,!?])/g, "$1")
      .replace(/\.{2,}/g, ".")
      .replace(/\s{2,}/g, " ")
      .trim(),
  );
}

export function sanitizeParagraphs(list: string[]): string[] {
  return list.map(sanitizeParagraph).filter(Boolean);
}

/** 자수 of the body, matching how the editorial audit measures length. */
export function bodyCharCount(sections: { paragraphs: string[] }[]): number {
  return sections
    .flatMap((section) => section.paragraphs)
    .join("")
    .replace(/\s+/g, "").length;
}
