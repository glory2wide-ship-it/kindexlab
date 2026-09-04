/**
 * Deterministic cliché sweep used by board polish / report helpers.
 * The LLM desk-editor pass for Today's Analysis was removed — generation now
 * uses the briefing single-pass (`generatePremiumArticle`) instead.
 */

/**
 * The audit matches cliché stems (주목받고 있), so a replacement table keyed on
 * finished forms (주목받고 있다) lets conjugations like 주목받고 있는 and
 * 주목받고 있으며 pass the cleaner and then fail the audit. Each rule therefore
 * carries the three endings Korean prose actually uses, and the tail the model
 * wrote decides which replacement fits the sentence's grammatical slot.
 */
interface ConjugatedCliche {
  stem: string;
  terminal: string;
  adnominal: string;
  connective: string;
}

const CONJUGATED: ConjugatedCliche[] = [
  {
    stem: "주목(?:을)?\\s*받고 있",
    terminal: "화제가 됐다",
    adnominal: "화제가 된",
    connective: "화제가 됐고",
  },
  {
    stem: "화제를 모으고 있",
    terminal: "화제가 됐다",
    adnominal: "화제가 된",
    connective: "화제가 됐고",
  },
  {
    stem: "기대를 모으고 있",
    terminal: "기대가 붙었다",
    adnominal: "기대가 붙은",
    connective: "기대가 붙었고",
  },
  {
    stem: "이목이 집중되고 있",
    terminal: "관심이 쏠렸다",
    adnominal: "관심이 쏠린",
    connective: "관심이 쏠렸고",
  },
  {
    stem: "관심이 모아지고 있",
    terminal: "관심이 쏠렸다",
    adnominal: "관심이 쏠린",
    connective: "관심이 쏠렸고",
  },
  {
    stem: "눈길을 끌고 있",
    terminal: "눈길을 끌었다",
    adnominal: "눈길을 끈",
    connective: "눈길을 끌었고",
  },
  {
    stem: "귀추가 주목되",
    terminal: "다음 국면이 남았다",
    adnominal: "다음 국면이 남은",
    connective: "다음 국면이 남았고",
  },
  {
    stem: "다양한 관점이 있",
    terminal: "해석이 갈린다",
    adnominal: "해석이 갈리는",
    connective: "해석이 갈리고",
  },
  {
    stem: "다양한 시각이 존재하",
    terminal: "해석이 갈린다",
    adnominal: "해석이 갈리는",
    connective: "해석이 갈리고",
  },
  {
    stem: "다양한 의견이 나오고 있",
    terminal: "의견이 갈린다",
    adnominal: "의견이 갈리는",
    connective: "의견이 갈리고",
  },
];

const ADNOMINAL = /^(?:는|은|던)$/;
const CONNECTIVE = /^(?:으며|며|고|어|어서|지만|는데|으나|나)$/;

function conjugatedRules(): [RegExp, (match: string, tail: string) => string][] {
  return CONJUGATED.map((rule) => {
    const pattern = new RegExp(
      `${rule.stem}(습니다|다는|는다|다|은|는|던|으며|며|고|어서|어|지만|는데|으나|나)`,
      "g",
    );
    const replace = (_match: string, tail: string) => {
      if (ADNOMINAL.test(tail)) return rule.adnominal;
      if (CONNECTIVE.test(tail)) return rule.connective;
      return rule.terminal;
    };
    return [pattern, replace] as [RegExp, (match: string, tail: string) => string];
  });
}

/**
 * Flat phrases with no conjugation to preserve. Deleting outright would leave
 * broken Korean for most of these, so they map to a plain equivalent.
 */
const CLICHE: [RegExp, string][] = [
  [/결론적으로,?\s*/g, ""],
  [/요약하자면,?\s*/g, ""],
  [/종합하면,?\s*/g, ""],
  [/정리하면,?\s*/g, ""],
  [/간단히 정리하면,?\s*/g, ""],
  [/마무리하며,?\s*/g, ""],
  [/한마디로 말해,?\s*/g, ""],
  [/이번 글에서는?,?\s*/g, ""],
  [/이 글에서는,?\s*/g, ""],
  [/이 글은\s*/g, ""],
  [/알아보겠습니다/g, "짚어본다"],
  [/살펴보겠습니다/g, "짚어본다"],
  [/다음과 같습니다/g, "아래와 같다"],
  [/추천합니다/g, "자주 언급된다"],
  [/추천한다/g, "자주 언급된다"],
  [/좋은 선택/g, "현실적인 선택"],
  [/좋은 기회/g, "눈여겨볼 지점"],
  [/향후 전망이 밝다/g, "다음 일정이 남았다"],
  [/앞으로의 행보에 관심이 쏠린다/g, "다음 행보가 남았다"],
  [/긍정적인 반응을 보였다/g, "반응이 갈렸다"],
  [/이 소식에 긍정적인 반응을 보였다/g, "반응이 갈렸다"],
  [/긍정과 부정을 나란히 읽으면,?\s*/g, ""],
  [/대중은\s.{0,24}반응을 보였\S*/g, "반응이 갈렸다"],
  [/생일을 축하하며/g, ""],
  [/뜨거운 관심을 끌었다/g, "검색이 붙었다"],
  [/많은 관심을 받았다/g, "이름이 다시 올랐다"],
];

export function stripCliche(text: string): string {
  let out = text;
  for (const [pattern, replace] of conjugatedRules()) out = out.replace(pattern, replace);
  for (const [pattern, replacement] of CLICHE) out = out.replace(pattern, replacement);
  return out.replace(/\s{2,}/g, " ").replace(/^[,\s]+/, "").trim();
}
