import type { PostChannel } from "@/lib/posts/types";
import { boardPath, menuBoardsForChannel } from "@/lib/boards/registry";
import { seedBoardIfMissing } from "@/lib/boards/seed";
import type { CachedBoard } from "@/lib/boards/types";
import { formatKoreanDate } from "@/lib/briefing/dates";
import { withBriefingCover } from "@/lib/briefing/cover";
import { getPostChannel } from "@/lib/posts/channels";
import type { BriefingArticle, BriefingSection, CategoryId } from "@/lib/types";
import type { TodayAnalysisSection } from "@/lib/editorial/today-analysis";

function boardCategory(channel: PostChannel): CategoryId {
  if (channel === "economy") return "economy_board";
  if (channel === "culture" || channel === "travel") return "culture_board";
  if (channel === "politics") return "political_search";
  return "influencer";
}

function mapSections(sections: TodayAnalysisSection[] | undefined): BriefingSection[] {
  return (sections ?? []).map((section, index) => ({
    heading: section.heading || `섹션 ${index + 1}`,
    headingLevel: section.headingLevel === 3 ? 3 : 2,
    paragraphs: (section.paragraphs ?? []).filter(Boolean),
    kind: index === 0 ? "tape" : "briefing",
  }));
}

function countWords(article: Pick<BriefingArticle, "title" | "excerpt" | "sections" | "faq">): number {
  const faqText = article.faq?.flatMap((item) => [item.question, item.answer]).join(" ") ?? "";
  const text = [
    article.title,
    article.excerpt,
    faqText,
    ...article.sections.flatMap((section) => [section.heading ?? "", ...section.paragraphs]),
  ].join(" ");
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function briefingFromBoard(
  board: CachedBoard,
  options: {
    kind: BriefingArticle["kind"];
    editionDate: string;
    publishedAt: string;
    deskLabel: string;
    focusKeyword: string;
    supportKeyword: string;
  },
): BriefingArticle {
  const lead = board.ranking[0];
  const rest = board.ranking.slice(1, 5);
  const names = [lead, ...rest].map((row) => row?.name).filter(Boolean);
  const report = board.report;
  const sections = mapSections(report?.sections);
  const filledSections =
    sections.length > 0
      ? sections
      : [
          {
            heading: `${options.focusKeyword} 오늘 순위`,
            headingLevel: 2 as const,
            kind: "tape" as const,
            paragraphs: [
              `${options.focusKeyword} 보드에서 ${lead?.name ?? options.focusKeyword}이(가) 1위입니다.`,
              names.length
                ? `상위권은 ${names.join(" · ")} 순입니다. 지수는 공개 보도와 검색 신호를 묶은 편집 추정치입니다.`
                : `${getPostChannel(board.channel).label} 보드 집계가 비어 있으면 다음 재생성 주기에 채워집니다.`,
            ],
          },
        ];

  const draft: BriefingArticle = {
    id: `brief-${options.editionDate}-${board.channel}-${board.slug}`,
    slug: `${options.editionDate}-${board.channel}-${board.slug}`,
    kind: options.kind,
    category: boardCategory(board.channel),
    channel: board.channel,
    deskId: board.slug,
    deskLabel: options.deskLabel,
    editionDate: options.editionDate,
    title: report?.title || `${options.focusKeyword}가 지금 화제인 이유, ${formatKoreanDate(options.editionDate)}`,
    excerpt:
      report?.excerpt ||
      `${options.focusKeyword} 상위권은 ${names.slice(0, 3).join(" · ") || options.focusKeyword}입니다.`,
    publishedAt: options.publishedAt,
    updatedAt: board.generatedAt || options.publishedAt,
    readingMinutes: report?.readingMinutes ?? 4,
    wordCount: 0,
    relatedEntitySlugs: [board.slug],
    focusKeyword: options.focusKeyword,
    supportKeyword: options.supportKeyword,
    table: report?.table,
    faq: report?.faq,
    internalLink: {
      href: boardPath(board.slug),
      label: `${options.deskLabel} 랭킹 보드`,
    },
    sections: filledSections,
  };
  const wordCount = report?.characterCount
    ? Math.max(countWords(draft), Math.round(report.characterCount / 2))
    : countWords(draft);
  return withBriefingCover(
    {
      ...draft,
      wordCount,
      readingMinutes: Math.max(4, Math.round(wordCount / 180)),
    },
    { keyword: lead?.name || options.focusKeyword },
  );
}

function mainFromBoards(
  channel: PostChannel,
  boards: { defTitle: string; shortTitle: string; focus: string; support: string; cached: CachedBoard }[],
  editionDate: string,
  publishedAt: string,
): BriefingArticle {
  const meta = getPostChannel(channel);
  const dateLabel = formatKoreanDate(editionDate);
  const ranked = [...boards].sort(
    (left, right) =>
      Math.abs(right.cached.indexChangeRate ?? 0) - Math.abs(left.cached.indexChangeRate ?? 0),
  );
  const lines = ranked.map((item) => {
    const lead = item.cached.ranking[0]?.name ?? item.shortTitle;
    const score = item.cached.ranking[0]?.score;
    const scoreText = Number.isFinite(score) ? ` ${Number(score).toFixed(1)}점` : "";
    return `${item.shortTitle} 1위는 ${lead}${scoreText}입니다.`;
  });
  const leadName = ranked[0]?.cached.ranking[0]?.name ?? meta.label;
  const focus = ranked[0]?.focus ?? meta.label;
  const support = ranked[0]?.support ?? "지수";
  const category = boardCategory(channel);

  const draft: BriefingArticle = {
    id: `brief-${editionDate}-${channel}-daily`,
    slug: `${editionDate}-${channel}-daily`,
    kind: "main",
    category,
    channel,
    deskId: `${channel}-daily`,
    deskLabel: `${meta.label} 종합 브리핑`,
    editionDate,
    title: `${leadName}이 ${meta.label} 지수를 끌어올리는 이유, ${dateLabel}`,
    excerpt: `${meta.label} ${ranked.length}개 보드 1위는 ${ranked
      .map((item) => item.cached.ranking[0]?.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(" · ")}입니다.`,
    publishedAt,
    updatedAt: publishedAt,
    readingMinutes: 5,
    wordCount: 0,
    relatedEntitySlugs: ranked.map((item) => item.cached.slug).slice(0, 7),
    focusKeyword: focus,
    supportKeyword: support,
    internalLink: {
      href: `/${channel}`,
      label: `${meta.label} 지수(INDEX)`,
    },
    sections: [
      {
        heading: `${meta.label} 랭킹 보드가 가리키는 오늘`,
        headingLevel: 2,
        kind: "tape",
        paragraphs: [
          `${dateLabel} ${meta.label} 일일브리핑은 엔터테인먼트 시세 종목이 아니라 이 채널의 랭킹 보드만 사용합니다.`,
          ...lines.slice(0, 4),
        ],
      },
      {
        heading: `${focus}가 관심을 끈 자리`,
        headingLevel: 2,
        kind: "briefing",
        paragraphs: [
          `${leadName}이(가) ${ranked[0]?.shortTitle ?? meta.label} 보드 1위입니다. ${support} 흐름과 검색·보도 신호가 겹친 결과입니다.`,
          lines.slice(4).join(" ") || `${meta.label} 나머지 보드는 아래 심층 카드에서 따로 읽습니다.`,
        ],
      },
    ],
  };
  const wordCount = countWords(draft);
  return withBriefingCover(
    { ...draft, wordCount, readingMinutes: Math.max(4, Math.round(wordCount / 180)) },
    { keyword: leadName },
  );
}

/** Economy/culture (and any channel whose live tape is empty) briefings from ranking boards. */
export async function composeBoardChannelEdition(
  channel: PostChannel,
  editionDate: string,
  publishedAt: string,
): Promise<BriefingArticle[]> {
  const defs = menuBoardsForChannel(channel);
  const loaded: {
    defTitle: string;
    shortTitle: string;
    focus: string;
    support: string;
    cached: CachedBoard;
  }[] = [];

  for (const def of defs) {
    if (def.deskKind) continue;
    try {
      const cached = await seedBoardIfMissing(def);
      loaded.push({
        defTitle: def.title,
        shortTitle: def.shortTitle,
        focus: def.focusKeyword,
        support: def.supportKeyword,
        cached,
      });
    } catch {
      /* skip */
    }
  }

  if (!loaded.length) return [];

  const main = mainFromBoards(channel, loaded, editionDate, publishedAt);
  const dives = loaded.map((item, index) =>
    briefingFromBoard(item.cached, {
      kind: "deep-dive",
      editionDate,
      publishedAt: new Date(new Date(publishedAt).getTime() + (index + 1) * 5 * 60_000).toISOString(),
      deskLabel: item.shortTitle,
      focusKeyword: item.focus,
      supportKeyword: item.support,
    }),
  );
  return [main, ...dives];
}

export function channelUsesBoardBriefing(channel: PostChannel): boolean {
  return channel === "economy" || channel === "culture" || channel === "travel";
}
