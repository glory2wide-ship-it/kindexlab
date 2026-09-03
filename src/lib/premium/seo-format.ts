import type { PostFaq, PostLink, PostTable } from "@/lib/posts/types";

export interface SeoSection {
  heading?: string;
  headingLevel?: 2 | 3;
  paragraphs: string[];
}

/** Google SEO / AdSense thin-content floor (non-shorts articles). */
export const SEO_MIN_WORDS = 700;
export const SEO_MIN_CHARS = 1_800;

const H2_SYMBOLS = ["❶", "❷", "❸", "❹", "❺", "❻", "❼", "❽"] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Korean word estimate: whitespace tokens plus hangul density fallback. */
export function countKoreanWords(text: string): number {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return 0;
  const spaceTokens = normalized.split(" ").filter(Boolean).length;
  const hangulChars = (normalized.match(/[\uAC00-\uD7A3]/g) ?? []).length;
  const hangulEstimate = Math.ceil(hangulChars / 2.5);
  return Math.max(spaceTokens, hangulEstimate);
}

/** Title-like adjectives that end in 다 but are not sentence boundaries before a noun. */
const DA_TITLE_WORDS = /^(힘들|다른|같은|이런|저런|그런|어떤|모든|새로운|중요한|다양한|구체적인)다$/;

/**
 * Inserts periods where Korean declarative clauses run into the next sentence
 * without terminal punctuation (e.g. "떠올랐다 이슈의" → "떠올랐다. 이슈의").
 */
export function insertMissingKoreanPeriods(text: string): string {
  const ending =
    /((?:았|었|였|했|됐|겠|랐|렀|렸|웠|왔|갔|났|봤|샀|잤|탔)다|(?:습|입|합|됩)니다|(?:한|된|인|는)다|(?:있|없)다|(?:준|진|온|간|친|닌|룬|른|적|쓴|읽|말|풀|갈|남|본)다|(?:해석|작용|시사|존재)된다|(?:보여|나타)(?:준|낸)다|(?:작용|시사|반영|유도|강조|지적|분석|설명|전달|형성|행사|기록)한다|(?:중요|빈번)해진다|(?:깊|크|작|많|적|길|짧|좋|나쁘)다)\s+(?=[\uAC00-\uD7A3\d"'「『])/g;

  const replaceHit = (match: string, end: string, offset: number, source: string) => {
    const before = source.slice(0, offset + end.length);
    const word = before.match(/[\uAC00-\uD7A3]+$/)?.[0] ?? end;
    if (DA_TITLE_WORDS.test(word)) return match;
    // Connective "다 보니/보면/…" — keep unpunctuated.
    const after = source.slice(offset + match.length);
    if (/^(보니|보면|못해|싶다|시피|해도|하여|보니까)/.test(after)) return match;
    return `${end}. `;
  };

  // Broad close for any hangul syllable ending in 다 (e.g. 화제다, 적는다).
  const broad = /([\uAC00-\uD7A3]다)\s+(?=[\uAC00-\uD7A3\d"'「『])/g;
  return text.replace(ending, replaceHit).replace(broad, replaceHit);
}

/** Ensures every sentence ends with terminal punctuation. */
export function ensureSentencePunctuation(text: string): string {
  const withBreaks = insertMissingKoreanPeriods(text.replace(/\s+/g, " ").trim());
  return withBreaks
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => {
      const trimmed = sentence.trim();
      if (!trimmed) return "";
      if (/[.!?…]["'」』)]*$/.test(trimmed)) return trimmed;
      return `${trimmed}.`;
    })
    .filter(Boolean)
    .join(" ");
}

export function formatNumberedH2(index: number, heading: string): string {
  const symbol = H2_SYMBOLS[index] ?? `${index + 1}.`;
  const clean = heading.replace(/^[❶❷❸❹❺❻❼❽\d.\s]+/, "").trim();
  return `${symbol} ${clean}`;
}

/** Applies H2 numbering to main sections; keeps FAQ/table as separate H2/H3 blocks. */
export function applySeoHeadingStructure(sections: SeoSection[]): SeoSection[] {
  let h2Index = 0;
  return sections.map((section) => {
    const level = section.headingLevel === 3 ? 3 : 2;
    if (level === 2 && section.heading) {
      const heading = formatNumberedH2(h2Index, section.heading);
      h2Index += 1;
      return { ...section, heading, headingLevel: 2 as const };
    }
    return { ...section, headingLevel: 3 as const };
  });
}

/** Trailing punct only — do not split mid-heading run-ons (titles often contain 힘들다 …). */
export function polishHeadingText(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (/[.!?…]["'」』)]*$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

export function polishProseText(text: string): string {
  return ensureSentencePunctuation(text);
}

export function polishArticleSections(sections: SeoSection[]): SeoSection[] {
  return sections.map((section) => ({
    ...section,
    heading: section.heading ? polishHeadingText(section.heading) : section.heading,
    paragraphs: section.paragraphs.map(polishProseText).filter(Boolean),
  }));
}

export function polishFaq(faq: PostFaq[]): PostFaq[] {
  return faq.map((item) => ({
    question: polishProseText(item.question),
    answer: polishProseText(item.answer),
  }));
}

export function articleWordCount(input: {
  title: string;
  excerpt: string;
  sections: SeoSection[];
  faq: PostFaq[];
  table?: PostTable;
}): number {
  const plain = [
    input.title,
    input.excerpt,
    ...input.sections.flatMap((section) => [section.heading ?? "", ...section.paragraphs]),
    input.table?.caption ?? "",
    ...(input.table?.rows.flat() ?? []),
    ...input.faq.flatMap((item) => [item.question, item.answer]),
  ].join(" ");
  return countKoreanWords(plain);
}

export function renderFactTableHtml(table: PostTable): string {
  if (!table.headers.length || !table.rows.length) return "";
  const head = table.headers
    .map((header) => `<th scope="col">${escapeHtml(header)}</th>`)
    .join("");
  const body = table.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
    )
    .join("");
  return [
    '<div class="overflow-x-auto rounded-xl border border-line">',
    '<table class="w-full min-w-[32rem] border-collapse text-sm">',
    `<thead><tr>${head}</tr></thead>`,
    `<tbody>${body}</tbody>`,
    "</table>",
    "</div>",
  ].join("");
}

export function renderSeoHtml(input: {
  excerpt: string;
  sections: SeoSection[];
  table: PostTable;
  faq: PostFaq[];
  externalLink: PostLink;
  internalLink: PostLink;
}): string {
  const blocks: string[] = ['<article class="seo-body">', `<p class="lead">${escapeHtml(polishProseText(input.excerpt))}</p>`];

  for (const section of input.sections) {
    const tag = section.headingLevel === 3 ? "h3" : "h2";
    blocks.push("<section>");
    if (section.heading) {
      blocks.push(`<${tag}>${escapeHtml(section.heading)}</${tag}>`);
    }
    for (const paragraph of section.paragraphs) {
      blocks.push(`<p>${escapeHtml(paragraph)}</p>`);
    }
    blocks.push("</section>");
  }

  if (input.table.rows.length) {
    blocks.push("<section>");
    blocks.push(`<h2>${escapeHtml(formatNumberedH2(input.sections.length, input.table.caption || "팩트 체크"))}</h2>`);
    blocks.push(renderFactTableHtml(input.table));
    blocks.push("</section>");
  }

  blocks.push("<section>");
  blocks.push(`<h2>${escapeHtml(formatNumberedH2(input.sections.length + 1, "교차 확인 자료"))}</h2>`);
  blocks.push('<ul class="seo-links">');
  blocks.push(
    `<li><a href="${escapeHtml(input.externalLink.href)}" rel="noopener noreferrer" target="_blank">${escapeHtml(input.externalLink.label)}</a></li>`,
  );
  blocks.push(
    `<li><a href="${escapeHtml(input.internalLink.href)}">${escapeHtml(input.internalLink.label)}</a></li>`,
  );
  blocks.push("</ul>");
  blocks.push("</section>");

  if (input.faq.length) {
    blocks.push("<section>");
    blocks.push(`<h2>${escapeHtml(formatNumberedH2(input.sections.length + 2, "자주 묻는 질문"))}</h2>`);
    for (const item of input.faq) {
      blocks.push(`<h3>${escapeHtml(item.question)}</h3>`);
      blocks.push(`<p>${escapeHtml(item.answer)}</p>`);
    }
    blocks.push("</section>");
  }

  blocks.push("</article>");
  return blocks.join("\n");
}

export function renderSeoMarkdown(input: {
  title: string;
  excerpt: string;
  sections: SeoSection[];
  table: PostTable;
  faq: PostFaq[];
  externalLink: PostLink;
  internalLink: PostLink;
}): string {
  const blocks: string[] = [`# ${input.title}`, "", polishProseText(input.excerpt), ""];

  for (const section of input.sections) {
    const marker = section.headingLevel === 3 ? "###" : "##";
    if (section.heading) blocks.push(`${marker} ${section.heading}`, "");
    blocks.push(...section.paragraphs.flatMap((paragraph) => [paragraph, ""]));
  }

  if (input.table.rows.length) {
    blocks.push(`## ${formatNumberedH2(input.sections.length, input.table.caption || "팩트 체크")}`, "");
    blocks.push(
      `| ${input.table.headers.join(" | ")} |`,
      `| ${input.table.headers.map(() => "---").join(" | ")} |`,
      ...input.table.rows.map((row) => `| ${row.join(" | ")} |`),
      "",
    );
  }

  blocks.push(`## ${formatNumberedH2(input.sections.length + 1, "교차 확인 자료")}`, "");
  blocks.push(
    `- [${input.externalLink.label}](${input.externalLink.href})`,
    `- [${input.internalLink.label}](${input.internalLink.href})`,
    "",
  );

  blocks.push(`## ${formatNumberedH2(input.sections.length + 2, "자주 묻는 질문")}`, "");
  for (const item of input.faq) {
    blocks.push(`### ${item.question}`, "", item.answer, "");
  }

  return blocks.join("\n");
}

/** Prompt block for SEO expansion without inventing keyword-specific facts. */
export function seoExpansionPrompt(keyword: string): string {
  return [
    "[SEO 분량 확장 — Thin Content / Low-value 방지]",
    `현재 본문이 ${SEO_MIN_WORDS}단어 미만입니다. 핵심 팩트는 유지한 채 Why·How·표·전망 밀도로 확장하세요.`,
    "- Why: 왜 지금 검색·랭킹·대중이 반응하는지 시장·플랫폼 맥락.",
    "- How: 독자 일상·소비·확인 요령(목록형 체크리스트 섹션 금지).",
    "- 표: 지표·일정·비교 수치를 보강.",
    "- 전망: 확인된 일정·신호만으로 파급 포인트.",
    `- "${keyword}"에 대한 확인되지 않은 사실·줄거리·인물 관계는 추가하지 마세요.`,
    "- 인사말·마무리 요약·'독자 체크리스트' 패딩은 금지입니다.",
    "- 전문가 시각·구체 예시·수치 근거를 보태되, '좋다/추천한다'만 쓰지 마세요.",
    "- 문장 끝 마침표(.)를 빠짐없이 넣고, 문단은 3~4문장 단위로 유지하세요.",
    "- H2 소제목은 ❶❷❸❹ 기호로, FAQ 질문은 H3로 구분할 수 있게 섹션을 나누세요.",
  ].join("\n");
}

export function seoStructureRules(): string {
  return [
    "[SEO 문서 구조 — H 태그 엄격 적용]",
    "- 페이지 H1은 제목(title) 하나뿐입니다. 본문 JSON에는 H1을 쓰지 마세요.",
    "- 주요 섹션 heading은 H2(headingLevel: 2)이며 ❶❷❸❹❺ 기호로 번호를 매깁니다. H2 3~5개.",
    "- FAQ 질문·세부 팩트 항목은 H3(headingLevel: 3)로 구분합니다. FAQ Q&A 3개 이상.",
    "- table.caption은 '팩트 체크' 또는 '핵심 팩트 요약' 형태로 작성합니다. Table 최소 1개.",
    "- externalLink·internalLink는 클릭 가능한 href·label 쌍입니다. internal은 실제 보드·브리핑·랭킹 경로만(/search 금지).",
    `- non-shorts 모드: 공백 제외 본문 ${SEO_MIN_CHARS}자(약 ${SEO_MIN_WORDS}단어) 이상을 목표로 합니다.`,
    "- 포커스 키워드를 도입부(상위 10%)와 본문에 합쳐 5회 이상 배치하세요.",
    "- 문단당 3~4문장, 모든 문장 끝 마침표(.) 필수. 줄바꿈으로 끝나도 마침표를 빠뜨리지 마세요.",
  ].join("\n");
}
