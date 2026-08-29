import { editionDateTime, formatKoreanDate } from "@/lib/briefing/dates";
import {
  categoryLabel,
  snapshotFromPayload,
  type MarketSnapshot,
} from "@/lib/briefing/metrics";
import {
  channelDeskTypes,
  channelMainLabel,
  desksForChannel,
  isPresidentialDesk,
  type ChannelBriefingDesk,
} from "@/lib/briefing/desks";
import { withBriefingCover } from "@/lib/briefing/cover";
import {
  buildIssueCompareTable,
  buildIssueFaq,
  catalystSentences,
  deskPlaybookSentences,
  insightSentences,
  issueWhySentences,
  names,
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
  evaluateEditorial,
  normalizeEditorialSentences,
  officialLinkForTopic,
  resetEditorialPass,
  toParagraphs,
  uniqueLines,
  type EditorialDoc,
} from "@/lib/editorial/rules";
import { channelFromEntityType, POST_CHANNELS } from "@/lib/posts/channels";
import { rankingPath } from "@/lib/slugs";
import type {
  BriefingArticle,
  BriefingKind,
  BriefingSection,
  CategoryId,
  EntityType,
  RankingEntity,
  RankingsPayload,
} from "@/lib/types";
import type { PostChannel } from "@/lib/posts/types";

function channelForCategory(category: CategoryId): PostChannel {
  if (category === "all") return "entertainment";
  return channelFromEntityType(category);
}

function pickKeywords(keyword: ReturnType<typeof issueKeywordFromEntity>) {
  return pickIssueKeywords(keyword);
}

function sectorItems(snapshot: MarketSnapshot, category: CategoryId): RankingEntity[] {
  if (category === "all") return snapshot.gainers;
  return snapshot.byType[category as EntityType] ?? snapshot.gainers;
}

function fallbackLead(label: string): RankingEntity {
  return {
    id: "composite",
    slug: "kindexlab-composite",
    name: label,
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
    tags: [label],
    summary: "",
    analysis: "",
    products: [],
  };
}

function articleToDoc(article: BriefingArticle): EditorialDoc {
  return {
    title: article.title,
    excerpt: article.excerpt,
    focusKeyword: article.focusKeyword ?? "",
    supportKeyword: article.supportKeyword ?? "",
    sections: article.sections.map((section) => ({
      heading: section.heading,
      headingLevel: section.headingLevel,
      paragraphs: section.paragraphs,
      kind: section.kind,
    })),
    table: article.table ?? null,
    faq: article.faq,
    internalLink: article.internalLink ?? null,
    externalLink: article.externalLink ?? null,
    coverSrc: article.coverImage?.src,
  };
}

export function countWords(article: Pick<BriefingArticle, "title" | "excerpt" | "sections" | "faq" | "internalLink">): number {
  const faqText = article.faq?.flatMap((item) => [item.question, item.answer]).join(" ") ?? "";
  const text = [
    article.title,
    article.excerpt,
    faqText,
    ...article.sections.flatMap((section) => [section.heading ?? "", ...section.paragraphs]),
    article.internalLink?.label ? `내부 링크 추천: [${article.internalLink.label}]` : "",
  ].join(" ");
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function buildTable(keywords: ReturnType<typeof issueKeywordFromEntity>[], caption: string) {
  return buildIssueCompareTable(keywords.slice(0, 5), caption);
}

function weaveFocusIntro(paragraphs: string[], focus: string): string[] {
  if (!paragraphs.length) return paragraphs;
  const [first, ...rest] = paragraphs;
  if (first.includes(focus)) return paragraphs;
  return [`${focus}가 지금 화제인 배경부터 먼저 적는다. ${first}`, ...rest];
}

function finalizeBriefing(
  article: BriefingArticle,
  reserve: string[],
  _tapePad: string[] = [],
): BriefingArticle {
  const intro = article.sections[0];
  if (intro) intro.paragraphs = weaveFocusIntro(intro.paragraphs, article.focusKeyword ?? "");
  normalizeEditorialSentences(articleToDoc(article));

  const cursor = { i: 0 };
  const appendChunk = () => {
    if (cursor.i >= reserve.length) return false;
    const chunk = reserve.slice(cursor.i, cursor.i + 10);
    cursor.i += 10;
    const target = article.sections[article.sections.length - 1];
    if (!target) return false;
    target.paragraphs.push(...toParagraphs(chunk));
    return true;
  };

  let guard = 0;
  while (countWords(article) < MIN_WORDS && guard < 16) {
    if (!appendChunk()) break;
    normalizeEditorialSentences(articleToDoc(article));
    guard += 1;
  }
  let words = countWords(article);
  while (words > MAX_WORDS) {
    const last = article.sections[article.sections.length - 1];
    if (last && last.paragraphs.length > 2) last.paragraphs.pop();
    else if (article.sections.length > 3) article.sections.pop();
    else break;
    words = countWords(article);
  }
  const wordCount = countWords(article);
  return {
    ...article,
    wordCount,
    readingMinutes: Math.max(4, Math.round(wordCount / 180)),
  };
}

export function ensureBriefingLength(
  article: BriefingArticle,
  snapshot: MarketSnapshot,
  min = MIN_WORDS,
): BriefingArticle {
  if (countWords(article) >= min) {
    return { ...article, wordCount: countWords(article) };
  }
  const category = article.category === "all" ? "kpop" : article.category;
  const lead =
    article.kind === "main"
      ? snapshot.gainers[0]
      : sectorItems(snapshot, category)[0] ?? snapshot.gainers[0];
  if (!lead) return { ...article, wordCount: countWords(article) };
  const rest = (article.kind === "main" ? snapshot.gainers : sectorItems(snapshot, category)).filter(
    (item) => item.id !== lead.id,
  );
  const keyword = issueKeywordFromEntity(
    lead,
    rest.map((item) => ({ name: item.name, slug: item.slug })),
  );
  const { focus, supportKw } = pickKeywords(keyword);
  const label = keyword.topicLabel;
  return finalizeBriefing(
    article,
    padIssueReserve({
      keyword,
      focus: article.focusKeyword || focus,
      supportKw: article.supportKeyword || supportKw,
      dateLabel: formatKoreanDate(article.editionDate),
      label,
    }),
    extraCauseSentences({
      keyword,
      focus: article.focusKeyword || focus,
      supportKw: article.supportKeyword || supportKw,
    }),
  );
}

function deskItems(
  snapshot: MarketSnapshot,
  channel: PostChannel,
  options: { kind: BriefingKind; category: CategoryId; deskId?: string },
): RankingEntity[] {
  if (options.kind === "main") {
    const types = new Set(channelDeskTypes(channel));
    if (!types.size) return [];
    return snapshot.gainers.filter((item) => types.has(item.type));
  }
  if (isPresidentialDesk(options.deskId)) {
    const pool = [...(snapshot.byType.politician_support ?? [])];
    const president =
      pool.find((item) => item.name === "이재명" || /대통령/.test(item.name)) ?? pool[0];
    if (!president) return sectorItems(snapshot, options.category);
    return [president, ...pool.filter((item) => item.id !== president.id)];
  }
  return sectorItems(snapshot, options.category === "all" ? "kpop" : options.category);
}

function composeDraft(
  snapshot: MarketSnapshot,
  dateLabel: string,
  options: {
    editionDate: string;
    publishedAt: string;
    kind: BriefingKind;
    category: CategoryId;
    channel: PostChannel;
    deskId?: string;
    deskLabel?: string;
  },
): BriefingArticle {
  const channel = options.channel ?? channelForCategory(options.kind === "main" ? "all" : options.category);
  resetEditorialPass();
  const category = options.kind === "main" ? "all" : options.category === "all" ? "kpop" : options.category;
  const items = deskItems(snapshot, channel, { kind: options.kind, category, deskId: options.deskId });
  const deskChromeLabel =
    options.kind === "main" ? channelMainLabel(channel) : (options.deskLabel ?? categoryLabel(category));
  const lead = items[0] ?? fallbackLead(deskChromeLabel);
  const rest = items.filter((item) => item.id !== lead.id);
  const keyword = issueKeywordFromEntity(
    lead,
    rest.map((item) => ({ name: item.name, slug: item.slug })),
  );
  const label = keyword.topicLabel;
  const relatedKeywords = rest.slice(0, 4).map((item) =>
    issueKeywordFromEntity(item, [{ name: lead.name, slug: lead.slug }]),
  );
  const { focus, supportKw } = pickKeywords(keyword);
  const relatedPeer = rest[0];
  const internalLink = relatedPeer
    ? { href: rankingPath(relatedPeer.slug), label: relatedIssueTitle(relatedPeer.name) }
    : { href: `/${channel}/briefing`, label: `${getPostChannelLabel(channel)} 일일브리핑` };
  const table = buildTable([keyword, ...relatedKeywords], `${dateLabel} ${label} 이슈 대비표`);
  const faq = buildIssueFaq({ keyword, focus, supportKw, label });
  const deskKey = options.kind === "main" ? "daily" : (options.deskId ?? String(category)).replaceAll("_", "-");

  const sections: BriefingSection[] = [
    {
      heading: numberedHeading(0, `${focus}가 오늘 화제인 배경`),
      headingLevel: 2,
      kind: "tape",
      paragraphs: weaveFocusIntro(
        toParagraphs(surgeCauseSentences({ keyword, focus, supportKw })),
        focus,
      ),
    },
    {
      heading: numberedHeading(1, `${supportKw}가 관심을 키운 이유`),
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
      paragraphs: toParagraphs(deskPlaybookSentences({ focus, supportKw, dateLabel, label })),
    },
    {
      heading: numberedHeading(4, `${supportKw} 다음 관심이 남는 자리`),
      headingLevel: 3,
      kind: "briefing",
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

  const kindLabel = options.kind === "main" ? `${getPostChannelLabel(channel)} 칼럼` : label;
  const draft: BriefingArticle = {
    id: `brief-${options.editionDate}-${channel}-${deskKey}`,
    slug: `${options.editionDate}-${channel}-${deskKey}`,
    kind: options.kind,
    category: options.kind === "main" ? "all" : category,
    channel,
    deskId: options.kind === "main" ? `${channel}-daily` : options.deskId,
    deskLabel: deskChromeLabel,
    editionDate: options.editionDate,
    title: `${focus}가 지금 화제인 이유, ${dateLabel} ${kindLabel}`,
    excerpt: `${focus}의 배경과 ${supportKw} 파급을 입문으로 푼다. ${names([lead, ...rest], 2)} 이야기를 정리한다.`,
    publishedAt: options.publishedAt,
    updatedAt: options.publishedAt,
    readingMinutes: 4,
    wordCount: 0,
    relatedEntitySlugs: [lead, ...rest].map((item) => item.slug).slice(0, 6),
    focusKeyword: focus,
    supportKeyword: supportKw,
    table,
    faq,
    externalLink: officialLinkForTopic(keyword.topic, channel),
    internalLink,
    sections,
  };

  return finalizeBriefing(
    draft,
    padIssueReserve({ keyword, focus, supportKw, dateLabel, label }),
    extraCauseSentences({ keyword, focus, supportKw }),
  );
}

function getPostChannelLabel(channel: PostChannel): string {
  return POST_CHANNELS.find((item) => item.id === channel)?.label ?? channel;
}

type ComposeOptions = {
  editionDate: string;
  kind: BriefingKind;
  category: CategoryId;
  publishedAt: string;
  channel?: PostChannel;
  deskId?: string;
  deskLabel?: string;
};

export function composeArticle(payload: RankingsPayload, options: ComposeOptions): BriefingArticle {
  const channel = options.channel ?? channelForCategory(options.kind === "main" ? "all" : options.category);
  const snapshot = snapshotFromPayload(payload);
  const dateLabel = formatKoreanDate(options.editionDate);
  const article = composeDraft(snapshot, dateLabel, { ...options, channel });
  const items = deskItems(snapshot, channel, {
    kind: options.kind,
    category: options.category,
    deskId: options.deskId,
  });
  return withBriefingCover(article, {
    keyword: items[0]?.name,
    imageUrl: items[0]?.imageUrl,
  });
}

export function composeChannelEdition(
  payload: RankingsPayload,
  channel: PostChannel,
  editionDate: string,
  publishedAt: string,
): BriefingArticle[] {
  const desks = desksForChannel(channel);
  const main = composeArticle(payload, {
    editionDate,
    kind: "main",
    category: "all",
    publishedAt,
    channel,
    deskId: `${channel}-daily`,
    deskLabel: channelMainLabel(channel),
  });
  const dives = desks.map((desk: ChannelBriefingDesk, index) => {
    const totalMinutes = 15 + index * 5;
    const hour = 7 + Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return composeArticle(payload, {
      editionDate,
      kind: "deep-dive",
      category: desk.category,
      publishedAt: editionDateTime(editionDate, hour, minute),
      channel,
      deskId: desk.id,
      deskLabel: desk.label,
    });
  });
  return [main, ...dives];
}

export function composeEdition(payload: RankingsPayload, editionDate: string, publishedAt: string) {
  return POST_CHANNELS.flatMap((channel, index) =>
    composeChannelEdition(
      payload,
      channel.id,
      editionDate,
      editionDateTime(editionDate, 7, index * 3),
    ),
  );
}

export function evaluateBriefingSpec(article: BriefingArticle) {
  return evaluateEditorial(articleToDoc(article));
}

export function finalizeEditorialArticle(
  article: BriefingArticle,
  reserve: string[],
  tapePad: string[] = [],
): BriefingArticle {
  return finalizeBriefing(article, reserve, tapePad);
}
