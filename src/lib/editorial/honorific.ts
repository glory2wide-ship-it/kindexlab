/**
 * Convert Korean plain/declarative endings (해라체·한다체) to polite 합니다체.
 * Used in generation post-process and bulk migration of stored articles.
 */

/** Sentence already ends in polite / question form. */
const ALREADY_POLITE =
  /(?:니다|니까|세요|시죠|까요)\s*[.!?…]*\s*$/u;

/** Hangul syllable jongseong index (0 = none). */
function jongseong(char: string): number {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return -1;
  return (code - 0xac00) % 28;
}

function isHangul(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3;
}

export function honorificSpeechRules(): string {
  return [
    "[높임말(합니다체) 필수 — 모든 글·위반 시 유효성 검증 실패]",
    "1. 본문·요약·FAQ·takeaways의 모든 서술 문장은 높임말(합니다체)로 끝내세요: ~습니다/~합니다/~됩니다/~있습니다/~없습니다/~였습니다/~았습니다.",
    "2. 해라체·한다체 금지: ~다/~한다/~된다/~이다/~있다/~없다/~했다/~됐다/~본다/~는다 등으로 문장을 끝내지 마세요.",
    "3. 의문문은 ~까요?/~습니까?만 허용합니다. 명령형(~라/~거라) 금지.",
    "4. 동일 종결(~습니다 등)이 연속 3회 나오지 않도록 ~합니다/~됩니다/~았습니다/~고 있습니다 등으로 리듬을 바꾸세요.",
    "5. 실패 예: '전환점을 상징한다.' → 성공 예: '전환점을 상징합니다.'",
  ].join("\n");
}

export function isAlreadyHonorificSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (!trimmed) return true;
  if (/\?\s*$/.test(trimmed)) return true;
  if (ALREADY_POLITE.test(trimmed)) return true;
  if (!/[.!?…]\s*$/u.test(trimmed) && trimmed.length < 40) return true;
  return false;
}

/**
 * Convert one declarative sentence ending to 합니다체.
 * Operates only on the final …다 / …라 cluster.
 */
export function toHonorificSentence(sentence: string): string {
  const trimmed = sentence.trim();
  if (!trimmed) return sentence;
  if (isAlreadyHonorificSentence(trimmed)) return trimmed;

  const match = trimmed.match(/^(.*?)([가-힣]{1,8})다([.!?…]*)$/u);
  if (!match) {
    // Imperatives
    if (/다뤄라([.!?…]*)$/u.test(trimmed)) return trimmed.replace(/다뤄라([.!?…]*)$/u, "다룹니다$1");
    if (/써라([.!?…]*)$/u.test(trimmed)) return trimmed.replace(/써라([.!?…]*)$/u, "씁니다$1");
    return trimmed;
  }

  const prefix = match[1];
  const tail = match[2]; // chars immediately before 다
  const punct = match[3];
  const last = tail[tail.length - 1]!;
  const batchim = jongseong(last);

  // Fixed phrase / lemma rewrites on the full pre-다 stem.
  const stem = `${tail}`;
  const phraseMap: Record<string, string> = {
    아니: "아닙니다",
    이: "입니다",
    없: "없습니다",
    있: "있습니다",
    됐: "됐습니다",
    되었: "되었습니다",
    된: "됩니다",
    했: "했습니다",
    한: "합니다",
    중: "중입니다",
    탓이: "탓입니다",
    때문이: "때문입니다",
    것이: "것입니다",
    셈이: "셈입니다",
    양상이: "양상입니다",
    흐름이: "흐름입니다",
    구상이: "구상입니다",
    전망이: "전망입니다",
    상황이: "상황입니다",
    결과가: "결과입니다",
    결과이: "결과입니다",
    사례: "사례입니다",
    요소: "요소입니다",
    의지였: "의지였습니다",
    풀이된: "풀이됩니다",
    교차한: "교차합니다",
    가한: "가합니다",
    필요하: "필요합니다",
    요구된: "요구됩니다",
    보인: "보입니다",
    보: "봅니다",
    힌: "힙니다",
    긴: "깁니다",
    린: "립니다",
    진: "집니다",
    른: "릅니다",
    운: "웁니다",
    은: "습니다",
    인: "입니다",
    킨: "킵니다",
    띤: "띱니다",
    온: "옵니다",
    간: "갑니다",
    준: "줍니다",
    둔: "둡니다",
    뒤흔들린: "뒤흔들립니다",
  };

  // Try longest phrase keys that match the ending of prefix+tail
  const fullBeforeDa = `${prefix}${tail}`;
  const phraseKeys = Object.keys(phraseMap).sort((a, b) => b.length - a.length);
  for (const key of phraseKeys) {
    if (fullBeforeDa.endsWith(key)) {
      return `${fullBeforeDa.slice(0, -key.length)}${phraseMap[key]}${punct}`;
    }
  }

  // Past: last syllable has ㅆ batchim (했다, 끌었다→었, 올랐다→랐 has ㄹ+ㅆ? 랐 = rieul-ssisang = 20? )
  // ㅆ = 20, ㄵ etc. Past declarative commonly ends with syllable containing ㅆ.
  if (batchim === 20) {
    // …ㅆ다 → …ㅆ습니다 (했다→했습니다)
    return `${fullBeforeDa}습니다${punct}`;
  }

  // Present verb with ㄴ batchim (한다, 된다, 간다, 본다 already mapped): …ㄴ다 → …ㅂ니다 via
  // replacing ㄴ with ㅂ in the last syllable — complex; use pattern on common finals.
  if (batchim === 4) {
    // ㄴ batchim: 한다→합니다 style — convert ㄴ to ㅂ (batchim 17)
    const code = last.charCodeAt(0);
    const base = code - 0xac00;
    const cho = Math.floor(base / 588);
    const jung = Math.floor((base % 588) / 28);
    const withBieup = String.fromCharCode(0xac00 + cho * 588 + jung * 28 + 17);
    return `${prefix}${tail.slice(0, -1)}${withBieup}니다${punct}`;
  }

  // Descriptive / adjective often end with no batchim + 다 → ㅂ니다 (크다→큽니다)
  // or noun copula (요소다 → 요소입니다). Heuristic:
  // - if last has no batchim and previous char exists → treat as verb stem + 다 → ㅂ니다
  // - else noun + 다 → 입니다
  if (batchim === 0) {
    const code = last.charCodeAt(0);
    const base = code - 0xac00;
    const cho = Math.floor(base / 588);
    const jung = Math.floor((base % 588) / 28);
    const withBieup = String.fromCharCode(0xac00 + cho * 588 + jung * 28 + 17);
    // Prefer ㅂ니다 for open-syllable verb stems (가·와·크·크…)
    return `${prefix}${tail.slice(0, -1)}${withBieup}니다${punct}`;
  }

  // Remaining consonant batchim (ㄹ, ㅁ, …): noun-like copula shorthand → 입니다
  // e.g. rare leftovers
  if (isHangul(last)) {
    return `${fullBeforeDa}입니다${punct}`;
  }

  return trimmed;
}

/** Split Korean prose into sentences while keeping delimiters. */
export function splitKoreanSentences(text: string): string[] {
  const parts = text.match(/[^.!?…]+[.!?…]+\s*|[^.!?…]+$/gu);
  return parts?.map((part) => part) ?? [text];
}

export function toHonorificProse(text: string): string {
  if (!text?.trim()) return text;
  return splitKoreanSentences(text)
    .map((part) => {
      const leading = part.match(/^\s*/)?.[0] ?? "";
      const trailing = part.match(/\s*$/)?.[0] ?? "";
      const core = part.trim();
      if (!core) return part;
      return `${leading}${toHonorificSentence(core)}${trailing}`;
    })
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Convert text nodes inside simple HTML without touching tags/attributes. */
export function toHonorificHtml(html: string): string {
  if (!html?.trim()) return html;
  return html.replace(/>([^<]+)</g, (_full, text: string) => {
    if (!/[가-힣]/.test(text)) return `>${text}<`;
    return `>${toHonorificProse(text)}<`;
  });
}

/** Convert markdown body lines; leave headings/code fences structure. */
export function toHonorificMarkdown(markdown: string): string {
  if (!markdown?.trim()) return markdown;
  return markdown
    .split("\n")
    .map((line) => {
      if (!line.trim()) return line;
      if (/^\s*#/.test(line)) return line;
      if (/^\s*[|`]/.test(line)) return line;
      if (/^\s*</.test(line)) return toHonorificHtml(line);
      return toHonorificProse(line);
    })
    .join("\n");
}

/**
 * True when prose still has plain declarative sentence endings that should be 합니다체.
 */
export function hasPlainDeclarativeEndings(text: string): boolean {
  for (const raw of splitKoreanSentences(text)) {
    const sentence = raw.trim();
    if (!sentence || isAlreadyHonorificSentence(sentence)) continue;
    if (/[가-힣]다[.!?…]*$/u.test(sentence) && !ALREADY_POLITE.test(sentence)) {
      return true;
    }
  }
  return false;
}

export function toHonorificArticleFields<
  T extends {
    excerpt?: string;
    sections?: Array<{ heading?: string; paragraphs: string[] }>;
    faq?: Array<{ question: string; answer: string }>;
    takeaways?: string[];
    bodyHtml?: string;
    bodyMarkdown?: string;
  },
>(article: T): T {
  const sections = article.sections?.map((section) => ({
    ...section,
    paragraphs: section.paragraphs.map((paragraph) => toHonorificProse(paragraph)),
  }));
  const faq = article.faq?.map((item) => ({
    ...item,
    answer: toHonorificProse(item.answer),
  }));
  const takeaways = article.takeaways?.map((item) => toHonorificProse(item));
  return {
    ...article,
    excerpt: article.excerpt ? toHonorificProse(article.excerpt) : article.excerpt,
    sections,
    faq,
    takeaways,
    bodyHtml: article.bodyHtml ? toHonorificHtml(article.bodyHtml) : article.bodyHtml,
    bodyMarkdown: article.bodyMarkdown
      ? toHonorificMarkdown(article.bodyMarkdown)
      : article.bodyMarkdown,
  };
}
