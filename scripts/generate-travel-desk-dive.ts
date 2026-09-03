/**
 * One-off: travel board deep-dive (default: 여행 정부지원금).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/generate-travel-desk-dive.ts
 *   npx tsx --env-file=.env.local scripts/generate-travel-desk-dive.ts travel-government-grant-ranking
 *   npx tsx --env-file=.env.local scripts/generate-travel-desk-dive.ts travel-government-grant-ranking 2026-09-03
 */
import { analysisLogger } from "../src/lib/analysis/log";
import { briefingLlmConfigured, briefingProvider } from "../src/lib/analysis/chain/llm";
import { entityTypeForBoardSlug } from "../src/lib/boards/entity-type";
import { editionDateTime, kstDateString } from "../src/lib/briefing/dates";
import { composeBoardChannelEdition } from "../src/lib/briefing/from-boards";
import { collectHeatmapTopics } from "../src/lib/briefing/heatmap-topics";
import { persistEdition } from "../src/lib/briefing/persist";
import { isPersistableBriefing, briefingPlainText } from "../src/lib/briefing/quality";
import {
  findBriefingBoilerplate,
  hasBriefingBoilerplate,
  hasGenericPadding,
  hasLeakedMetadata,
  hasRepetitiveDeclarativeEndings,
  hasTemplateConnectiveSpam,
} from "../src/lib/editorial/rules";
import {
  BRIEFING_SHORTS_MIN_CHARS,
  briefingRelatedKeywords,
} from "../src/lib/premium/briefing-editorial";
import { generatePremiumArticle } from "../src/lib/premium/generate";
import { premiumCharCount } from "../src/lib/premium/prompt";
import {
  polishArticleSections,
  polishFaq,
  polishProseText,
  renderSeoHtml,
  renderSeoMarkdown,
} from "../src/lib/premium/seo-format";
import type { BriefingArticle } from "../src/lib/types";

const DESK_ID =
  process.argv.find((arg) => /^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(arg) && !/^\d{4}-\d{2}-\d{2}$/.test(arg)) ??
  "travel-government-grant-ranking";
const EDITION_DATE = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg)) ?? kstDateString();

function fallbackRelated(deskId: string): string[] {
  const entity = entityTypeForBoardSlug(deskId);
  if (entity === "subsidy") {
    return ["근로자 휴가지원사업", "관광두레", "자연휴양림 이용권", "야간관광 특화도시"];
  }
  return ["국내여행", "주말 나들이", "지역 맛집"];
}

function polishArticle(article: BriefingArticle, deskLabel: string): BriefingArticle {
  const sections = polishArticleSections(
    article.sections.map((section) => ({
      heading: section.heading,
      headingLevel: section.headingLevel === 3 ? 3 : 2,
      paragraphs: section.paragraphs,
    })),
  );
  const excerpt = polishProseText(article.excerpt);
  const faq = polishFaq(article.faq ?? []);
  const externalLink = article.externalLink ?? { href: "/", label: "외부 원문" };
  const internalLink = article.internalLink ?? {
    href: `/board/${DESK_ID}`,
    label: `${deskLabel} 보드`,
  };
  const table = article.table ?? { caption: "팩트 체크", headers: [], rows: [] };
  return {
    ...article,
    excerpt,
    sections: sections.map((section, index) => ({
      ...article.sections[index],
      heading: section.heading,
      headingLevel: section.headingLevel,
      paragraphs: section.paragraphs,
    })),
    faq,
    bodyHtml: renderSeoHtml({ excerpt, sections, table, faq, externalLink, internalLink }),
    bodyMarkdown: renderSeoMarkdown({
      title: article.title,
      excerpt,
      sections,
      table,
      faq,
      externalLink,
      internalLink,
    }),
  };
}

async function main() {
  if (!briefingLlmConfigured()) {
    console.error(`Briefing LLM is not configured (provider=${briefingProvider()}). Set GEMINI_API_KEY.`);
    process.exit(1);
  }

  const publishedAt = editionDateTime(EDITION_DATE);
  const topicPool = await collectHeatmapTopics("travel");
  const edition = await composeBoardChannelEdition("travel", EDITION_DATE, publishedAt, topicPool);
  const draft = edition.find((item) => item.deskId === DESK_ID || item.slug.endsWith(`-${DESK_ID}`));
  if (!draft) {
    console.error(
      `draft missing for desk ${DESK_ID}. desks=`,
      edition.map((item) => item.deskId),
    );
    process.exit(1);
  }

  const deskLabel = draft.deskLabel ?? DESK_ID;
  const rawLead = draft.focusKeyword?.trim() || deskLabel;
  const leadKeyword = rawLead.replace(/\s*이슈\s*$/u, "").trim() || rawLead;
  const related = briefingRelatedKeywords(draft, edition);
  const relatedFinal = related.length ? related : fallbackRelated(DESK_ID);
  console.log(
    JSON.stringify(
      {
        slug: draft.slug,
        deskId: draft.deskId,
        deskLabel,
        leadKeyword,
        related: relatedFinal,
        pipeline: "single-pass",
        provider: briefingProvider(),
      },
      null,
      2,
    ),
  );

  const result = await generatePremiumArticle({
    keyword: leadKeyword,
    slug: draft.slug,
    channel: "travel",
    deskId: draft.deskId ?? DESK_ID,
    category: deskLabel,
    related: relatedFinal,
    preferredInternalLink: draft.internalLink,
    logger: analysisLogger(`briefing:${draft.slug}`),
    timeoutMs: 420_000,
    publishedAt: draft.publishedAt,
    editionDate: EDITION_DATE,
    briefing: true,
  });

  if (!result.ok) {
    console.error("premium failed", result);
    process.exit(1);
  }

  let article: BriefingArticle = {
    ...draft,
    title: result.article.title,
    excerpt: result.article.excerpt,
    sections: result.article.sections.map((section, index) => ({
      heading: section.heading,
      headingLevel: section.headingLevel,
      paragraphs: section.paragraphs,
      kind: index === 0 ? ("tape" as const) : ("briefing" as const),
    })),
    table: result.article.table,
    faq: result.article.faq,
    externalLink: result.article.externalLink,
    internalLink: result.article.internalLink ?? draft.internalLink,
    bodyHtml: result.article.bodyHtml,
    bodyMarkdown: result.article.bodyMarkdown,
    focusKeyword: leadKeyword,
    wordCount: result.article.characterCount,
    readingMinutes: Math.max(5, Math.round(result.article.characterCount / 180)),
    updatedAt: new Date().toISOString(),
  };

  article = polishArticle(article, deskLabel);
  const persistable = isPersistableBriefing(article);
  console.log(
    JSON.stringify(
      {
        slug: article.slug,
        title: article.title,
        focusKeyword: article.focusKeyword,
        wordCount: article.wordCount,
        readingMinutes: article.readingMinutes,
        sections: article.sections.length,
        faq: article.faq?.length ?? 0,
        persistable,
        model: result.article.model,
        excerpt: article.excerpt.slice(0, 160),
      },
      null,
      2,
    ),
  );

  if (!persistable) {
    const plain = briefingPlainText(article);
    const prose = briefingPlainText({ ...article, title: "" });
    console.error("quality gate failed — not persisted", {
      chars: premiumCharCount(plain),
      min: BRIEFING_SHORTS_MIN_CHARS,
      templateConnectives: hasTemplateConnectiveSpam(prose, 1),
      boilerplate: hasBriefingBoilerplate(prose) ? findBriefingBoilerplate(prose) : [],
      repetitiveEndings: hasRepetitiveDeclarativeEndings(prose),
      genericPadding: hasGenericPadding(prose),
      metadataLeak: hasLeakedMetadata(prose),
    });
    process.exit(1);
  }

  const persisted = await persistEdition([article]);
  console.log("persisted", persisted);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
