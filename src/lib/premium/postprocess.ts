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

function plainCharCount(parts: string[]): number {
  return parts.join(" ").replace(/\s+/g, "").length;
}

/**
 * Zero-cost length pad for Today's Analysis when the LLM length-expand call is
 * skipped. Appends grounded seed lines (signal facts / snippets) into the last
 * sections and FAQ answers until minChars, then runs autoCorrect.
 */
export function padArticleLengthLocally(input: {
  title: string;
  excerpt: string;
  sections: SeoSection[];
  faq: PostFaq[];
  keyword: string;
  seedLines: string[];
  minChars: number;
  maxChars: number;
}): {
  title: string;
  excerpt: string;
  sections: SeoSection[];
  faq: PostFaq[];
  added: number;
} {
  const sections = input.sections.map((section) => ({
    ...section,
    paragraphs: [...section.paragraphs],
  }));
  const faq = input.faq.map((item) => ({ ...item }));
  const keyword = input.keyword.trim();
  const seen = new Set<string>();
  const seeds = input.seedLines
    .map((line) => scrubBannedPhraseStems(scrubBoilerplatePhrases(normalizeWhitespace(line))))
    .map((line) => line.replace(/^[-·•\d.\s]+/, "").trim())
    .filter((line) => {
      if (line.length < 12) return false;
      const key = line.slice(0, 48);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const measure = () =>
    plainCharCount([
      input.title,
      input.excerpt,
      ...sections.flatMap((section) => [section.heading ?? "", ...section.paragraphs]),
      ...faq.flatMap((item) => [item.question ?? "", item.answer ?? ""]),
    ]);

  let chars = measure();
  let added = 0;
  let seedIndex = 0;
  let guard = 0;

  while (chars < input.minChars && guard < 40) {
    guard += 1;
    const raw = seeds[seedIndex++];
    if (!raw) break;

    let sentence = ensureSentencePunctuation(raw);
    if (!sentence.includes(keyword) && keyword.length >= 2 && sentence.length < 80) {
      sentence = ensureSentencePunctuation(`${keyword} 관련해 ${sentence}`);
    }
    if (plainCharCount([sentence]) < 12) continue;

    const targetSection = sections[(added + sections.length - 1) % Math.max(sections.length, 1)];
    if (targetSection) {
      targetSection.paragraphs.push(sentence);
      added += 1;
    } else if (faq[added % Math.max(faq.length, 1)]) {
      const item = faq[added % faq.length]!;
      item.answer = ensureSentencePunctuation(`${item.answer} ${sentence}`);
      added += 1;
    } else {
      break;
    }

    chars = measure();
    if (chars > input.maxChars + 80) break;
  }

  // Stretch FAQ answers slightly with already-used section tails when seeds ran out.
  while (chars < input.minChars && faq.length && guard < 48) {
    guard += 1;
    const lastSection = sections[sections.length - 1];
    const donor = lastSection?.paragraphs[lastSection.paragraphs.length - 1];
    if (!donor) break;
    const item = faq[guard % faq.length]!;
    const extra = ensureSentencePunctuation(
      `${keyword} 맥락에서 ${donor.replace(/\.+$/, "").slice(0, 60)} 흐름이 이어진다`,
    );
    if (item.answer.includes(extra.slice(0, 20))) break;
    item.answer = ensureSentencePunctuation(`${item.answer} ${extra}`);
    added += 1;
    chars = measure();
  }

  const corrected = autoCorrectArticleFields({
    title: input.title,
    excerpt: input.excerpt,
    sections,
    faq,
  });

  return { ...corrected, added };
}

