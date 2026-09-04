import { BRIEFING_LLM, chatJson, briefingLlmConfigured } from "@/lib/analysis/chain/llm";
import type { AnalysisLogger } from "@/lib/analysis/log";
import {
  canGenerateContext,
  collectPremiumContext,
  isRetrievedUrl,
  type PremiumSource,
} from "@/lib/premium/context";
import {
  PREMIUM_KEYWORD_HARD_MAX,
  PREMIUM_KEYWORD_MAX,
  PREMIUM_KEYWORD_MIN,
  PREMIUM_MIN_CHARS,
  PREMIUM_FAQ_MIN,
  bannedPhraseReminder,
  buildCacheableSystemPrompt,
  buildSinglePassUserPrompt,
  countOccurrences,
  findBannedPhrases,
  premiumCharCount,
  premiumPromptCacheKey,
} from "@/lib/premium/prompt";
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
  BRIEFING_FULL_TARGET_MAX_CHARS,
  briefingMinChars,
  filterBriefingRelatedKeywords,
  type BriefingGenerationMode,
} from "@/lib/premium/briefing-editorial";
import {
  deskIdFromBriefingSlug,
  resolveInternalLink,
} from "@/lib/premium/internal-link";
import { describeSmartRoute, resolveBriefingModel } from "@/lib/premium/smart-routing";
import { cleanLlmField } from "@/lib/premium/clean";
import { expandBriefingLength, patchDraftViolations, type QualityViolation } from "@/lib/premium/error-patch";
import { autoCorrectArticleFields, padArticleLengthLocally, scrubBannedPhraseStems } from "@/lib/premium/postprocess";
import { ARTICLE_JSON_SCHEMA, REWRITE_LIST_JSON_SCHEMA, hasRequiredKeys } from "@/lib/premium/schemas";
import {
  applySeoHeadingStructure,
  articleWordCount,
  renderFactTableHtml,
  renderSeoHtml,
  renderSeoMarkdown,
} from "@/lib/premium/seo-format";
import { SITE } from "@/lib/site";
import type { PostFaq, PostLink, PostTable } from "@/lib/posts/types";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity } from "@/lib/types";

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
  bodyMarkdown: string;
  bodyHtml: string;
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

function text(value: unknown): string {
  return typeof value === "string" ? cleanLlmField(value.replace(/\s+/g, " ").trim()) : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

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

function focusKeywordCores(keyword: string): string[] {
  const raw = keyword.trim();
  if (!raw) return [];
  const withoutIssue = raw.replace(/\s*이슈\s*$/u, "").trim();
  const paren = withoutIssue.match(/\(([^)]+)\)/u)?.[1]?.trim();
  const outside = withoutIssue.replace(/\([^)]*\)/gu, " ").replace(/\s+/g, " ").trim();
  return [
    ...new Set(
      [raw, withoutIssue, paren, outside].filter(
        (item): item is string => Boolean(item && item.length >= 2),
      ),
    ),
  ];
}

function leadHasFocusKeyword(excerpt: string, keyword: string): boolean {
  return focusKeywordCores(keyword).some((core) => excerpt.includes(core));
}

function ensureFocusKeywordInLead(excerpt: string, keyword: string): string {
  const polished = excerpt.trim();
  if (leadHasFocusKeyword(polished, keyword)) return polished;
  const core = focusKeywordCores(keyword)[0] ?? keyword.trim();
  if (!core) return polished;
  if (!polished) return `${core} 관련 이슈를 정리한다.`;
  return `${core} — ${polished}`;
}

function tableMarkdown(table: PostTable): string {
  if (!table.headers.length || !table.rows.length) return "";
  const head = `| ${table.headers.join(" | ")} |`;
  const sep = `| ${table.headers.map(() => "---").join(" | ")} |`;
  const body = table.rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}

function bodyPlainText(sections: PremiumSection[]): string {
  return sections.flatMap((section) => [section.heading, ...section.paragraphs]).join(" ");
}

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

/** Matches `briefingPlainText` / persist gate — table cells do not count toward length. */
function briefingPersistPlain(draft: {
  title: string;
  excerpt: string;
  sections: PremiumSection[];
  faq: PostFaq[];
}): string {
  return [
    draft.title,
    draft.excerpt,
    ...draft.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    ...draft.faq.flatMap((item) => [item.question, item.answer]),
  ].join(" ");
}

function lengthPlain(
  briefing: boolean | undefined,
  draft: {
    title: string;
    excerpt: string;
    sections: PremiumSection[];
    faq: PostFaq[];
    takeaways: string[];
    table: PostTable;
  },
): string {
  return briefing ? briefingPersistPlain(draft) : articlePlainText(draft);
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

function parseSections(value: unknown): PremiumSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = item as { heading?: unknown; headingLevel?: unknown; paragraphs?: unknown };
    const heading = text(row.heading).replace(/^[❶❷❸❹❺\d.\s]+/, "").trim();
    const paragraphs = stringList(row.paragraphs);
    if (!heading || !paragraphs.length) return [];
    const level = row.headingLevel === 3 ? 3 : 2;
    return [{ heading, headingLevel: level as 2 | 3, paragraphs }];
  });
}

/** Cheap banned-phrase rewrite — only when regex post-process left leftovers. */
async function repairBannedCopy(input: {
  offenders: string[];
  logger: AnalysisLogger;
  timeoutMs?: number;
  briefing?: boolean;
  mode?: BriefingGenerationMode;
  channel?: PostChannel;
}): Promise<string[] | null> {
  const system = buildCacheableSystemPrompt();
  const model = resolveBriefingModel({
    briefing: input.briefing,
    mode: input.mode,
    step: "decliche",
  });
  const result = await chatJson<{ rewritten?: unknown }>({
    system,
    user: [
      "아래 문장들에 금지 표현이 들어 있습니다. 같은 뜻과 비슷한 길이를 유지하되 금지 표현만 제거해 다시 쓰세요.",
      "사실을 바꾸거나 새로 추가하지 마세요.",
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
    model,
    promptCacheKey: premiumPromptCacheKey({
      briefing: input.briefing,
      channel: input.channel,
      mode: input.mode,
    }),
    jsonSchema: REWRITE_LIST_JSON_SCHEMA,
  });

  const rewritten = stringList(result?.rewritten);
  return rewritten.length === input.offenders.length ? rewritten : null;
}

/**
 * Single-pass Structured Output: one chatJson call builds the full article.
 * Outline / per-section loops are removed. Regex post-process runs before gates.
 */
export async function generatePremiumArticle(input: {
  keyword: string;
  slug: string;
  category?: string;
  channel?: PostChannel;
  deskId?: string;
  related?: string[];
  entity?: RankingEntity;
  relatedEntities?: RankingEntity[];
  /** Prefer a known live route (board / briefing / ranking). Never /search?q=. */
  preferredInternalLink?: PostLink | null;
  logger: AnalysisLogger;
  timeoutMs?: number;
  publishedAt?: string;
  /** KST edition date YYYY-MM-DD — anchors tense/freshness in the prompt. */
  editionDate?: string;
  briefing?: boolean;
  /**
   * Today's Analysis only: skip the Gemini length-expand call and pad with
   * local/regex seed lines instead. Daily briefing keeps LLM expand.
   */
  skipLengthExpandLlm?: boolean;
}): Promise<PremiumResult> {
  const { keyword, slug, logger } = input;
  const deadline = Date.now() + (input.timeoutMs ?? 150_000);
  const remaining = () => Math.max(0, deadline - Date.now());

  if (!briefingLlmConfigured()) return { ok: false, reason: "llm-not-configured" };

  const editionDate =
    input.editionDate?.trim() ||
    (slug.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? undefined);

  const context = await collectPremiumContext(keyword, {
    entity: input.entity,
    related: input.relatedEntities,
    relatedKeywords: input.related,
    asOfDate: editionDate,
  });
  logger.step("premium-rag", {
    keyword,
    editionDate: editionDate ?? null,
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

  const mode: BriefingGenerationMode = input.briefing
    ? assessBriefingGenerationMode({
        context,
        relatedRaw,
        relatedFiltered: filteredRelated,
      })
    : "full";

  if (input.briefing) {
    const route = describeSmartRoute({ briefing: true, mode });
    logger.step("briefing-mode", {
      mode,
      tier: route.tier,
      draftModel: route.draft,
      editorModel: route.editor,
      relatedRaw: relatedRaw.length,
      relatedFiltered: filteredRelated.length,
      pipeline: "single-pass",
    });
  }

  const minChars = input.briefing ? briefingMinChars(mode) : PREMIUM_MIN_CHARS;
  const minFaq = input.briefing && mode === "shorts" ? 1 : PREMIUM_FAQ_MIN;
  /** Structured Outputs ARTICLE_JSON_SCHEMA.minItems = 4 */
  const minSections = 4;

  const system = buildCacheableSystemPrompt({ briefing: input.briefing, includeSeo: true });
  const cacheKey = premiumPromptCacheKey({
    briefing: input.briefing,
    channel: input.channel,
    mode,
  });
  const model = resolveBriefingModel({
    briefing: input.briefing,
    mode,
    step: "article",
  });

  const user = buildSinglePassUserPrompt({
    briefing: Boolean(input.briefing),
    mode,
    channel: input.channel ?? "entertainment",
    categoryHint: input.category ?? input.channel ?? "general",
    focusKeyword: keyword,
    relatedKeywords: filteredRelated,
    newsContext: context.block,
    editionDate,
  });

  logger.step("premium-single-pass", { model, mode, systemChars: system.length });

  type ArticleRaw = {
    title?: unknown;
    excerpt?: unknown;
    sections?: unknown;
    table?: unknown;
    faq?: unknown;
    externalLink?: unknown;
    internalLink?: unknown;
    takeaways?: unknown;
  };

  const requestArticle = async (userMessage: string, step: string) =>
    chatJson<ArticleRaw>({
      system,
      user: userMessage,
      temperature: 0.55,
      maxTokens: 16_384,
      timeoutMs: remaining(),
      logger,
      step,
      provider: BRIEFING_LLM.provider,
      model,
      promptCacheKey: cacheKey,
      jsonSchema: ARTICLE_JSON_SCHEMA,
    });

  let raw = await requestArticle(user, "premium-article");

  if (!raw || !hasRequiredKeys(raw, ["title", "excerpt", "sections", "table", "faq"])) {
    logger.warn("premium-article-retry", { reason: "llm-empty" });
    raw = await requestArticle(
      `${user}\n\n[재시도] 응답은 완전 JSON 하나만. sections 4개·FAQ 3개·표 1개를 짧게 닫아 토큰 한도 전에 완성하세요.`,
      "premium-article-retry",
    );
  }

  if (!raw || !hasRequiredKeys(raw, ["title", "excerpt", "sections", "table", "faq"])) {
    return { ok: false, reason: "llm-empty" };
  }

  let title = text(raw.title);
  let excerptText = ensureFocusKeywordInLead(text(raw.excerpt), keyword);
  let sections = parseSections(raw.sections);
  let table = parseTable(raw.table);
  let faqText = parseFaq(raw.faq);
  let takeaways = input.briefing ? [] : stringList(raw.takeaways).slice(0, 4);
  let external = parseLink(raw.externalLink);
  let parsedInternal = parseLink(raw.internalLink);

  if (input.briefing && hasBriefingBoilerplate(title)) {
    title = `${keyword} 핵심 이슈 브리핑`;
    logger.warn("premium-title-rewrite", { reason: "briefing-boilerplate" });
  }

  // Briefing: dedupe only within each paragraph so cross-section fact reuse
  // (same date/name) does not collapse the 1,400자 floor. Premium columns keep
  // article-wide dedupe.
  if (input.briefing) {
    for (const section of sections) {
      section.paragraphs = section.paragraphs
        .map((paragraph) => dropRepeatedSentences(paragraph))
        .filter(Boolean);
    }
  } else {
    const seenClaims = new Set<string>();
    for (const section of sections) {
      section.paragraphs = section.paragraphs
        .map((paragraph) => dropRepeatedSentences(paragraph, seenClaims))
        .filter(Boolean);
    }
  }
  sections = sections.filter((section) => section.paragraphs.length > 0);

  if (sections.length < minSections || faqText.length < minFaq || !table.headers.length) {
    return {
      ok: false,
      reason: "malformed",
      detail: `sections=${sections.length} faq=${faqText.length} headers=${table.headers.length}`,
    };
  }

  // Zero-cost punctuation / boilerplate scrub before quality gates.
  const corrected = autoCorrectArticleFields({
    title,
    excerpt: excerptText,
    sections,
    faq: faqText,
  });
  title = corrected.title;
  excerptText = corrected.excerpt;
  sections = corrected.sections as PremiumSection[];
  faqText = corrected.faq;
  table = {
    ...table,
    caption: scrubBannedPhraseStems(table.caption ?? ""),
    headers: table.headers.map((header) => scrubBannedPhraseStems(header)),
    rows: table.rows.map((row) => row.map((cell) => scrubBannedPhraseStems(cell))),
  };
  takeaways = takeaways.map((item) => scrubBannedPhraseStems(item));
  if (input.briefing && hasBriefingBoilerplate(title)) {
    title = `${keyword} 핵심 이슈 브리핑`;
  }

  sections = applySeoHeadingStructure(sections) as PremiumSection[];

  const chars = premiumCharCount(
    lengthPlain(input.briefing, { title, excerpt: excerptText, sections, faq: faqText, takeaways, table }),
  );
  logger.step("premium-body", {
    sections: sections.length,
    chars,
    words: articleWordCount({ title, excerpt: excerptText, sections, faq: faqText, table }),
  });

  if (chars < minChars && remaining() > 20_000) {
    if (input.skipLengthExpandLlm) {
      logger.warn("premium-length-pad-local", { chars, minChars });
      const seedLines = [
        ...context.signalFacts,
        ...context.sources.flatMap((source) =>
          [source.title, source.snippet].filter((value): value is string => Boolean(value?.trim())),
        ),
      ];
      const padded = padArticleLengthLocally({
        title,
        excerpt: excerptText,
        sections,
        faq: faqText,
        keyword,
        seedLines,
        minChars,
        maxChars: BRIEFING_FULL_TARGET_MAX_CHARS,
      });
      title = padded.title;
      excerptText = padded.excerpt;
      sections = padded.sections as PremiumSection[];
      faqText = padded.faq;
      sections = applySeoHeadingStructure(sections) as PremiumSection[];
      const paddedChars = premiumCharCount(
        lengthPlain(input.briefing, {
          title,
          excerpt: excerptText,
          sections,
          faq: faqText,
          takeaways,
          table,
        }),
      );
      logger.step("premium-body-after-local-pad", {
        sections: sections.length,
        chars: paddedChars,
        added: padded.added,
      });
    } else {
      logger.warn("premium-length-patch", { chars, minChars });
      const expanded = await expandBriefingLength({
        draft: { title, excerpt: excerptText, sections, faq: faqText },
        keyword,
        newsContext: context.block,
        minChars,
        maxChars: BRIEFING_FULL_TARGET_MAX_CHARS,
        currentChars: chars,
        channel: input.channel,
        logger,
        timeoutMs: Math.min(90_000, remaining()),
      });
      if (expanded) {
        title = expanded.title;
        excerptText = expanded.excerpt;
        sections = expanded.sections as PremiumSection[];
        faqText = expanded.faq;
        sections = applySeoHeadingStructure(sections) as PremiumSection[];
        const expandedChars = premiumCharCount(
          lengthPlain(input.briefing, {
            title,
            excerpt: excerptText,
            sections,
            faq: faqText,
            takeaways,
            table,
          }),
        );
        logger.step("premium-body-after-length-patch", {
          sections: sections.length,
          chars: expandedChars,
        });
      }
    }
  }

  const charsAfterLength = premiumCharCount(
    lengthPlain(input.briefing, { title, excerpt: excerptText, sections, faq: faqText, takeaways, table }),
  );
  if (charsAfterLength < minChars) {
    return {
      ok: false,
      reason: "too-short",
      detail: `${charsAfterLength}자 (min ${minChars})`,
    };
  }

  const collectViolations = (): QualityViolation[] => {
    const prosePlain = articlePlainText({
      title: "",
      excerpt: excerptText,
      sections,
      faq: faqText,
      takeaways,
      table,
    });
    const violations: QualityViolation[] = [];
    if (input.briefing && hasTemplateConnectiveSpam(prosePlain, 1)) {
      violations.push({ code: "template-connectives", detail: "템플릿 접속구(~을 보면 등) 과다" });
    }
    if (input.briefing && hasBriefingBoilerplate(prosePlain)) {
      violations.push({
        code: "briefing-boilerplate",
        detail: findBriefingBoilerplate(prosePlain).join(","),
      });
    }
    if (input.briefing && hasRepetitiveDeclarativeEndings(prosePlain)) {
      violations.push({ code: "repetitive-endings", detail: "평서 종결 연속 과다" });
    }
    if (input.briefing && hasGenericPadding(prosePlain)) {
      violations.push({ code: "generic-padding", detail: "일반론·체크리스트 패딩" });
    }
    if (input.briefing && hasLeakedMetadata(prosePlain)) {
      violations.push({ code: "metadata-leak", detail: "메타·SEO·글자수 누설" });
    }
    const duplicateClaims = duplicateClaimCount(prosePlain);
    if (input.briefing && duplicateClaims > 2) {
      violations.push({ code: "duplicate-claims", detail: `중복 주장 ${duplicateClaims}건` });
    }
    return violations;
  };

  let violations = collectViolations();
  // Briefing: no LLM regen — regex post-process only. Premium columns may still patch.
  if (!input.briefing && violations.length && remaining() > 15_000) {
    logger.warn("premium-quality-patch", { codes: violations.map((item) => item.code).join(",") });
    const patched = await patchDraftViolations({
      draft: { title, excerpt: excerptText, sections, faq: faqText },
      violations,
      keyword,
      channel: input.channel,
      logger,
      timeoutMs: Math.min(90_000, remaining()),
    });
    if (patched) {
      title = patched.title;
      excerptText = patched.excerpt;
      sections = patched.sections as PremiumSection[];
      faqText = patched.faq;
      sections = applySeoHeadingStructure(sections) as PremiumSection[];
      violations = collectViolations();
    }
  }

  if (violations.length) {
    return {
      ok: false,
      reason: "banned-copy",
      detail: violations.map((item) => `${item.code}:${item.detail}`).join("|"),
    };
  }

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
  if (!input.briefing && offending.length && remaining() > 10_000) {
    logger.warn("premium-decliche", { strings: offending.length });
    const rewritten = await repairBannedCopy({
      offenders: offending.map((slot) => slot.get()),
      logger,
      timeoutMs: remaining(),
      briefing: input.briefing,
      mode,
      channel: input.channel,
    });
    if (rewritten) {
      rewritten.forEach((value, index) => offending[index]?.set(value));
    }
  }

  if (!external || !isRetrievedUrl(external.href, context.sources)) {
    return { ok: false, reason: "fabricated-url", detail: external?.href ?? "missing" };
  }

  const relatedEntity = input.relatedEntities?.[0] ?? null;
  const deskId =
    input.deskId?.trim() ||
    deskIdFromBriefingSlug(slug, input.channel) ||
    undefined;
  const internal = resolveInternalLink({
    preferred: input.preferredInternalLink,
    fromModel: parsedInternal,
    channel: input.channel,
    deskId,
    relatedEntitySlug: relatedEntity?.slug,
    relatedEntityLabel: relatedEntity?.name,
    labelHint: parsedInternal?.label || input.preferredInternalLink?.label,
  });

  const keywordCount = countOccurrences(bodyPlainText(sections), keyword);
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

  const finalChars = premiumCharCount(
    lengthPlain(input.briefing, { title, excerpt: excerptText, sections, faq: faqText, takeaways, table }),
  );
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

  logger.step("premium-ok", {
    keyword,
    chars: finalChars,
    keywordCount,
    sections: sections.length,
    faq: faqText.length,
    words: articleWordCount({ title, excerpt: excerptText, sections, faq: faqText, table }),
    sources: context.sources.length,
    pipeline: "single-pass",
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
      bodyMarkdown: rendered.markdown,
      bodyHtml: rendered.html,
      jsonLd,
      characterCount: finalChars,
      keywordCount,
      sources: context.sources,
      placements: describePlacements(rendered.markdown),
      model,
    },
  };
}
