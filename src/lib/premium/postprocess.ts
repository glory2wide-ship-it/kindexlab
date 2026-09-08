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
import { toHonorificProse } from "@/lib/editorial/honorific";
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
  { test: /애드센스\s*고품질\s*본문\s*기준\s*충족/g, to: "" },
  { test: /고품질\s*본문\s*기준\s*충족/g, to: "" },
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
    { test: /주목(받|되)고\s*(있|계)\S*/g, to: "화제가 됐습니다" },
    { test: /귀추\S*\s*주목\S*/g, to: "후속 결과가 관건입니다" },
    { test: /다양한\s*(관점|시각)\S*\s*(존재|있)\S*/g, to: "해석이 갈립니다" },
    { test: /지켜볼\s*필요\S*\s*있\S*/g, to: "추가 확인이 필요합니다" },
    { test: /새로운\s*패러다임/g, to: "다른 흐름" },
    { test: /심층\s*분석/g, to: "분석" },
    { test: /주목할\s*만한/g, to: "눈에 띄는" },
    { test: /화제가\s*되(고|는)/g, to: "화제가 된" },
    { test: /관심이\s*집중/g, to: "관심이 모였습니다" },
  ];
  for (const rule of soft) out = out.replace(rule.test, rule.to);
  return out;
}

/**
 * Repair truncated Korean endings like "시점맙니다" that models sometimes emit
 * mid-clause. Prefer joining particles over a bare "입니다" when the next clause continues.
 */
export function scrubBrokenPredicateEndings(text: string): string {
  let out = text;
  const contextual: { test: RegExp; to: string }[] = [
    { test: /시점맙니다\.\s*/g, to: "시점에 " },
    { test: /시기맙니다\.\s*/g, to: "시기에 " },
    { test: /요일맙니다\.\s*/g, to: "요일마다 " },
    { test: /수요일맙니다\.\s*/g, to: "수요일마다 " },
    { test: /때맙니다\.\s*/g, to: "때마다 " },
    { test: /순간맙니다\.\s*/g, to: "순간에 " },
    { test: /시즌맙니다\.\s*/g, to: "시즌에 " },
    { test: /도시맙니다\.\s*/g, to: "도시마다 " },
    { test: /시설맙니다\.\s*/g, to: "시설마다 " },
    { test: /이벤트맙니다\.\s*/g, to: "이벤트마다 " },
    { test: /음원맙니다\.\s*/g, to: "음원마다 " },
    { test: /곡맙니다\.\s*/g, to: "곡마다 " },
    { test: /동선맙니다\.\s*/g, to: "동선마다 " },
    { test: /운전자맙니다\.\s*/g, to: "운전자마다 " },
    { test: /국면맙니다\.\s*/g, to: "국면에서 " },
    { test: /행보맙니다\.\s*/g, to: "행보에서 " },
    { test: /업데이트맙니다\.\s*/g, to: "업데이트가 " },
    { test: /무대맙니다\.\s*/g, to: "무대마다 " },
    { test: /미술관맙니다\.\s*/g, to: "미술관마다 " },
    { test: /플랫폼맙니다\.\s*/g, to: "플랫폼마다 " },
    { test: /차주맙니다\.\s*/g, to: "차주에 " },
    { test: /명절맙니다\.\s*/g, to: "명절에 " },
    { test: /주말맙니다\.\s*/g, to: "주말에 " },
    { test: /지자체맙니다\.\s*치열해졌습니다\./g, to: "지자체마다 치열해졌습니다." },
    { test: /지자체맙니다\.\s*/g, to: "지자체마다 " },
    // Fallback: noun+맙니다 → noun+입니다 (never a valid Korean predicate by itself).
    { test: /([\uac00-\ud7a3])맙니다/g, to: "$1입니다" },
  ];
  for (const rule of contextual) out = out.replace(rule.test, rule.to);
  return out;
}

const BARE_YEAR_IN_NUMBERED_HEADING = /([❶❷❸❹❺❻❼❽])\s*년(\s+)/g;

/** Recover missing digits before 년 in numbered headings (e.g. "❶ 년 가을" → "❶ 2026년 가을"). */
export function repairMissingYearDigits(
  text: string,
  opts?: { editionDate?: string | null; title?: string | null },
): string {
  // Note: do not use \b after Hangul — JS word boundaries ignore CJK.
  if (!/[❶❷❸❹❺❻❼❽]\s*년(?:\s|$|<)/.test(text)) return text;

  const editionYear = (opts?.editionDate || "").match(/^(20\d{2})/)?.[1] ?? "";
  const title = opts?.title || "";
  const titleYear = title.match(/(20\d{2})\s*년/)?.[1] ?? "";
  const durationYear = title.match(/(\d{1,2})\s*년\s*치/)?.[1] ?? "";

  return text.replace(
    BARE_YEAR_IN_NUMBERED_HEADING,
    (full, mark: string, space: string, offset: number, source: string) => {
      const after = source.slice(offset + full.length, offset + full.length + 4);
      if (after.startsWith("치") && durationYear) {
        return `${mark} ${durationYear}년${space}`;
      }
      const year = titleYear || editionYear;
      if (!year) return full;
      return `${mark} ${year}년${space}`;
    },
  );
}

/** Drop checklist / “확인해야 할 N가지” padding sentences without an LLM round-trip. */
const GENERIC_PADDING_SENTENCE =
  /(?:체크리스트|실행\s*체크리스트|독자가\s*(?:먼저|반드시)\s*확인|확인해야\s*할\s*(?:N|몇|\d+)|꼼꼼히\s*점검)/i;

export function scrubGenericPaddingProse(text: string): string {
  const parts = text
    .split(/(?<=[.!?。…]|\n)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !GENERIC_PADDING_SENTENCE.test(part));
  return parts.join(" ").replace(/\s{2,}/g, " ").trim();
}

/** Full free post-process for a single prose field. */
export function autoCorrectProse(
  text: string,
  opts?: { editionDate?: string | null; title?: string | null },
): string {
  return ensureSentencePunctuation(
    toHonorificProse(
      scrubBannedPhraseStems(
        scrubGenericPaddingProse(
          scrubBoilerplatePhrases(
            repairMissingYearDigits(scrubBrokenPredicateEndings(normalizeWhitespace(text)), opts),
          ),
        ),
      ),
    ),
  );
}

export function autoCorrectArticleFields(input: {
  title: string;
  excerpt: string;
  sections: SeoSection[];
  faq: PostFaq[];
  editionDate?: string | null;
}): {
  title: string;
  excerpt: string;
  sections: SeoSection[];
  faq: PostFaq[];
} {
  const yearOpts = { editionDate: input.editionDate, title: input.title };
  const title = repairMissingYearDigits(
    scrubBannedPhraseStems(scrubBoilerplatePhrases(normalizeWhitespace(input.title))),
    yearOpts,
  );
  const excerpt = autoCorrectProse(input.excerpt, yearOpts);
  const sections = polishArticleSections(
    input.sections.map((section) => ({
      ...section,
      heading: section.heading
        ? repairMissingYearDigits(
            scrubBannedPhraseStems(scrubBoilerplatePhrases(normalizeWhitespace(section.heading))),
            yearOpts,
          )
        : section.heading,
      paragraphs: section.paragraphs.map((paragraph) =>
        toHonorificProse(
          scrubBannedPhraseStems(scrubBoilerplatePhrases(scrubBrokenPredicateEndings(paragraph))),
        ),
      ),
    })),
  );
  const faq = polishFaq(
    input.faq.map((item) => ({
      question: scrubBoilerplatePhrases(item.question),
      answer: toHonorificProse(
        scrubBannedPhraseStems(scrubBoilerplatePhrases(scrubBrokenPredicateEndings(item.answer))),
      ),
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

