/** Strip LLM preambles, code fences, and leaked metadata from a single text field. */
const LEADING_PREAMBLE =
  /^(?:네,?\s*)?(?:알겠습니다[.。]?\s*)?(?:물론입니다[.。]?\s*)?(?:아래(?:에|는)?|다음(?:에|은)?|작성(?:한|해)\s*(?:드리|드릴)|기사를\s*작성)\s*/i;

const METADATA_SENTENCE =
  /(?:\d{4}-\d{2}-\d{2}\s*[·•-]\s*)|(?:\d+\s*분\s*읽기)|(?:글자\s*수\s*[:：]\s*\d+)|(?:SEO|AdSense)\b|(?:JSON-LD|스키마\.org)/i;

export function cleanLlmField(value: string): string {
  let out = value.replace(/\s+/g, " ").trim();
  if (!out) return "";

  out = out.replace(/^```(?:json|html|markdown|text)?\s*/i, "").replace(/\s*```$/i, "").trim();

  for (let pass = 0; pass < 3; pass += 1) {
    const next = out.replace(LEADING_PREAMBLE, "").trim();
    if (next === out) break;
    out = next;
  }

  out = out
    .split(/(?<=[.!?…])\s+/)
    .filter((sentence) => sentence.trim() && !METADATA_SENTENCE.test(sentence.trim()))
    .join(" ")
    .trim();

  return out;
}
