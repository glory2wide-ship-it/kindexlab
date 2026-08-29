import { editionDateTime, formatKoreanDate, kstDateString } from "@/lib/briefing/dates";
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
  SENT_MAX,
  SENT_MIN,
  charLen,
  countKeyword,
  extractSentences,
  hasBannedCopy,
  officialLinkForTopic,
  resetEditorialPass,
  toParagraphs,
  uniqueLines,
} from "@/lib/editorial/rules";
import { TYPE_LABEL } from "@/lib/format";
import { constituentsForIndex, entityFromIndex, listIndexIds } from "@/lib/indices";
import { channelFromEntityType, channelSectionHref, getPostChannel } from "@/lib/posts/channels";
import type { PostChannel, PostFaq, PostLink, PostTable } from "@/lib/posts/types";
import { rankingPath } from "@/lib/slugs";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

/** Korean 자수: characters with whitespace excluded, the usual editorial unit. */
export const ANALYSIS_MIN = 800;
export const ANALYSIS_MAX = 1000;

export interface TodayAnalysisSection {
  heading: string;
  headingLevel: 2 | 3;
  paragraphs: string[];
}

export interface TodayAnalysisArticle {
  id: string;
  slug: string;
  entitySlug: string;
  title: string;
  excerpt: string;
  editionDate: string;
  publishedAt: string;
  /** 자수: characters excluding whitespace. */
  characterCount: number;
  readingMinutes: number;
  focusKeyword: string;
  supportKeyword: string;
  sections: TodayAnalysisSection[];
  table: PostTable;
  faq: PostFaq[];
  externalLink: PostLink;
  internalLink: PostLink;
  reviewed: boolean;
  /** Premium rebuild only: body with ad containers and the affiliate shelf placed. */
  bodyMarkdown?: string;
  /** Premium rebuild only: Schema.org Article + FAQPage block. */
  jsonLd?: string;
  /** Premium rebuild only: the retrieved articles the column is allowed to cite. */
  sources?: { title: string; url: string; publisher: string; publishedAt?: string }[];
}

export interface TodayAnalysisReport {
  ok: boolean;
  characterCount: number;
  failures: string[];
}

/**
 * Body produced by the news-grounded LLM chain. Only the prose is replaced: the
 * table, FAQ, links, cover image and the length/keyword audit all stay on the
 * deterministic path, so a weak model degrades to a valid column rather than a
 * broken one.
 */
export interface TodayAnalysisOverride {
  title?: string;
  excerpt?: string;
  sections?: TodayAnalysisSection[];
}

export function analysisPlainText(article: TodayAnalysisArticle | null | undefined): string {
  if (!article) return "";
  return [
    article.title ?? "",
    article.excerpt ?? "",
    ...(article.sections ?? []).flatMap((section) => [section.heading, ...(section.paragraphs ?? [])]),
    ...(article.faq ?? []).flatMap((item) => [item.question, item.answer]),
    article.internalLink?.label ? `내부 링크 추천: [${article.internalLink.label}]` : "",
  ].join(" ");
}

export function countAnalysisChars(article: TodayAnalysisArticle): number {
  return analysisPlainText(article).replace(/\s+/g, "").length;
}

function pickKeywords(keyword: ReturnType<typeof issueKeywordFromEntity>) {
  return pickIssueKeywords(keyword);
}

function buildTable(keywords: ReturnType<typeof issueKeywordFromEntity>[]) {
  return buildIssueCompareTable(keywords, "이슈 배경·파급 대비표");
}

function weaveFocusIntro(paragraphs: string[], focus: string): string[] {
  if (!paragraphs.length) return paragraphs;
  const [first, ...rest] = paragraphs;
  if (first.includes(focus)) return paragraphs;
  return [`${focus}가 지금 화제인 배경부터 먼저 적는다. ${first}`, ...rest];
}

function countSentenceIssues(article: TodayAnalysisArticle): { count: number; sample: string } {
  const blobs = [...article.sections.flatMap((section) => section.paragraphs), ...article.faq.map((item) => item.answer)];
  const bad: string[] = [];
  for (const blob of blobs) {
    for (const sentence of extractSentences(blob)) {
      const len = charLen(sentence.replace(/\.+$/, ""));
      if (len < SENT_MIN || len > SENT_MAX) bad.push(`${len}:${sentence}`);
    }
  }
  return { count: bad.length, sample: bad[0] ?? "" };
}

export function evaluateTodayAnalysis(article: TodayAnalysisArticle): TodayAnalysisReport {
  const text = analysisPlainText(article);
  const firstPara = article.sections[0]?.paragraphs[0] ?? "";
  const chars = countAnalysisChars(article);
  const numberedHeadings = article.sections.filter((section) => /^(?:[1-5]\.|[❶❷❸❹❺])\s/.test(section.heading));
  const failures: string[] = [];
  if (chars < ANALYSIS_MIN || chars > ANALYSIS_MAX + 60) failures.push(`charCount:${chars}`);
  if (!article.table?.rows?.length || !article.table.markdown?.includes("|")) failures.push("table");
  if (article.faq.length !== 3) failures.push(`faq:${article.faq.length}`);
  if (!article.internalLink?.href || !article.internalLink.label) failures.push("internalLink");
  if (!text.includes("내부 링크 추천:")) failures.push("internalLinkPhrase");
  if (!article.externalLink?.href?.startsWith("http")) failures.push("externalLink");
  if (!article.title.includes(article.focusKeyword)) failures.push("focusInTitle");
  if (!firstPara.includes(article.focusKeyword)) failures.push("focusInIntro");
  if (countKeyword(text, article.focusKeyword) < 5) {
    failures.push(`focusCount:${countKeyword(text, article.focusKeyword)}`);
  }
  if (countKeyword(text, article.supportKeyword) < 5) {
    failures.push(`supportCount:${countKeyword(text, article.supportKeyword)}`);
  }
  if (!article.sections.some((section) => section.headingLevel === 2)) failures.push("h2");
  if (!article.sections.some((section) => section.headingLevel === 3)) failures.push("h3");
  if (numberedHeadings.length < 3 || numberedHeadings.length > 5) {
    failures.push(`numberedHeadings:${numberedHeadings.length}`);
  }
  if (hasBannedCopy(text)) failures.push("banned");
  const sentenceIssues = countSentenceIssues(article);
  if (sentenceIssues.count > 0) failures.push(`sentences:${sentenceIssues.count}:${sentenceIssues.sample}`);
  return { ok: failures.length === 0, characterCount: chars, failures };
}

/**
 * Re-imposes ❶..❺ numbering and alternating H2/H3 levels on override sections.
 * The audit requires three to five numbered subheads with both levels present,
 * and an upstream model that ignored the instruction would otherwise sink an
 * otherwise usable body.
 */
function normalizeOverrideSections(sections: TodayAnalysisSection[]): TodayAnalysisSection[] {
  return sections.slice(0, 5).map((section, index) => ({
    heading: numberedHeading(index, section.heading.replace(/^[❶❷❸❹❺\d.\s]+/, "").trim()),
    headingLevel: index % 2 === 0 ? 2 : 3,
    paragraphs: [...section.paragraphs],
  }));
}

function normalizeArticle(article: TodayAnalysisArticle): void {
  for (const section of article.sections) {
    section.paragraphs = toParagraphs(section.paragraphs.flatMap(extractSentences));
  }
  article.faq = article.faq.map((item) => ({
    ...item,
    answer: toParagraphs(extractSentences(item.answer)).join("\n"),
  }));
}

function ensureKeywords(article: TodayAnalysisArticle): void {
  const text = analysisPlainText(article);
  const extra: string[] = [];
  const missingFocus = Math.max(0, 5 - countKeyword(text, article.focusKeyword));
  const missingSupport = Math.max(0, 5 - countKeyword(text, article.supportKeyword));
  for (let i = 0; i < missingFocus; i += 1) {
    extra.push(
      i === 0
        ? `${article.focusKeyword} 이슈는 배경과 습관으로 가른다`
        : i === 1
          ? `${article.focusKeyword} 관심은 입문 질문에서 갈린다`
          : `${article.focusKeyword} 체류는 다음날 같은 대화에 남는지다`,
    );
  }
  for (let i = 0; i < missingSupport; i += 1) {
    extra.push(
      i === 0
        ? `${article.supportKeyword}가 같은 주제면 테마다`
        : i === 1
          ? `${article.supportKeyword}가 빠지면 단독 유행이다`
          : `${article.supportKeyword} 동조는 옆 이름에서 읽힌다`,
    );
  }
  if (!extra.length) return;
  const target = article.sections.at(-1);
  if (target) target.paragraphs.push(...toParagraphs(uniqueLines(extra)));
}

function lastLongSection(article: TodayAnalysisArticle) {
  for (let i = article.sections.length - 1; i >= 0; i -= 1) {
    const section = article.sections[i];
    if (section && section.paragraphs.length > 2) return section;
  }
  return undefined;
}

/**
 * Drops one paragraph, preferring one whose removal does not push a keyword
 * under the required five. ensureKeywords appends its backfill to the last
 * section, which is exactly where trimming used to bite, so the two passes
 * would undo each other until the guard ran out and the article failed on
 * supportCount.
 */
function popTrimmable(section: TodayAnalysisSection, article: TodayAnalysisArticle): void {
  const text = analysisPlainText(article);
  const focusSlack = countKeyword(text, article.focusKeyword) - 5;
  const supportSlack = countKeyword(text, article.supportKeyword) - 5;

  for (let i = section.paragraphs.length - 1; i >= 0; i -= 1) {
    const paragraph = section.paragraphs[i] ?? "";
    const focusCost = countKeyword(paragraph, article.focusKeyword);
    const supportCost = countKeyword(paragraph, article.supportKeyword);
    if (focusCost <= focusSlack && supportCost <= supportSlack) {
      section.paragraphs.splice(i, 1);
      return;
    }
  }
  section.paragraphs.pop();
}

function trimToMax(article: TodayAnalysisArticle): void {
  let chars = countAnalysisChars(article);
  while (chars > ANALYSIS_MAX && article.sections.length > 3) {
    const last = article.sections[article.sections.length - 1];
    if (last && last.paragraphs.length > 2) {
      popTrimmable(last, article);
    } else if (article.sections.length > 3) {
      article.sections.pop();
    } else {
      break;
    }
    chars = countAnalysisChars(article);
  }
  while (chars > ANALYSIS_MAX) {
    const last = lastLongSection(article);
    if (!last) break;
    popTrimmable(last, article);
    chars = countAnalysisChars(article);
  }
}

function appendReserve(article: TodayAnalysisArticle, reserve: string[], cursor: { i: number }): boolean {
  if (cursor.i >= reserve.length) return false;
  const chunk = reserve.slice(cursor.i, cursor.i + 10);
  cursor.i += 10;
  const target = article.sections.at(-1);
  if (!target) return false;
  target.paragraphs.push(...toParagraphs(chunk));
  return true;
}

function reviewUntilReady(
  article: TodayAnalysisArticle,
  reserve: string[],
): TodayAnalysisArticle {
  const cursor = { i: 0 };
  normalizeArticle(article);
  article.sections[0] && (article.sections[0].paragraphs = weaveFocusIntro(
    article.sections[0].paragraphs,
    article.focusKeyword,
  ));
  ensureKeywords(article);

  let guard = 0;
  while (countAnalysisChars(article) < ANALYSIS_MIN && guard < 14) {
    if (!appendReserve(article, reserve, cursor)) break;
    normalizeArticle(article);
    guard += 1;
  }
  trimToMax(article);
  ensureKeywords(article);
  normalizeArticle(article);
  article.sections[0] && (article.sections[0].paragraphs = weaveFocusIntro(
    article.sections[0].paragraphs,
    article.focusKeyword,
  ));

  let report = evaluateTodayAnalysis(article);
  guard = 0;
  while (!report.ok && guard < 8) {
    if (report.failures.some((item) => item.startsWith("charCount") && report.characterCount < ANALYSIS_MIN)) {
      if (!appendReserve(article, reserve, cursor)) break;
    }
    if (report.failures.some((item) => item.startsWith("charCount") && report.characterCount > ANALYSIS_MAX)) {
      trimToMax(article);
    }
    if (report.failures.some((item) => item.startsWith("focusCount") || item.startsWith("supportCount"))) {
      ensureKeywords(article);
    }
    normalizeArticle(article);
    report = evaluateTodayAnalysis(article);
    guard += 1;
  }

  article.characterCount = countAnalysisChars(article);
  // Korean reading speed sits near 500 characters a minute.
  article.readingMinutes = Math.max(2, Math.round(article.characterCount / 500));
  article.reviewed = report.ok;
  return article;
}

export function composeTodayAnalysis(options: {
  entity: RankingEntity;
  market: RankingsPayload;
  related?: RankingEntity[];
  editionDate?: string;
  override?: TodayAnalysisOverride;
}): TodayAnalysisArticle {
  resetEditorialPass();
  const { entity, market } = options;
  const editionDate = options.editionDate ?? kstDateString();
  const dateLabel = formatKoreanDate(editionDate);
  const channel = channelFromEntityType(entity.type);
  const channelMeta = getPostChannel(channel);
  const label = TYPE_LABEL[entity.type] || entity.type;
  const peers =
    options.related?.length
      ? options.related
      : market.items.filter((item) => item.id !== entity.id && item.type === entity.type).slice(0, 6);
  const keyword = issueKeywordFromEntity(
    entity,
    peers.map((item) => ({ name: item.name, slug: item.slug })),
  );
  const relatedKeywords = peers.slice(0, 4).map((item) =>
    issueKeywordFromEntity(item, [{ name: entity.name, slug: entity.slug }]),
  );
  const { focus, supportKw } = pickKeywords(keyword);
  const relatedPeer = peers[0];
  const internalLink: PostLink = relatedPeer
    ? {
        href: rankingPath(relatedPeer.slug),
        label: relatedIssueTitle(relatedPeer.name),
      }
    : {
        href: channelSectionHref(channel, "briefing"),
        label: `${channelMeta.label} 일일브리핑`,
      };
  const table = buildTable([keyword, ...relatedKeywords]);
  const faq = buildIssueFaq({ keyword, focus, supportKw, label }).map((item) => {
    const shaped = toParagraphs(extractSentences(item.answer)).join("\n");
    return { question: item.question, answer: shaped || item.answer };
  });

  const sections: TodayAnalysisSection[] = [
    {
      heading: numberedHeading(0, `${focus}가 오늘 화제인 이유`),
      headingLevel: 2,
      paragraphs: weaveFocusIntro(
        toParagraphs(surgeCauseSentences({ keyword, focus, supportKw })),
        focus,
      ),
    },
    {
      heading: numberedHeading(1, `${supportKw}가 관심을 키운 배경`),
      headingLevel: 2,
      paragraphs: toParagraphs(issueWhySentences({ keyword, focus, supportKw })),
    },
    {
      heading: numberedHeading(2, `${focus} 파급이 번지는 자리`),
      headingLevel: 3,
      paragraphs: toParagraphs(searchQualitySentences({ keyword, focus, supportKw })),
    },
    {
      heading: numberedHeading(3, `${label}에서 ${focus}를 읽는 법`),
      headingLevel: 2,
      paragraphs: toParagraphs(deskPlaybookSentences({ focus, supportKw, dateLabel, label })),
    },
    {
      heading: numberedHeading(4, `${supportKw} 다음 관심이 남는 자리`),
      headingLevel: 3,
      paragraphs: toParagraphs(
        uniqueLines([
          ...insightSentences({ keyword, focus, supportKw, dateLabel }),
          ...catalystSentences(keyword, focus, label),
          ...peerIssueSentences(keyword.related.slice(0, 3), keyword.topic, focus, supportKw).slice(0, 8),
          `내부 링크 추천: [${internalLink.label}]`,
        ]),
      ),
    },
  ];

  const override = options.override;
  const baseTitle = `${focus}가 지금 화제인 이유, 오늘 ${label} 입문`;
  // The audit requires the focus keyword in the headline, so an LLM title that
  // dropped it is discarded rather than patched.
  const title = override?.title?.includes(focus) ? override.title : baseTitle;

  const draft: TodayAnalysisArticle = {
    id: `today-${editionDate}-${entity.slug}`,
    slug: `${editionDate}-${entity.slug}-today`,
    entitySlug: entity.slug,
    title,
    excerpt: override?.excerpt || `${focus}의 배경과 ${supportKw} 파급을 입문으로 푼다.`,
    editionDate,
    publishedAt: editionDateTime(editionDate),
    characterCount: 0,
    readingMinutes: 4,
    focusKeyword: focus,
    supportKeyword: supportKw,
    sections: override?.sections?.length
      ? normalizeOverrideSections(override.sections)
      : sections,
    table,
    faq,
    externalLink: officialLinkForTopic(entity.type, channel),
    internalLink,
    reviewed: false,
  };

  const reserve = uniqueLines([
    ...extraCauseSentences({ keyword, focus, supportKw }),
    ...padIssueReserve({
      keyword,
      focus,
      supportKw,
      dateLabel,
      label,
    }),
  ]);

  return reviewUntilReady(draft, reserve);
}

export function resolveAnalysisEntity(
  slug: string,
  market: RankingsPayload,
): { entity: RankingEntity; related: RankingEntity[] } | null {
  const entity = market.items.find((item) => item.slug === slug);
  if (entity) {
    return {
      entity,
      related: market.items.filter((item) => item.id !== entity.id && item.type === entity.type).slice(0, 6),
    };
  }
  if (!listIndexIds().includes(slug)) return null;
  const index = market.indices.find((item) => item.id === slug);
  if (!index) return null;
  const synthetic = entityFromIndex(index, market.items);
  return {
    entity: synthetic,
    related: constituentsForIndex(index.id, market.items).slice(0, 6),
  };
}

export function composeTodayAnalysisForSlug(
  slug: string,
  market: RankingsPayload,
  editionDate?: string,
  override?: TodayAnalysisOverride,
): TodayAnalysisArticle | null {
  const resolved = resolveAnalysisEntity(slug, market);
  if (!resolved) return null;
  return composeTodayAnalysis({
    entity: resolved.entity,
    market,
    related: resolved.related,
    editionDate,
    override,
  });
}
