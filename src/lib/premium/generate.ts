import { BRIEFING_LLM, chatJson, openaiConfigured } from "@/lib/analysis/chain/llm";
import type { AnalysisLogger } from "@/lib/analysis/log";
import {
  canGenerateContext,
  collectPremiumContext,
  buildSparseEnrichmentPrompt,
  isRetrievedUrl,
  type PremiumContext,
  type PremiumSource,
} from "@/lib/premium/context";
import {
  PREMIUM_KEYWORD_HARD_MAX,
  PREMIUM_KEYWORD_MAX,
  PREMIUM_KEYWORD_MIN,
  PREMIUM_MIN_CHARS,
  PREMIUM_SYSTEM_PROMPT,
  bannedPhraseReminder,
  briefingWritingRules,
  buildBriefingSystemPrompt,
  countOccurrences,
  findBannedPhrases,
  llmOutputFormatRules,
  premiumCharCount,
} from "@/lib/premium/prompt";
import { editorialGroundingRules } from "@/lib/editorial/tense-rules";
import { describePlacements, injectMonetization, type PremiumPlacement } from "@/lib/premium/widgets";
import {
  dropRepeatedSentences,
  duplicateClaimCount,
  findBriefingBoilerplate,
  hasBriefingBoilerplate,
  hasGenericPadding,
  hasLeakedMetadata,
  hasRepetitiveDeclarativeEndings,
  hasTemplateConnectiveSpam,
} from "@/lib/editorial/rules";
import {
  assessBriefingGenerationMode,
  briefingMinChars,
  briefingSectionTarget,
  buildBriefingSparsePrompt,
  buildShortsModePrompt,
  filterBriefingRelatedKeywords,
  relatedKeywordsPromptBlock,
  type BriefingGenerationMode,
} from "@/lib/premium/briefing-editorial";
import { cleanLlmField } from "@/lib/premium/clean";
import {
  applySeoHeadingStructure,
  articleWordCount,
  polishArticleSections,
  polishFaq,
  polishProseText,
  renderFactTableHtml,
  renderSeoHtml,
  renderSeoMarkdown,
  seoExpansionPrompt,
  seoStructureRules,
  SEO_MIN_WORDS,
} from "@/lib/premium/seo-format";
import { SITE } from "@/lib/site";
import type { PostFaq, PostLink, PostTable } from "@/lib/posts/types";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity } from "@/lib/types";

/**
 * Structure targets sized so a compliant draft clears the 1,800자 floor on the
 * first pass. "3개 이상" is satisfied by exactly three thin sections, which is
 * what a model reaches for; 5 x 3 x 4 sentences at typical Korean sentence
 * length lands around 2,100자, inside the 1,800~2,500 band.
 */
const SECTION_TARGET = 5;
const PARAGRAPHS_PER_SECTION = 3;
const SENTENCES_PER_PARAGRAPH = 4;
/** Per-section floor that puts the assembled body over PREMIUM_MIN_CHARS. */
const SECTION_MIN_CHARS = 380;

export interface PremiumSection {
  heading: string;
  headingLevel: 2 | 3;
  paragraphs: string[];
}

export interface PremiumArticle {
  keyword: string;
  slug: string;
  title: string;
  excerpt: string;
  sections: PremiumSection[];
  table: PostTable;
  faq: PostFaq[];
  externalLink: PostLink;
  internalLink: PostLink;
  takeaways: string[];
  /** Body with AdSense containers and the affiliate shelf already placed. */
  bodyMarkdown: string;
  /** SEO-optimized HTML body (H2/H3, table, semantic links). */
  bodyHtml: string;
  /** Schema.org Article + FAQPage, ready to inline in the page head or body. */
  jsonLd: string;
  characterCount: number;
  keywordCount: number;
  sources: PremiumSource[];
  placements: PremiumPlacement[];
  model: string;
}

export type PremiumFailure =
  | "llm-not-configured"
  | "thin-sources"
  | "thin-context"
  | "llm-empty"
  | "malformed"
  | "too-short"
  | "banned-copy"
  | "keyword-stuffing"
  | "fabricated-url";

export type PremiumResult =
  | { ok: true; article: PremiumArticle }
  | { ok: false; reason: PremiumFailure; detail?: string };

interface RawDraft {
  title?: unknown;
  excerpt?: unknown;
  sections?: unknown;
  table?: unknown;
  faq?: unknown;
  externalLink?: unknown;
  internalLink?: unknown;
  takeaways?: unknown;
}

function text(value: unknown): string {
  return typeof value === "string" ? cleanLlmField(value.replace(/\s+/g, " ").trim()) : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

/**
 * Cells the model wrote to satisfy the row count rather than to state a fact.
 *
 * The outline call is asked for a table on every column, including the ones
 * where the retrieved reporting only supports a row or two. Told to fill three,
 * it invents the remainder — a published column carried "미공개 신작1 |
 * 2026-09-15 | 협동 플레이 강조", a release date for a game that had not been
 * announced. A short table is honest; an invented one is not.
 */
const PLACEHOLDER_CELL =
  /(미공개|미정|미상|추정치|예상치|알\s*수\s*없음|확인\s*불가|해당\s*없음|준비\s*중|미확정|TBD|TBA|N\/A)/i;

function isPlaceholderRow(cells: string[]): boolean {
  return cells.some((cell) => {
    const value = cell.trim();
    if (!value || value === "-" || value === "—" || value === "?") return true;
    return PLACEHOLDER_CELL.test(value);
  });
}

function parseTable(value: unknown): PostTable {
  const row = (value ?? {}) as { caption?: unknown; headers?: unknown; rows?: unknown };
  const headers = stringList(row.headers);
  const rows = Array.isArray(row.rows)
    ? row.rows
        .map((cells) => stringList(cells))
        .filter((cells) => cells.length > 0 && !isPlaceholderRow(cells))
    : [];
  return { caption: text(row.caption) || "팩트 요약", headers, rows };
}

function parseFaq(value: unknown): PostFaq[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = item as { question?: unknown; answer?: unknown };
    const question = text(row.question);
    const answer = text(row.answer);
    return question && answer ? [{ question, answer }] : [];
  });
}

function parseLink(value: unknown): PostLink | null {
  const row = (value ?? {}) as { href?: unknown; label?: unknown };
  const href = text(row.href);
  const label = text(row.label);
  return href && label ? { href, label } : null;
}

function tableMarkdown(table: PostTable): string {
  if (!table.headers.length || !table.rows.length) return "";
  const head = `| ${table.headers.join(" | ")} |`;
  const sep = `| ${table.headers.map(() => "---").join(" | ")} |`;
  const body = table.rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}

/**
 * The prose the keyword-placement rule applies to.
 *
 * "본문 전체에 5~7회" targets the body copy, not the scaffolding. A title, a
 * fact table keyed on the subject and an FAQ asking "X란 무엇인가?" all name the
 * keyword because that is what those elements are for — counting them would
 * make the budget unreachable and push the writer to strip the term out of the
 * places it genuinely belongs.
 */
function bodyPlainText(sections: PremiumSection[]): string {
  return sections.flatMap((section) => [section.heading, ...section.paragraphs]).join(" ");
}

/** Every string a reader sees, used for the length and tone audits. */
function articlePlainText(draft: {
  title: string;
  excerpt: string;
  sections: PremiumSection[];
  faq: PostFaq[];
  takeaways: string[];
  table: PostTable;
}): string {
  return [
    draft.title,
    draft.excerpt,
    ...draft.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    ...draft.takeaways,
    draft.table.caption,
    ...draft.table.rows.flat(),
    ...draft.faq.flatMap((item) => [item.question, item.answer]),
  ].join(" ");
}

function internalSearchLink(keyword: string, fallbackLabel: string): PostLink {
  return {
    href: `/search?q=${encodeURIComponent(keyword)}`,
    label: fallbackLabel || `${keyword} 관련 이슈 키워드 더 보기`,
  };
}

function buildJsonLd(input: {
  title: string;
  excerpt: string;
  url: string;
  faq: PostFaq[];
  keyword: string;
  publishedAt: string;
}): string {
  const graph = [
    {
      "@type": "Article",
      headline: input.title,
      description: input.excerpt,
      mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
      keywords: input.keyword,
      datePublished: input.publishedAt,
      dateModified: input.publishedAt,
      publisher: { "@type": "Organization", name: SITE.name },
    },
    {
      "@type": "FAQPage",
      mainEntity: input.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];
  const payload = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2);
  return `<script type="application/ld+json">\n${payload}\n</script>`;
}

const FAQ_HEADING = "## 자주 묻는 질문";

function briefingSectionTimeoutMs(mode?: BriefingGenerationMode): number {
  // Sections run in parallel, so wall-clock ≈ one section's budget.
  if (mode === "shorts") return 75_000;
  return 90_000;
}

function renderMarkdown(input: {
  keyword: string;
  title: string;
  excerpt: string;
  sections: PremiumSection[];
  table: PostTable;
  faq: PostFaq[];
  takeaways: string[];
  externalLink: PostLink;
  internalLink: PostLink;
  jsonLd: string;
}): { markdown: string; html: string } {
  const seoMarkdown = renderSeoMarkdown({
    title: input.title,
    excerpt: input.excerpt,
    sections: input.sections,
    table: input.table,
    faq: input.faq,
    externalLink: input.externalLink,
    internalLink: input.internalLink,
  });

  const markdown = injectMonetization(seoMarkdown, input.keyword, { faqAnchor: input.jsonLd });

  const htmlBody = renderSeoHtml({
    excerpt: input.excerpt,
    sections: input.sections,
    table: input.table,
    faq: input.faq,
    externalLink: input.externalLink,
    internalLink: input.internalLink,
  });

  return { markdown, html: htmlBody };
}

interface PremiumOutline {
  title: string;
  excerpt: string;
  plan: { heading: string; covers: string }[];
  table: PostTable;
  faq: PostFaq[];
  externalLink: PostLink | null;
  internalLink: PostLink | null;
  takeaways: string[];
}

/**
 * First call: everything except the prose — headline, section plan, fact table,
 * FAQ and links. Keeping the body out of this response is what lets the section
 * calls below each spend their whole output budget on one section.
 */
async function planOutline(input: {
  context: PremiumContext;
  keyword: string;
  category?: string;
  channel?: PostChannel;
  related: string[];
  briefing?: boolean;
  mode?: BriefingGenerationMode;
  sectionTarget: number;
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<PremiumOutline | null> {
  const related = input.briefing
    ? filterBriefingRelatedKeywords(input.keyword, input.related, input.category)
    : input.related;

  const briefingModeBlock =
    input.briefing && input.mode === "shorts"
      ? buildShortsModePrompt()
      : input.briefing && input.mode !== "full"
        ? buildBriefingSparsePrompt()
        : buildSparseEnrichmentPrompt(input.context, { briefing: input.briefing });

  const raw = await chatJson<RawDraft & { sections?: unknown }>({
    system: input.briefing ? buildBriefingSystemPrompt(input.channel) : PREMIUM_SYSTEM_PROMPT,
    user: [
      input.context.block,
      "",
      briefingModeBlock,
      input.category ? `[분류] ${input.category}` : "",
      input.briefing ? relatedKeywordsPromptBlock(related) : related.length ? `[연관 키워드] ${related.join(", ")}` : "",
      input.briefing ? briefingWritingRules(input.channel) : "",
      (input.briefing ? input.mode !== "shorts" : true) ? seoStructureRules() : "",
      llmOutputFormatRules(),
      editorialGroundingRules(),
      input.context.intentHints.length
        ? `[FAQ·소제목 참고(사실 근거 아님)]\n${input.context.intentHints.map((hint, index) => `${index + 1}. ${hint}`).join("\n")}`
        : "",
      "",
      "이번 호출에서는 본문 문단을 쓰지 않습니다. 제목과 구성 계획, 부속 요소만 JSON으로 출력하세요.",
      "{",
      '  "title": string,        // H1. 포커스 키워드를 그대로 포함',
      '  "excerpt": string,      // 2~3문장 리드',
      `  "sections": [{ "heading": string, "covers": string }],  // 정확히 ${input.sectionTarget}개`,
      '  "table": { "caption": string, "headers": [string], "rows": [[string]] },',
      '  "faq": [{ "question": string, "answer": string }],',
      '  "externalLink": { "href": string, "label": string },',
      '  "internalLink": { "href": string, "label": string },',
      '  "takeaways": [string]',
      "}",
      "",
      "[강제 조건]",
      "- heading은 번호 없는 한국어 소제목입니다.",
      "- covers는 그 섹션이 무엇을 주장할지 한 문장으로 적어 섹션 간 주제가 겹치지 않게 하세요.",
      // Naming the arc's stages verbatim made the model copy them into the
      // headings: one wording ended up on more than half the published columns,
      // which reads as one template refilled per keyword.
      "- 전개는 배경에서 출발해 쟁점, 파급, 평가, 전망으로 나아갑니다. 단 이 다섯 단어를 소제목에 그대로 쓰지 마세요.",
      "- heading에는 이 사안에서만 나올 수 있는 고유명사나 구체적 사실을 넣으세요. 키워드만 바꾸면 다른 칼럼에도 그대로 들어맞는 소제목은 실패로 처리됩니다.",
      "  (실패 예: '향후 전망과 실행 팁', '전문가 시각의 장단점', '이해관계와 사회적 파급', '사회적 파급 효과', '미래 전망')",
      "- '파급', '전망', '의미', '배경'처럼 추상적인 말로 끝나는 소제목은 최대 1개까지만 허용합니다.",
      input.briefing && input.mode === "shorts"
        ? "- [단신 모드] table.headers는 2개 이상, table.rows는 2행이면 충분합니다."
        : "- table.headers는 3개 이상, table.rows는 2~4행입니다.",
      "- 표의 모든 값은 위 [최신 뉴스 데이터]에서 확인되는 사실이어야 합니다. 확인할 수 없는 수치·날짜·명칭은 쓰지 마세요.",
      "- '미공개 신작1', '미정', '추정치'처럼 자리를 채우려고 지어낸 값을 넣느니 행을 줄이세요.",
      input.briefing && input.mode === "shorts"
        ? "- [단신 모드] faq는 1~2개, 각 답변은 1~2문장의 팩트만."
        : "- faq는 2개 이상이며 답변은 각각 2문장 이상입니다.",
      "- faq 각 답변은 위 뉴스의 서로 다른 고유명사·날짜·사건을 인용하세요. '반응이 갈렸다', '관심을 끌었다' 같은 감정 평가는 쓰지 마세요.",
      "- externalLink.href는 위 [최신 뉴스 데이터] 목록의 URL을 그대로 복사한 값이어야 합니다. 다른 주소를 쓰면 실패로 처리됩니다.",
      "- internalLink.href는 반드시 /search?q= 로 시작합니다.",
      input.briefing
        ? "- takeaways는 빈 배열 [] 로 두세요. 실행 체크리스트·독자 팁 금지."
        : "- takeaways는 구체적 실행 팁 2~4개입니다.",
      "",
      bannedPhraseReminder(),
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.5,
    timeoutMs: input.timeoutMs,
    logger: input.logger,
    step: "premium-outline",
    provider: BRIEFING_LLM.provider,
    model: BRIEFING_LLM.editorModel(),
  });

  if (!raw) return null;

  const plan = (Array.isArray(raw.sections) ? raw.sections : [])
    .flatMap((item) => {
      const row = item as { heading?: unknown; covers?: unknown };
      const heading = text(row.heading).replace(/^[❶❷❸❹❺\d.\s]+/, "").trim();
      return heading ? [{ heading, covers: text(row.covers) }] : [];
    })
    .slice(0, input.sectionTarget);

  const title = text(raw.title);
  const minPlan = input.briefing && input.mode === "shorts" ? 2 : 3;
  if (!title || plan.length < minPlan) return null;

  return {
    title,
    excerpt: text(raw.excerpt),
    plan,
    table: parseTable(raw.table),
    faq: parseFaq(raw.faq),
    externalLink: parseLink(raw.externalLink),
    internalLink: parseLink(raw.internalLink),
    takeaways: input.briefing ? [] : stringList(raw.takeaways).slice(0, 4),
  };
}

/**
 * Writes one section. Scoping a call to a single section is what makes the
 * length target achievable: asked for a whole 60-sentence body at once the
 * model returns a fraction of it and then treats its own short draft as
 * finished, which no amount of "expand this" follow-up reliably fixes.
 */
async function writeSection(input: {
  index: number;
  outline: PremiumOutline;
  keyword: string;
  context: PremiumContext;
  channel?: PostChannel;
  briefing?: boolean;
  mode?: BriefingGenerationMode;
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<PremiumSection | null> {
  const plan = input.outline.plan[input.index];
  if (!plan) return null;

  const others = input.outline.plan
    .filter((_, index) => index !== input.index)
    .map((item) => item.heading)
    .join(" / ");

  const shorts = input.briefing && input.mode === "shorts";
  const sparse = input.briefing && input.mode !== "full";
  const sectionMinChars = shorts ? 200 : sparse ? 280 : input.briefing ? 300 : SECTION_MIN_CHARS;
  const paragraphCount = shorts ? "2" : sparse || input.briefing ? "2~3" : `정확히 ${PARAGRAPHS_PER_SECTION}`;
  const sentenceCount = shorts ? "2~3" : sparse || input.briefing ? "3~4" : String(SENTENCES_PER_PARAGRAPH);

  const briefingModeBlock = shorts
    ? buildShortsModePrompt()
    : sparse
      ? buildBriefingSparsePrompt()
      : buildSparseEnrichmentPrompt(input.context, { briefing: input.briefing });

  const result = await chatJson<{ paragraphs?: unknown }>({
    system: input.briefing ? buildBriefingSystemPrompt(input.channel) : PREMIUM_SYSTEM_PROMPT,
    user: [
      input.context.block,
      "",
      briefingModeBlock,
      "",
      `당신은 칼럼의 ${input.index + 1}번째 섹션만 씁니다.`,
      `이 섹션의 소제목: ${plan.heading}`,
      plan.covers ? `이 섹션이 다룰 내용: ${plan.covers}` : "",
      others ? `다른 섹션이 맡은 주제(중복 금지): ${others}` : "",
      "이미 다른 섹션이 쓴 사건·인용·반응을 다시 쓰지 마세요. 이 섹션의 covers에 해당하는 새 사실만 쓰세요.",
      input.briefing ? briefingWritingRules(input.channel) : "",
      input.briefing && input.mode !== "shorts" ? seoStructureRules() : "",
      input.briefing
        ? "같은 평서 종결을 연속 3회 이상 쓰지 마세요. 의문형·명사형·짧은 단문을 섞으세요. 체크리스트·일반론 패딩 금지."
        : "",
      llmOutputFormatRules(),
      editorialGroundingRules(),
      "",
      'JSON으로만 출력하세요: { "paragraphs": [string, ...] }',
      `문단은 ${paragraphCount}개이고, 각 문단은 ${sentenceCount}문장입니다.`,
      `한 문장은 공백 제외 30~45자입니다. 이 섹션은 공백 제외 ${sectionMinChars}자 이상이어야 합니다.`,
      "모든 문장은 마침표(.)·물음표(?)·느낌표(!) 중 하나로 끝내세요. 종결 부호 없이 줄바꿈하거나 다음 문장과 이어 붙이지 마세요.",
      // The body budget is 5~7 across five sections, so exactly one per section
      // lands in range without any section needing to know the others' counts.
      // The mention is anchored to a specific sentence because "use it once"
      // alone gets dropped entirely once the model starts reaching for pronouns.
      `"${input.keyword}"를 이 섹션의 첫 문단 안에 반드시 정확히 1회 쓰세요. 빠뜨리면 실패로 처리됩니다.`,
      // Naming two stand-ins made them the default regardless of subject, so
      // columns about a game or an idol shipped with "이 제도의 성공 배경" in
      // the body. The substitute has to agree with what the subject actually is.
      `나머지 문단에서는 "${input.keyword}"를 반복하지 말고, 대상의 성격에 실제로 들어맞는 표현으로 받으세요. 인물이면 '그'·'그녀', 작품이나 게임이면 '이 작품', 방송이면 '이 프로그램', 가게면 '이 매장'처럼 씁니다.`,
      `'이 제도', '해당 사안', '본 사안'은 대상이 정말로 제도나 사건일 때만 쓸 수 있습니다. 인물·작품·상품·장소에 쓰면 실패로 처리됩니다.`,
      "본문에 URL, 마크다운 링크, 광고 코드, 위젯 태그를 넣지 마세요.",
      "소제목은 출력하지 마세요. 문단 배열만 출력합니다.",
      "",
      bannedPhraseReminder(),
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.6,
    timeoutMs: input.timeoutMs,
    logger: input.logger,
    step: `premium-sec${input.index + 1}`,
    provider: BRIEFING_LLM.provider,
    model: BRIEFING_LLM.editorModel(),
  });

  const paragraphs = stringList(result?.paragraphs);
  if (!paragraphs.length) return null;

  return {
    heading: plan.heading,
    headingLevel: input.index % 2 === 0 ? 2 : 3,
    paragraphs,
  };
}

/**
 * Rewrites only the strings that tripped the Anti-AI clause.
 *
 * The cliché is a sentence-level tic, so discarding a compliant 2,000자 column
 * over one phrase throws away five good section calls. Rewriting the offending
 * strings costs a single short call and leaves the rest of the article intact.
 */
async function repairBannedCopy(input: {
  offenders: string[];
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<string[] | null> {
  const result = await chatJson<{ rewritten?: unknown }>({
    system: PREMIUM_SYSTEM_PROMPT,
    user: [
      "아래 문장들에 금지 표현이 들어 있습니다. 같은 뜻과 비슷한 길이를 유지하되 금지 표현만 제거해 다시 쓰세요.",
      "사실을 바꾸거나 새로 추가하지 마세요. 단정적인 서술로 바꾸면 됩니다.",
      "",
      bannedPhraseReminder(),
      "",
      JSON.stringify({ sentences: input.offenders }),
      "",
      `JSON으로만 출력하세요: { "rewritten": [string, ...] }`,
      `배열 길이는 입력과 같은 ${input.offenders.length}개이고 순서도 같아야 합니다.`,
    ].join("\n"),
    temperature: 0.4,
    timeoutMs: input.timeoutMs,
    logger: input.logger,
    step: "premium-decliche",
    provider: BRIEFING_LLM.provider,
    model: BRIEFING_LLM.editorModel(),
  });

  const rewritten = stringList(result?.rewritten);
  return rewritten.length === input.offenders.length ? rewritten : null;
}

/**
 * Rewrites paragraphs to hit an exact keyword count.
 *
 * Trimming surplus mentions by string substitution is not safe here: Korean
 * attaches particles to the noun and the right stand-in depends on what the
 * subject is — "이 제도" fits a benefit scheme and is nonsense for a person or a
 * restaurant. The model picks the anaphor; the caller decides the counts.
 */
async function repairKeywordDensity(input: {
  keyword: string;
  targets: { text: string; want: number }[];
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<string[] | null> {
  const result = await chatJson<{ rewritten?: unknown }>({
    system: PREMIUM_SYSTEM_PROMPT,
    user: [
      `아래 문단들에서 "${input.keyword}"의 사용 횟수가 과합니다. 같은 뜻과 비슷한 길이를 유지한 채 지정된 횟수만 남기세요.`,
      "제거한 자리는 문맥에 맞는 대용 표현이나 대명사로 자연스럽게 받으세요. 사실을 바꾸지 마세요.",
      "",
      JSON.stringify({
        paragraphs: input.targets.map((target, index) => ({
          index,
          keywordCount: target.want,
          text: target.text,
        })),
      }),
      "",
      `JSON으로만 출력하세요: { "rewritten": [string, ...] }`,
      `배열 길이는 ${input.targets.length}개이고 순서는 입력의 index와 같아야 합니다.`,
      `각 문단에서 "${input.keyword}"는 지정된 keywordCount만큼만 나와야 합니다.`,
    ].join("\n"),
    temperature: 0.4,
    timeoutMs: input.timeoutMs,
    logger: input.logger,
    step: "premium-density",
    provider: BRIEFING_LLM.provider,
    model: BRIEFING_LLM.editorModel(),
  });

  const rewritten = stringList(result?.rewritten);
  return rewritten.length === input.targets.length ? rewritten : null;
}

/**
 * Expands thin briefings toward SEO_MIN_WORDS with general search/portal analysis
 * without inventing keyword-specific facts.
 */
async function expandArticleForSeo(input: {
  keyword: string;
  channel?: PostChannel;
  excerpt: string;
  sections: PremiumSection[];
  context: PremiumContext;
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<PremiumSection[] | null> {
  const result = await chatJson<{ sections?: unknown }>({
    system: buildBriefingSystemPrompt(input.channel),
    user: [
      input.context.block,
      "",
      seoExpansionPrompt(input.keyword),
      seoStructureRules(),
      llmOutputFormatRules(),
      "",
      `현재 리드: ${input.excerpt}`,
      "현재 섹션:",
      JSON.stringify(
        input.sections.map((section) => ({
          heading: section.heading,
          headingLevel: section.headingLevel,
          paragraphs: section.paragraphs,
        })),
      ),
      "",
      "위 섹션의 팩트는 유지하고, 각 섹션에 1~2문단씩 검색·포털·트렌드 맥락 분석을 보태거나 '검색·포털 노출 맥락' H3 하위 섹션 1개를 추가하세요.",
      'JSON으로만 출력: { "sections": [{ "heading": string, "headingLevel": 2 | 3, "paragraphs": [string] }] }',
      `목표: 전체 ${SEO_MIN_WORDS}단어 이상. 문장 끝 마침표 필수.`,
      bannedPhraseReminder(),
    ].join("\n"),
    temperature: 0.55,
    timeoutMs: input.timeoutMs,
    logger: input.logger,
    step: "premium-seo-expand",
    provider: BRIEFING_LLM.provider,
    model: BRIEFING_LLM.editorModel(),
  });

  if (!result?.sections || !Array.isArray(result.sections)) return null;

  const expanded = result.sections.flatMap((item) => {
    const row = item as { heading?: unknown; headingLevel?: unknown; paragraphs?: unknown };
    const heading = text(row.heading);
    const paragraphs = stringList(row.paragraphs);
    const level = row.headingLevel === 3 ? 3 : 2;
    return heading && paragraphs.length ? [{ heading, headingLevel: level as 2 | 3, paragraphs }] : [];
  });

  return expanded.length >= input.sections.length ? expanded : null;
}

/**
 * Generates one premium column end to end: retrieval, the mandated system
 * prompt, an optional length repair pass, then the structural audits. Every
 * rejection path returns a reason instead of throwing so the batch runner can
 * report per-keyword outcomes and keep going.
 */
export async function generatePremiumArticle(input: {
  keyword: string;
  slug: string;
  category?: string;
  channel?: PostChannel;
  related?: string[];
  entity?: RankingEntity;
  relatedEntities?: RankingEntity[];
  logger: AnalysisLogger;
  timeoutMs?: number;
  publishedAt?: string;
  briefing?: boolean;
}): Promise<PremiumResult> {
  const { keyword, slug, logger } = input;
  // Budget covers retrieval, the draft and up to two repair rounds.
  const deadline = Date.now() + (input.timeoutMs ?? 150_000);
  const remaining = () => Math.max(0, deadline - Date.now());

  if (!openaiConfigured()) return { ok: false, reason: "llm-not-configured" };

  const context = await collectPremiumContext(keyword, {
    entity: input.entity,
    related: input.relatedEntities,
    relatedKeywords: input.related,
  });
  logger.step("premium-rag", {
    keyword,
    sources: context.sources.length,
    signalFacts: context.signalFacts.length,
    score: context.score,
    providers: context.providers.join(","),
    unwrapped: context.unwrapped.resolved,
    unresolvable: context.unwrapped.failed,
    lookbackHours: context.lookbackHours,
  });
  for (const fact of context.signalFacts) {
    logger.detail(`· [signal] ${fact.slice(0, 100)}`);
  }
  for (const source of context.sources) {
    logger.detail(`· [${source.tier ?? "news"}:${source.publisher}] ${source.title} ${source.url}`);
  }

  if (!canGenerateContext(context)) {
    return {
      ok: false,
      reason: "thin-context",
      detail: `score=${context.score} sources=${context.sources.length}`,
    };
  }

  const relatedRaw = input.related ?? [];
  const filteredRelated = input.briefing
    ? filterBriefingRelatedKeywords(keyword, relatedRaw, input.category)
    : relatedRaw;

  const mode: BriefingGenerationMode | undefined = input.briefing
    ? assessBriefingGenerationMode({
        context,
        relatedRaw,
        relatedFiltered: filteredRelated,
      })
    : undefined;

  if (input.briefing) {
    logger.step("briefing-mode", { mode, relatedRaw: relatedRaw.length, relatedFiltered: filteredRelated.length });
  }

  const sectionTarget = input.briefing && mode ? briefingSectionTarget(mode) : SECTION_TARGET;
  const minChars = input.briefing && mode ? briefingMinChars(mode) : PREMIUM_MIN_CHARS;

  const outline = await planOutline({
    context,
    keyword,
    category: input.category,
    channel: input.channel,
    related: filteredRelated,
    briefing: input.briefing,
    mode,
    sectionTarget,
    logger,
    timeoutMs: remaining(),
  });

  if (!outline) return { ok: false, reason: "llm-empty" };

  const { title, excerpt, table, faq, takeaways } = outline;
  const minFaq = input.briefing && mode === "shorts" ? 1 : 2;
  if (faq.length < minFaq || !table.headers.length) {
    return {
      ok: false,
      reason: "malformed",
      detail: `plan=${outline.plan.length} faq=${faq.length} headers=${table.headers.length}`,
    };
  }

  // Sections run in parallel — wall-clock ≈ one section, not N × timeout.
  const sectionTimeout = input.briefing
    ? Math.min(briefingSectionTimeoutMs(mode), Math.max(60_000, remaining()))
    : Math.max(60_000, Math.floor(remaining() / 2));

  let written = await Promise.all(
    outline.plan.map((_, index) =>
      writeSection({
        index,
        outline,
        keyword,
        context,
        channel: input.channel,
        briefing: input.briefing,
        mode,
        logger,
        timeoutMs: sectionTimeout,
      }).catch(() => null),
    ),
  );

  // Retry only failed slots once (avoids rewriting the whole article).
  const failedIndexes = written
    .map((section, index) => (section ? -1 : index))
    .filter((index) => index >= 0);
  if (failedIndexes.length && remaining() > 40_000) {
    logger.warn("premium-sec-retry", { failed: failedIndexes.length });
    const retries = await Promise.all(
      failedIndexes.map((index) =>
        writeSection({
          index,
          outline,
          keyword,
          context,
          channel: input.channel,
          briefing: input.briefing,
          mode,
          logger,
          timeoutMs: Math.min(sectionTimeout, remaining()),
        }).catch(() => null),
      ),
    );
    failedIndexes.forEach((index, retryIndex) => {
      written[index] = retries[retryIndex] ?? null;
    });
  }

  let sections = written
    .filter((section): section is PremiumSection => Boolean(section))
    .map((section, index) => ({ ...section, headingLevel: (index % 2 === 0 ? 2 : 3) as 2 | 3 }));

  const seenClaims = new Set<string>();
  for (const section of sections) {
    section.paragraphs = section.paragraphs
      .map((paragraph) => dropRepeatedSentences(paragraph, seenClaims))
      .filter(Boolean);
  }
  sections = sections.filter((section) => section.paragraphs.length > 0);

  const minSections = input.briefing && mode === "shorts" ? 2 : 3;
  if (sections.length < minSections) {
    return { ok: false, reason: "malformed", detail: `sections=${sections.length}` };
  }

  sections = polishArticleSections(sections) as PremiumSection[];
  let faqText = polishFaq(faq);
  let excerptText = polishProseText(excerpt);

  const shouldExpand = mode !== "shorts";
  if (shouldExpand) {
    let words = articleWordCount({ title, excerpt: excerptText, sections, faq: faqText, table });
    let draftChars = premiumCharCount(
      articlePlainText({ title, excerpt: excerptText, sections, faq: faqText, takeaways, table }),
    );
    if ((words < SEO_MIN_WORDS || draftChars < minChars) && remaining() > 20_000) {
      logger.step("premium-seo-expand", { words, chars: draftChars, target: SEO_MIN_WORDS });
      const expanded = await expandArticleForSeo({
        keyword,
        channel: input.channel,
        excerpt: excerptText,
        sections,
        context,
        logger,
        timeoutMs: Math.min(120_000, remaining()),
      }).catch(() => null);
      if (expanded) {
        sections = polishArticleSections(expanded) as PremiumSection[];
        words = articleWordCount({ title, excerpt: excerptText, sections, faq: faqText, table });
        logger.step("premium-seo-expanded", { words });
      }
    }
  }

  sections = applySeoHeadingStructure(sections) as PremiumSection[];

  const chars = premiumCharCount(
    articlePlainText({ title, excerpt: excerptText, sections, faq: faqText, takeaways, table }),
  );
  logger.step("premium-body", { sections: sections.length, chars, words: articleWordCount({ title, excerpt: excerptText, sections, faq: faqText, table }) });

  if (chars < minChars) {
    return { ok: false, reason: "too-short", detail: `${chars}자 (min ${minChars})` };
  }

  const bodyPlain = articlePlainText({ title, excerpt: excerptText, sections, faq: faqText, takeaways, table });
  if (input.briefing && hasTemplateConnectiveSpam(bodyPlain, 1)) {
    return { ok: false, reason: "banned-copy", detail: "template-connectives" };
  }
  if (input.briefing && hasBriefingBoilerplate(bodyPlain)) {
    return {
      ok: false,
      reason: "banned-copy",
      detail: `briefing-boilerplate:${findBriefingBoilerplate(bodyPlain).join(",")}`,
    };
  }
  if (input.briefing && hasRepetitiveDeclarativeEndings(bodyPlain)) {
    return { ok: false, reason: "banned-copy", detail: "repetitive-endings" };
  }
  if (input.briefing && hasGenericPadding(bodyPlain)) {
    return { ok: false, reason: "banned-copy", detail: "generic-padding" };
  }
  if (input.briefing && hasLeakedMetadata(bodyPlain)) {
    return { ok: false, reason: "banned-copy", detail: "metadata-leak" };
  }
  const duplicateClaims = duplicateClaimCount(bodyPlain);
  if (input.briefing && duplicateClaims > 2) {
    return { ok: false, reason: "banned-copy", detail: `duplicate-claims:${duplicateClaims}` };
  }

  // Locate the offending strings so the repair can target them. Paragraphs and
  // the lede are the only places worth rewriting; a banned phrase in the table
  // or FAQ would be rarer and is caught by the final check below.
  const slots: { get: () => string; set: (value: string) => void }[] = [
    { get: () => excerptText, set: (value) => (excerptText = value) },
    ...sections.flatMap((section, sectionIndex) =>
      section.paragraphs.map((_, paragraphIndex) => ({
        get: () => sections[sectionIndex]!.paragraphs[paragraphIndex]!,
        set: (value: string) => {
          sections[sectionIndex]!.paragraphs[paragraphIndex] = value;
        },
      })),
    ),
  ];

  const offending = slots.filter((slot) => findBannedPhrases(slot.get()).length);
  if (offending.length && remaining() > 10_000) {
    logger.warn("premium-decliche", { strings: offending.length });
    const rewritten = await repairBannedCopy({
      offenders: offending.map((slot) => slot.get()),
      logger,
      timeoutMs: remaining(),
    });
    if (rewritten) {
      rewritten.forEach((value, index) => offending[index]?.set(value));
    }
  }

  const external = outline.externalLink;
  if (!external || !isRetrievedUrl(external.href, context.sources)) {
    return { ok: false, reason: "fabricated-url", detail: external?.href ?? "missing" };
  }

  const parsedInternal = outline.internalLink;
  const internal =
    parsedInternal && parsedInternal.href.startsWith("/search?q=")
      ? parsedInternal
      : internalSearchLink(filteredRelated[0] ?? keyword, parsedInternal?.label ?? "");

  // Target one mention in each section's first keyword-bearing paragraph, which
  // lands the body at five — inside the 5~7 band — and reads as deliberate
  // placement rather than repetition.
  let keywordCount = countOccurrences(bodyPlainText(sections), keyword);
  if (keywordCount > PREMIUM_KEYWORD_MAX && remaining() > 10_000) {
    const targets: { text: string; want: number; set: (value: string) => void }[] = [];
    for (const [sectionIndex, section] of sections.entries()) {
      let kept = false;
      for (const [paragraphIndex, paragraph] of section.paragraphs.entries()) {
        const count = countOccurrences(paragraph, keyword);
        if (!count) continue;
        const want = kept ? 0 : 1;
        if (!kept) kept = true;
        if (count === want) continue;
        targets.push({
          text: paragraph,
          want,
          set: (value: string) => {
            sections[sectionIndex]!.paragraphs[paragraphIndex] = value;
          },
        });
      }
    }

    if (targets.length) {
      logger.warn("premium-density", { count: keywordCount, max: PREMIUM_KEYWORD_MAX, paragraphs: targets.length });
      const rewritten = await repairKeywordDensity({
        keyword,
        targets: targets.map((target) => ({ text: target.text, want: target.want })),
        logger,
        timeoutMs: remaining(),
      });
      if (rewritten) {
        rewritten.forEach((value, index) => targets[index]?.set(value));
        keywordCount = countOccurrences(bodyPlainText(sections), keyword);
      }
    }
  }

  if (keywordCount > PREMIUM_KEYWORD_HARD_MAX) {
    return {
      ok: false,
      reason: "keyword-stuffing",
      detail: `${keywordCount}회 (허용 ${PREMIUM_KEYWORD_MIN}~${PREMIUM_KEYWORD_MAX}회)`,
    };
  }
  if (keywordCount < PREMIUM_KEYWORD_MIN || keywordCount > PREMIUM_KEYWORD_MAX) {
    logger.warn("premium-keyword", {
      count: keywordCount,
      target: `${PREMIUM_KEYWORD_MIN}~${PREMIUM_KEYWORD_MAX}`,
    });
  }

  // Final audits run after every repair: a rewrite pass can reintroduce what an
  // earlier pass removed, so the published text is what gets checked.
  const plain = articlePlainText({ title, excerpt: excerptText, sections, faq: faqText, takeaways, table });
  const banned = findBannedPhrases(plain);
  if (banned.length) {
    return { ok: false, reason: "banned-copy", detail: banned.join(",") };
  }
  if (input.briefing && hasBriefingBoilerplate(plain)) {
    return {
      ok: false,
      reason: "banned-copy",
      detail: `briefing-boilerplate:${findBriefingBoilerplate(plain).join(",")}`,
    };
  }
  if (input.briefing && hasRepetitiveDeclarativeEndings(plain)) {
    return { ok: false, reason: "banned-copy", detail: "repetitive-endings" };
  }
  if (input.briefing && hasGenericPadding(plain)) {
    return { ok: false, reason: "banned-copy", detail: "generic-padding" };
  }
  if (input.briefing && hasLeakedMetadata(plain)) {
    return { ok: false, reason: "banned-copy", detail: "metadata-leak" };
  }

  const finalChars = premiumCharCount(plain);
  if (finalChars < minChars) {
    return { ok: false, reason: "too-short", detail: `${finalChars}자 (min ${minChars})` };
  }

  const publishedAt = input.publishedAt ?? new Date().toISOString();
  const jsonLd = buildJsonLd({
    title,
    excerpt: excerptText,
    url: `${SITE.url}/ranking/${slug}`,
    faq: faqText,
    keyword,
    publishedAt,
  });

  const rendered = renderMarkdown({
    keyword,
    title,
    excerpt: excerptText,
    sections,
    table: { ...table, markdown: tableMarkdown(table), html: renderFactTableHtml(table) },
    faq: faqText,
    takeaways,
    externalLink: { ...external, rel: "noopener noreferrer" },
    internalLink: internal,
    jsonLd,
  });

  const bodyMarkdown = rendered.markdown;
  const bodyHtml = rendered.html;

  logger.step("premium-ok", {
    keyword,
    chars: finalChars,
    keywordCount,
    sections: sections.length,
    faq: faqText.length,
    words: articleWordCount({ title, excerpt: excerptText, sections, faq: faqText, table }),
    sources: context.sources.length,
  });

  return {
    ok: true,
    article: {
      keyword,
      slug,
      title,
      excerpt: excerptText,
      sections,
      table: { ...table, markdown: tableMarkdown(table), html: renderFactTableHtml(table) },
      faq: faqText,
      externalLink: { ...external, rel: "noopener noreferrer" },
      internalLink: internal,
      takeaways,
      bodyMarkdown,
      bodyHtml,
      jsonLd,
      characterCount: finalChars,
      keywordCount,
      sources: context.sources,
      placements: describePlacements(bodyMarkdown),
      model: BRIEFING_LLM.editorModel(),
    },
  };
}
