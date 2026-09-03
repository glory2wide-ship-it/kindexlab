import { kstDateString } from "@/lib/briefing/dates";
import { analysisLogger } from "@/lib/analysis/log";
import { BRIEFING_LLM, chatJson, briefingLlmConfigured } from "@/lib/analysis/chain/llm";
import {
  buildIssueCompareTable,
  buildIssueFaq,
  catalystSentences,
  deskPlaybookSentences,
  insightSentences,
  issueWhySentences,
  numberedHeading,
  padIssueReserve,
  peerIssueSentences,
  pickIssueKeywords,
  relatedIssueTitle,
  searchQualitySentences,
  surgeCauseSentences,
  extraCauseSentences,
} from "@/lib/editorial/copy";
import { issueKeywordFromEntity } from "@/lib/editorial/issue-keyword";
import {
  MAX_WORDS,
  MIN_WORDS,
  charLen,
  clipLong,
  countKeyword,
  editorialSystemPrompt,
  extractSentences,
  hasBannedCopy,
  officialLinkForTopic,
  resetEditorialPass,
  SENT_MAX,
  SENT_MIN,
  splitToSentences,
  tableMarkdown,
  toParagraphs,
  uniqueLines,
  line,
} from "@/lib/editorial/rules";
import { TYPE_LABEL } from "@/lib/format";
import { getPostBySlug, listPosts, persistGeneratedPost, replaceGeneratedArticles } from "@/lib/posts/store";
import { CHANNEL_ENTITY_TYPES, channelFromLead } from "@/lib/posts/channels";
import type {
  GeneratedPost,
  MarketFact,
  PostChannel,
  PostFaq,
  PostSection,
  PostSlot,
  PostTable,
} from "@/lib/posts/types";
import { getRankings } from "@/lib/providers/trends";
import { SITE } from "@/lib/site";
import { rankingPath } from "@/lib/slugs";
import type { RankingEntity } from "@/lib/types";

const SLOT_LABEL: Record<PostSlot, string> = {
  morning: "오전 에디션",
  afternoon: "오후 에디션",
  evening: "저녁 에디션",
};

function slotFromDate(date = new Date()): PostSlot {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(date),
  );
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function slugify(editionDate: string, slot: PostSlot, lead: string): string {
  const key = lead.replace(/[^\w가-힣]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "issue";
  return `${editionDate}-${slot}-${key}`.toLowerCase();
}

export function countPostWords(post: Pick<GeneratedPost, "title" | "excerpt" | "sections" | "faq">): number {
  const faqText = post.faq?.flatMap((item) => [item.question, item.answer]).join(" ") ?? "";
  const text = [
    post.title,
    post.excerpt,
    faqText,
    ...post.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
  ].join(" ");
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function tokenCount(parts: string[]): number {
  return parts.join(" ").trim().split(/\s+/).filter(Boolean).length;
}

export function tapeWordCount(
  post: Pick<GeneratedPost, "excerpt" | "sections" | "table">,
): number {
  const tape = post.sections.filter((section) => section.kind === "tape");
  return tokenCount([
    post.excerpt,
    ...tape.flatMap((section) => [section.heading, ...section.paragraphs]),
  ]);
}

export function tapeRatio(post: GeneratedPost): number {
  const total = countPostWords(post);
  if (!total) return 0;
  return tapeWordCount(post) / total;
}

export interface PostSpecReport {
  ok: boolean;
  tapeRatio: number;
  wordCount: number;
  table: boolean;
  faq: number;
  internalLink: boolean;
  externalLink: boolean;
  focusInTitle: boolean;
  focusInIntro: boolean;
  focusCount: number;
  supportCount: number;
  hasH2: boolean;
  hasH3: boolean;
  banned: boolean;
  sentenceIssues: number;
  failures: string[];
}

export function evaluatePostSpec(post: GeneratedPost): PostSpecReport {
  const text = postPlainText(post);
  const intro = post.sections.find((section) => section.kind === "tape") ?? post.sections[0];
  const firstPara = intro?.paragraphs[0] ?? "";
  const ratio = tapeRatio(post);
  const words = countPostWords(post);
  const table = Boolean(post.table?.rows?.length);
  const faq = post.faq?.length ?? 0;
  const internalLink =
    Boolean(post.internalLink?.href && post.internalLink.label) &&
    (text.includes(post.internalLink.href) || text.includes("내부 링크 추천:"));
  const externalLink = Boolean(post.externalLink?.href?.startsWith("http"));
  const focusInTitle = Boolean(post.focusKeyword) && post.title.includes(post.focusKeyword);
  const focusInIntro = Boolean(post.focusKeyword) && firstPara.includes(post.focusKeyword);
  const focusCount = countKeyword(text, post.focusKeyword);
  const supportCount = countKeyword(text, post.supportKeyword);
  const hasH2 = post.sections.some((section) => section.headingLevel === 2);
  const hasH3 = post.sections.some((section) => section.headingLevel === 3);
  const numberedHeadings = post.sections.filter((section) =>
    /^(?:[1-5]\.|[❶❷❸❹❺])\s/.test(section.heading),
  );
  const banned = hasBannedCopy(text);
  const sentenceReport = countSentenceIssues(post);
  const sentenceIssues = sentenceReport.count;
  const failures: string[] = [];
  if (words < MIN_WORDS || words > MAX_WORDS + 40) failures.push(`wordCount:${words}`);
  if (!table || !post.table?.markdown?.includes("|")) failures.push("table");
  if (faq !== 3) failures.push(`faq:${faq}`);
  if (!internalLink) failures.push("internalLink");
  if (!externalLink) failures.push("externalLink");
  if (!focusInTitle) failures.push("focusInTitle");
  if (!focusInIntro) failures.push("focusInIntro");
  if (focusCount < 5) failures.push(`focusCount:${focusCount}`);
  if (supportCount < 5) failures.push(`supportCount:${supportCount}`);
  if (!hasH2 || !hasH3) failures.push("headings");
  if (numberedHeadings.length < 3 || numberedHeadings.length > 5) {
    failures.push(`numberedHeadings:${numberedHeadings.length}`);
  }
  if (banned) failures.push("banned");
  if (sentenceIssues > 0) failures.push(`sentences:${sentenceIssues}:${sentenceReport.sample}`);
  return {
    ok: failures.length === 0,
    tapeRatio: ratio,
    wordCount: words,
    table,
    faq,
    internalLink,
    externalLink,
    focusInTitle,
    focusInIntro,
    focusCount,
    supportCount,
    hasH2,
    hasH3,
    banned,
    sentenceIssues,
    failures,
  };
}

export function countPostCharacters(post: Pick<GeneratedPost, "title" | "excerpt" | "sections">): number {
  const body = post.sections.flatMap((section) => [section.heading, ...section.paragraphs]).join("");
  return `${post.title}${post.excerpt}${body}`.replace(/\s+/g, "").length;
}

function postPlainText(
  post: Pick<GeneratedPost, "title" | "excerpt" | "sections" | "faq" | "internalLink">,
): string {
  return [
    post.title,
    post.excerpt,
    ...post.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    ...(post.faq ?? []).flatMap((item) => [item.question, item.answer]),
    post.internalLink?.label ? `내부 링크 추천: [${post.internalLink.label}]` : "",
  ].join(" ");
}

function countSentenceIssues(post: GeneratedPost): { count: number; sample: string } {
  const blobs = [
    ...post.sections.flatMap((section) => section.paragraphs),
    ...(post.faq ?? []).map((item) => item.answer),
  ];
  const bad: string[] = [];
  for (const blob of blobs) {
    for (const sentence of extractSentences(blob)) {
      const len = charLen(sentence.replace(/\.+$/, ""));
      if (len < SENT_MIN || len > SENT_MAX) bad.push(`${len}:${sentence}`);
    }
  }
  return { count: bad.length, sample: bad[0] ?? "" };
}

function normalizePostSentences(post: GeneratedPost): void {
  for (const section of post.sections) {
    section.paragraphs = toParagraphs(section.paragraphs.flatMap(extractSentences));
  }
  if (post.faq) {
    post.faq = post.faq.map((item) => ({
      ...item,
      answer: toParagraphs(extractSentences(item.answer)).join("\n"),
    }));
  }
}

function fallbackEntity(): RankingEntity {
  return {
    id: "composite",
    slug: "kindexlab-composite",
    name: "종합",
    nameEn: "Composite",
    type: "kpop",
    rank: 1,
    previousRank: 1,
    buzzScore: 1000,
    openScore: 1000,
    fluctuationRate: 0,
    volume: 0,
    sparkline: [0],
    history: [],
    tags: ["이슈"],
    summary: "",
    analysis: "",
    products: [],
  };
}

function triggerKeywords(items: RankingEntity[]): RankingEntity[] {
  return [...items].sort((a, b) => a.rank - b.rank);
}

export async function fetchPublicMarketFacts(): Promise<{
  facts: MarketFact[];
  items: RankingEntity[];
}> {
  const rankings = await getRankings().catch(() => null);
  const items = triggerKeywords(rankings?.items ?? []);
  const lead = items[0];
  const facts: MarketFact[] = [
    {
      id: "keyword",
      label: "이슈 키워드",
      ok: items.length > 0,
      summary: lead ? lead.name : "키워드 없음",
    },
  ];

  return { facts, items };
}

function pickKeywords(keyword: ReturnType<typeof issueKeywordFromEntity>) {
  return pickIssueKeywords(keyword);
}

function buildTable(keywords: ReturnType<typeof issueKeywordFromEntity>[]): PostTable {
  return buildIssueCompareTable(keywords, "이슈 배경·파급 대비표");
}

function buildFaq(
  keyword: ReturnType<typeof issueKeywordFromEntity>,
  focus: string,
  supportKw: string,
): PostFaq[] {
  const label = keyword.topicLabel;
  return buildIssueFaq({ keyword, focus, supportKw, label }).map((item) => {
    const shaped = toParagraphs(extractSentences(item.answer)).join("\n");
    return { question: item.question, answer: shaped || item.answer };
  });
}

function weaveFocusIntro(paragraphs: string[], focus: string): string[] {
  if (!paragraphs.length) return paragraphs;
  const [first, ...rest] = paragraphs;
  if (first.includes(focus)) return paragraphs;
  return [`${line(`${focus}가 지금 화제인 배경부터 먼저 적는다`)} ${first}`, ...rest];
}

function ensureKeywords(post: GeneratedPost): void {
  const text = postPlainText(post);
  const missingFocus = Math.max(0, 5 - countKeyword(text, post.focusKeyword));
  const missingSupport = Math.max(0, 5 - countKeyword(text, post.supportKeyword));
  if (!missingFocus && !missingSupport) return;
  const extra: string[] = [];
  for (let i = 0; i < missingFocus; i += 1) {
    extra.push(
      i === 0
        ? `${post.focusKeyword} 이슈는 배경과 습관으로 가른다`
        : i === 1
          ? `${post.focusKeyword} 관심은 입문 질문에서 갈린다`
          : `${post.focusKeyword} 체류는 다음날 같은 대화에 남는지다`,
    );
  }
  for (let i = 0; i < missingSupport; i += 1) {
    extra.push(
      i === 0
        ? `${post.supportKeyword}가 같은 주제면 테마다`
        : i === 1
          ? `${post.supportKeyword}가 빠지면 단독 유행이다`
          : `${post.supportKeyword} 동조는 옆 이름에서 읽힌다`,
    );
  }
  const target = post.sections.at(-1);
  if (target) target.paragraphs.push(...toParagraphs(uniqueLines(extra)));
}

function fillReserve(opts: {
  keyword: ReturnType<typeof issueKeywordFromEntity>;
  focus: string;
  supportKw: string;
  dateLabel: string;
  label: string;
}): string[] {
  return padIssueReserve(opts);
}

function composeStructured(params: {
  editionDate: string;
  slot: PostSlot;
  items: RankingEntity[];
  leadOverride?: RankingEntity;
  slugOverride?: string;
  idOverride?: string;
  publishedAt?: string;
  channelOverride?: PostChannel;
}): GeneratedPost {
  resetEditorialPass();
  const { editionDate, slot, items } = params;
  const lead = params.leadOverride ?? items[0] ?? fallbackEntity();
  const slug = params.slugOverride ?? slugify(editionDate, slot, lead.name);
  const channel = params.channelOverride ?? channelFromLead(lead, slug);
  // Peers must stay inside the lead's channel, otherwise an entertainment
  // column starts naming politicians from the same ranking snapshot.
  const channelTypes = new Set<RankingEntity["type"]>(CHANNEL_ENTITY_TYPES[channel] ?? []);
  const others = items.filter((item) => item.id !== lead.id);
  const sameType = others.filter((item) => item.type === lead.type);
  const sameChannel = others.filter((item) => channelTypes.has(item.type));
  const rest = sameType.length >= 4 ? sameType : sameChannel.length ? sameChannel : others;
  const keyword = issueKeywordFromEntity(
    lead,
    rest.map((item) => ({ name: item.name, slug: item.slug })),
  );
  const relatedKeywords = rest.slice(0, 4).map((item) =>
    issueKeywordFromEntity(item, [{ name: lead.name, slug: lead.slug }]),
  );
  const { focus, supportKw } = pickKeywords(keyword);
  const label = keyword.topicLabel;
  const relatedPeer = rest[0];
  const internalHref = relatedPeer
    ? rankingPath(relatedPeer.slug)
    : channel === "entertainment"
      ? "/entertainment/briefing"
      : `/${channel}/briefing`;
  const internalLabel = relatedPeer ? relatedIssueTitle(relatedPeer.name) : `${label} 일일브리핑`;
  const table = buildTable([keyword, ...relatedKeywords]);

  const sections: PostSection[] = [
    {
      heading: numberedHeading(0, `${focus}가 오늘 화제인 이유`),
      headingLevel: 2,
      kind: "tape",
      paragraphs: weaveFocusIntro(
        toParagraphs(surgeCauseSentences({ keyword, focus, supportKw })),
        focus,
      ),
    },
    {
      heading: numberedHeading(1, `${supportKw}가 관심을 키운 배경`),
      headingLevel: 2,
      kind: "briefing",
      paragraphs: toParagraphs(issueWhySentences({ keyword, focus, supportKw })),
    },
    {
      heading: numberedHeading(2, `${focus} 파급이 번지는 자리`),
      headingLevel: 3,
      kind: "briefing",
      paragraphs: toParagraphs(searchQualitySentences({ keyword, focus, supportKw })),
    },
    {
      heading: numberedHeading(3, `${label}에서 ${focus}를 읽는 법`),
      headingLevel: 2,
      kind: "briefing",
      paragraphs: toParagraphs(deskPlaybookSentences({ focus, supportKw, dateLabel: editionDate, label })),
    },
    {
      heading: numberedHeading(4, `${supportKw} 다음 관심이 남는 자리`),
      headingLevel: 3,
      kind: "briefing",
      paragraphs: toParagraphs(
        uniqueLines([
          ...insightSentences({ keyword, focus, supportKw, dateLabel: editionDate }),
          ...catalystSentences(keyword, focus, label),
          ...peerIssueSentences(keyword.related.slice(0, 3), keyword.topic, focus, supportKw).slice(0, 8),
          `내부 링크 추천: [${internalLabel}]`,
        ]),
      ),
    },
  ];

  const reserve = fillReserve({
    keyword,
    focus,
    supportKw,
    dateLabel: editionDate,
    label,
  });

  const title = `${focus}가 지금 화제인 이유, ${SLOT_LABEL[slot]} 칼럼`;
  const draft: GeneratedPost = {
    id: params.idOverride ?? `post-${editionDate}-${slot}`,
    slug: slug,
    title,
    excerpt: `${focus}의 배경과 ${supportKw} 파급을 입문으로 푼다.`,
    publishedAt: params.publishedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slot,
    channel,
    editionDate,
    wordCount: 0,
    characterCount: 0,
    readingMinutes: 4,
    focusKeyword: focus,
    supportKeyword: supportKw,
    table,
    faq: buildFaq(keyword, focus, supportKw),
    externalLink: officialLinkForTopic(keyword.topic, channel),
    internalLink: {
      href: internalHref,
      label: internalLabel,
    },
    sources: [
      {
        id: "keyword",
        label: "이슈 키워드",
        ok: true,
        summary: lead.name,
      },
    ],
    products: [],
    sections,
  };

  return finalizePost(draft, reserve);
}

function finalizePost(post: GeneratedPost, reserve: string[]): GeneratedPost {
  const state = { cursor: 0 };
  ensureKeywords(post);
  const intro = post.sections[0];
  if (intro) intro.paragraphs = weaveFocusIntro(intro.paragraphs, post.focusKeyword);
  normalizePostSentences(post);

  const appendChunk = () => {
    if (state.cursor >= reserve.length) return false;
    const chunk = reserve.slice(state.cursor, state.cursor + 10);
    const target = post.sections.at(-1);
    if (!target) return false;
    target.paragraphs.push(...toParagraphs(chunk));
    state.cursor += 10;
    return true;
  };

  let guard = 0;
  while (countPostWords(post) < MIN_WORDS && guard < 16) {
    if (!appendChunk()) break;
    normalizePostSentences(post);
    guard += 1;
  }
  let words = countPostWords(post);
  while (words > MAX_WORDS) {
    const last = post.sections[post.sections.length - 1];
    if (last && last.paragraphs.length > 2) last.paragraphs.pop();
    else if (post.sections.length > 3) post.sections.pop();
    else break;
    words = countPostWords(post);
  }
  return {
    ...post,
    wordCount: countPostWords(post),
    characterCount: countPostCharacters(post),
    readingMinutes: Math.max(8, Math.round(countPostWords(post) / 180)),
  };
}

interface AiDraft {
  title: string;
  excerpt: string;
  sections: PostSection[];
  table?: PostTable;
  faq?: PostFaq[];
}

async function draftWithLlm(input: {
  editionDate: string;
  slot: PostSlot;
  focus: string;
  supportKw: string;
  table: PostTable;
}): Promise<AiDraft | null> {
  if (!briefingLlmConfigured()) return null;

  const draft = await chatJson<AiDraft>({
    system: editorialSystemPrompt(input.focus, input.supportKw),
    user: `키워드만 제공됩니다: ${input.focus}. 보조 주제: ${input.supportKw}. 날짜 ${input.editionDate} 시간대 ${input.slot}. 수치 데이터는 일절 제공되지 않습니다. 이 키워드의 산업적·사회적 배경, 화제가 된 이유, 파급력, 초보자 가이드, 향후 전망만 쓰세요. 표 초안 headers=${input.table.headers.join(",")} rows=${JSON.stringify(input.table.rows.slice(0, 5))}`,
    temperature: 0.35,
    maxTokens: 7_000,
    timeoutMs: 90_000,
    provider: BRIEFING_LLM.provider,
    model: BRIEFING_LLM.draftModel(),
    logger: analysisLogger("content-generator"),
    step: "seo-draft",
  });
  if (!draft?.title || !Array.isArray(draft.sections) || draft.sections.length < 5) return null;
  if (hasBannedCopy(`${draft.title}${draft.excerpt}`)) return null;
  if (!draft.title.includes(input.focus)) return null;
  draft.sections = draft.sections.map((section) => ({
    heading: section.heading,
    headingLevel: section.headingLevel === 3 ? 3 : 2,
    paragraphs: (section.paragraphs ?? [])
      .filter((para) => !hasBannedCopy(para))
      .map((para) => {
        const bits = splitToSentences(para).flatMap(clipLong).slice(0, 4);
        if (bits.length <= 2) return bits.join(" ");
        return bits.join(" ");
      }),
  }));
  const first = draft.sections[0]?.paragraphs[0] ?? "";
  if (!first.includes(input.focus)) return null;
  return draft;
}

export async function generateSeoPost(options?: {
  force?: boolean;
  slot?: PostSlot;
  editionDate?: string;
  lead?: RankingEntity;
  slugOverride?: string;
  idOverride?: string;
  publishedAt?: string;
  persist?: boolean;
  channel?: PostChannel;
}): Promise<{
  skipped: boolean;
  reason?: string;
  persisted: boolean;
  supabase: boolean;
  usedLlm: boolean;
  /** @deprecated Use usedLlm — OpenAI is no longer used for content generation. */
  usedOpenAi: boolean;
  spec: PostSpecReport | null;
  post: GeneratedPost | null;
}> {
  const now = new Date();
  const editionDate = options?.editionDate ?? kstDateString(now);
  const slot = options?.slot ?? slotFromDate(now);
  const snapshot = await fetchPublicMarketFacts();
  const lead = options?.lead ?? snapshot.items[0] ?? fallbackEntity();
  const slug = options?.slugOverride ?? slugify(editionDate, slot, lead.name);
  if (!options?.force && !options?.slugOverride) {
    const existing = await getPostBySlug(slug);
    if (existing && evaluatePostSpec(existing).ok) {
      return {
        skipped: true,
        reason: "slot already published",
        persisted: false,
        supabase: false,
        usedLlm: false,
        usedOpenAi: false,
        spec: evaluatePostSpec(existing),
        post: existing,
      };
    }
  }

  const base = composeStructured({
    editionDate,
    slot,
    items: snapshot.items,
    leadOverride: lead,
    slugOverride: options?.slugOverride,
    idOverride: options?.idOverride,
    publishedAt: options?.publishedAt,
    channelOverride: options?.channel,
  });

  const ai = await draftWithLlm({
    editionDate,
    slot,
    focus: base.focusKeyword,
    supportKw: base.supportKeyword,
    table: base.table,
  });

  const reserve = fillReserve({
    keyword: issueKeywordFromEntity(
      lead,
      snapshot.items
        .filter((item) => item.id !== lead.id && item.type === lead.type)
        .map((item) => ({ name: item.name, slug: item.slug })),
    ),
    focus: base.focusKeyword,
    supportKw: base.supportKeyword,
    dateLabel: editionDate,
    label: TYPE_LABEL[lead.type] || lead.type,
  });

  let usedLlm = false;
  let output = base;
  if (ai) {
    const numberedAi = ai.sections.slice(0, 5).map((section, index) => ({
      ...section,
      heading: numberedHeading(
        index,
        section.heading.replace(/^(?:[1-5]\.|[❶❷❸❹❺])\s+/, ""),
      ),
      headingLevel: (index === 2 || index === 4 ? 3 : 2) as 2 | 3,
      kind: (index === 0 ? "tape" : "briefing") as "tape" | "briefing",
    }));
    const candidate = finalizePost(
      {
        ...base,
        title: ai.title.includes(base.focusKeyword) ? ai.title : base.title,
        excerpt: ai.excerpt || base.excerpt,
        sections: numberedAi.length ? numberedAi : base.sections,
        table: ai.table?.rows?.length ? { ...ai.table, markdown: tableMarkdown(ai.table) } : base.table,
        faq: ai.faq?.length === 3 ? ai.faq : base.faq,
        updatedAt: new Date().toISOString(),
      },
      reserve,
    );
    if (evaluatePostSpec(candidate).ok) {
      output = candidate;
      usedLlm = true;
    }
  }

  const spec = evaluatePostSpec(output);
  if (!spec.ok) {
    output = base;
  }
  const finalSpec = evaluatePostSpec(output);

  if (options?.persist === false) {
    return {
      skipped: false,
      persisted: false,
      supabase: false,
      usedLlm,
      usedOpenAi: usedLlm,
      spec: finalSpec,
      post: output,
    };
  }

  if (!finalSpec.ok) {
    return {
      skipped: false,
      reason: `spec failed: ${finalSpec.failures.join(",")}`,
      persisted: false,
      supabase: false,
      usedLlm,
      usedOpenAi: usedLlm,
      spec: finalSpec,
      post: output,
    };
  }

  const saved = await persistGeneratedPost(output);
  return {
    skipped: false,
    persisted: saved.file,
    supabase: saved.supabase,
    usedLlm,
    usedOpenAi: usedLlm,
    spec: finalSpec,
    post: output,
  };
}

function pickLeadForExisting(
  old: GeneratedPost,
  ranked: RankingEntity[],
  used: Set<string>,
): RankingEntity {
  const hay = `${old.title} ${old.slug} ${old.focusKeyword ?? ""} ${old.excerpt ?? ""}`;
  const named = ranked.find((item) => hay.includes(item.name) && !used.has(item.id));
  if (named) return named;
  return ranked.find((item) => !used.has(item.id)) ?? fallbackEntity();
}

export async function regenerateAllPosts(): Promise<{
  count: number;
  slugs: string[];
  wordCounts: number[];
  tapeRatios: number[];
  specOk: boolean[];
  failures: string[][];
  persisted: boolean;
}> {
  const existing = await listPosts();
  const snapshot = await fetchPublicMarketFacts();
  const ranked = snapshot.items;
  const used = new Set<string>();
  const catalog = existing.length
    ? existing
    : [
        {
          slug: slugify(kstDateString(), "morning", ranked[0]?.name ?? "market"),
          title: "",
          excerpt: "",
          slot: "morning" as PostSlot,
          editionDate: kstDateString(),
          publishedAt: new Date().toISOString(),
          id: `post-${kstDateString()}-morning`,
          focusKeyword: "",
        } as GeneratedPost,
      ];

  const next: GeneratedPost[] = catalog.map((old) => {
    const lead = pickLeadForExisting(old, ranked, used);
    used.add(lead.id);
    return composeStructured({
      editionDate: old.editionDate || kstDateString(),
      slot: old.slot || "morning",
      items: snapshot.items,
      leadOverride: lead,
      slugOverride: old.slug,
      idOverride: old.id,
      publishedAt: old.publishedAt,
      channelOverride: old.channel,
    });
  });

  const reports = next.map((item) => evaluatePostSpec(item));
  const specOk = reports.map((item) => item.ok);
  if (specOk.some((ok) => !ok)) {
    return {
      count: next.length,
      slugs: next.map((item) => item.slug),
      wordCounts: next.map((item) => item.wordCount),
      tapeRatios: next.map((item) => Number(tapeRatio(item).toFixed(3))),
      specOk,
      failures: reports.map((item) => item.failures),
      persisted: false,
    };
  }

  const saved = await replaceGeneratedArticles(next);
  return {
    count: next.length,
    slugs: next.map((item) => item.slug),
    wordCounts: next.map((item) => item.wordCount),
    tapeRatios: next.map((item) => Number(tapeRatio(item).toFixed(3))),
    specOk,
    failures: reports.map((item) => item.failures),
    persisted: saved.file,
  };
}
