/**
 * Zero-cost regex / string post-processing for premium briefing copy.
 * Runs before persist so punctuation and mad-lib leftovers never trigger an API retry.
 */

import { PREMIUM_BANNED_PHRASES } from "@/lib/premium/prompt";
import {
  ensureSentencePunctuation,
  polishArticleSections,
  polishFaq,
  polishProseText,
  type SeoSection,
} from "@/lib/premium/seo-format";
import type { PostFaq } from "@/lib/posts/types";

/** Collapses repeated whitespace and stray CJK spaces. */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/[ \t\f\v]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

/**
 * Mad-lib / template scraps that models still paste into prose.
 * Replacements keep meaning without an LLM round-trip.
 */
const BOILERPLATE_REPLACEMENTS: { test: RegExp; to: string }[] = [
  { test: /가\s*지금\s*화제인\s*이유/g, to: "관련 핵심 이슈" },
  { test: /이슈가\s*지금\s*화제인\s*배경/g, to: "이슈의 배경" },
  { test: /화제인\s*이유는\s*유행\s*한\s*줄/g, to: "이슈의 요지는" },
  { test: /결론적으로\s*/g, to: "" },
  { test: /요약하자면[,\s]*/g, to: "" },
  { test: /요약하면[,\s]*/g, to: "" },
  { test: /이\s*글에서는\s*/g, to: "" },
  { test: /본\s*글에서는\s*/g, to: "" },
  { test: /이\s*기사에서는\s*/g, to: "" },
  { test: /알아보았습니다[.!]?\s*/g, to: "" },
  { test: /살펴보겠습니다[.!]?\s*/g, to: "" },
];

export function scrubBoilerplatePhrases(text: string): string {
  let out = text;
  for (const rule of BOILERPLATE_REPLACEMENTS) {
    out = out.replace(rule.test, rule.to);
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Soft replacements for dictionary-form banned stems (cheap first pass). */
export function scrubBannedPhraseStems(text: string): string {
  let out = text;
  const soft: { test: RegExp; to: string }[] = [
    { test: /주목(받|되)고\s*(있|계)\S*/g, to: "화제가 됐다" },
    { test: /귀추\S*\s*주목\S*/g, to: "후속 결과가 관건이다" },
    { test: /다양한\s*(관점|시각)\S*\s*(존재|있)\S*/g, to: "해석이 갈린다" },
    { test: /지켜볼\s*필요\S*\s*있\S*/g, to: "추가 확인이 필요하다" },
    { test: /새로운\s*패러다임/g, to: "다른 흐름" },
    { test: /심층\s*분석/g, to: "분석" },
    { test: /주목할\s*만한/g, to: "눈에 띄는" },
    { test: /화제가\s*되(고|는)/g, to: "화제가 된" },
    { test: /관심이\s*집중/g, to: "관심이 모였다" },
  ];
  for (const rule of soft) out = out.replace(rule.test, rule.to);
  return out;
}

/** Full free post-process for a single prose field. */
export function autoCorrectProse(text: string): string {
  return ensureSentencePunctuation(
    scrubBannedPhraseStems(scrubBoilerplatePhrases(normalizeWhitespace(text))),
  );
}

export function autoCorrectArticleFields(input: {
  title: string;
  excerpt: string;
  sections: SeoSection[];
  faq: PostFaq[];
}): {
  title: string;
  excerpt: string;
  sections: SeoSection[];
  faq: PostFaq[];
} {
  const title = scrubBannedPhraseStems(scrubBoilerplatePhrases(normalizeWhitespace(input.title)));
  const excerpt = autoCorrectProse(input.excerpt);
  const sections = polishArticleSections(
    input.sections.map((section) => ({
      ...section,
      heading: section.heading
        ? scrubBannedPhraseStems(scrubBoilerplatePhrases(normalizeWhitespace(section.heading)))
        : section.heading,
      paragraphs: section.paragraphs.map((paragraph) =>
        scrubBannedPhraseStems(scrubBoilerplatePhrases(paragraph)),
      ),
    })),
  );
  const faq = polishFaq(
    input.faq.map((item) => ({
      question: scrubBoilerplatePhrases(item.question),
      answer: scrubBannedPhraseStems(scrubBoilerplatePhrases(item.answer)),
    })),
  );
  return {
    title: title || input.title,
    excerpt: polishProseText(excerpt),
    sections,
    faq,
  };
}

/** Lists which known banned dictionary forms still appear (after auto-correct). */
export function remainingBannedHits(text: string): string[] {
  return PREMIUM_BANNED_PHRASES.filter((phrase) => text.includes(phrase));
}
