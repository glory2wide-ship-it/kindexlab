/**
 * One-off: entertainment deep-dive for 영화 랭킹지수 (boxoffice-expectation)
 * using the single-pass premium briefing pipeline.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/generate-ent-movie-dive.ts
 *   npx tsx --env-file=.env.local scripts/generate-ent-movie-dive.ts 2026-09-03
 */
import { analysisLogger } from "../src/lib/analysis/log";
import { briefingLlmConfigured, briefingProvider } from "../src/lib/analysis/chain/llm";
import { composeChannelEdition } from "../src/lib/briefing/compose";
import { editionDateTime, kstDateString } from "../src/lib/briefing/dates";
import { collectHeatmapTopics } from "../src/lib/briefing/heatmap-topics";
import { persistEdition } from "../src/lib/briefing/persist";
import { isPersistableBriefing } from "../src/lib/briefing/quality";
import { briefingRelatedKeywords } from "../src/lib/premium/briefing-editorial";
import { generatePremiumArticle } from "../src/lib/premium/generate";
import {
  polishArticleSections,
  polishFaq,
  polishProseText,
  renderSeoHtml,
  renderSeoMarkdown,
} from "../src/lib/premium/seo-format";
import { getRankings } from "../src/lib/providers/trends";
import type { BriefingArticle } from "../src/lib/types";

const DESK_ID = "boxoffice-expectation";
const EDITION_DATE = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg)) ?? kstDateString();

function polishArticle(article: BriefingArticle): BriefingArticle {
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
    label: "영화 랭킹지수 보드",
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
  const [payload, topicPool] = await Promise.all([
    getRankings(),
    collectHeatmapTopics("entertainment"),
  ]);
  const edition = composeChannelEdition(
    payload,
    "entertainment",
    EDITION_DATE,
    publishedAt,
    topicPool,
  );
  const draft = edition.find((item) => item.deskId === DESK_ID || item.slug.endsWith(`-${DESK_ID}`));
  if (!draft) {
    console.error(
      `draft missing for desk ${DESK_ID}. desks=`,
      edition.map((item) => item.deskId),
    );
    process.exit(1);
  }

  const rawLead = draft.focusKeyword?.trim() || "F1 더 무비";
  const leadKeyword = rawLead.replace(/\s*이슈\s*$/u, "").trim() || rawLead;
  const related = briefingRelatedKeywords(draft, edition);
  const relatedFinal = related.length ? related : ["박스오피스", "재개봉", "브래드 피트"];
  console.log(
    JSON.stringify(
      {
        slug: draft.slug,
        deskId: draft.deskId,
        deskLabel: draft.deskLabel,
        leadKeyword,
        related: relatedFinal,
        pipeline: "single-pass",
      },
      null,
      2,
    ),
  );

  const result = await generatePremiumArticle({
    keyword: leadKeyword,
    slug: draft.slug,
    channel: "entertainment",
    category: "영화 랭킹지수",
    related: relatedFinal,
    logger: analysisLogger(`briefing:${draft.slug}`),
    timeoutMs: 420_000,
    publishedAt: draft.publishedAt,
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

  article = polishArticle(article);
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
    console.error("quality gate failed — not persisted");
    process.exit(1);
  }

  const persisted = await persistEdition([article]);
  console.log("persisted", persisted);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
