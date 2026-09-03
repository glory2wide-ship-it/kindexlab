/**
 * One-off: politics daily briefing 종합 (main only).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/generate-politics-daily.ts
 *   npx tsx --env-file=.env.local scripts/generate-politics-daily.ts 2026-09-03
 */
import { briefingLlmConfigured, briefingProvider } from "../src/lib/analysis/chain/llm";
import { enrichBriefingWithAi } from "../src/lib/briefing/ai-main";
import { composeChannelEdition } from "../src/lib/briefing/compose";
import { editionDateTime, kstDateString } from "../src/lib/briefing/dates";
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
import { BRIEFING_FULL_MIN_CHARS } from "../src/lib/premium/briefing-editorial";
import { premiumCharCount } from "../src/lib/premium/prompt";
import {
  polishArticleSections,
  polishFaq,
  polishProseText,
  renderSeoHtml,
  renderSeoMarkdown,
} from "../src/lib/premium/seo-format";
import { getRankings } from "../src/lib/providers/trends";
import type { BriefingArticle } from "../src/lib/types";

const EDITION_DATE = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg)) ?? kstDateString();
const SLUG = `${EDITION_DATE}-politics-daily`;

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
    href: "/politics/briefing",
    label: "정치 일일브리핑",
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

  const publishedAt = editionDateTime(EDITION_DATE, 7, 5);
  const [payload, topicPool] = await Promise.all([
    getRankings(),
    collectHeatmapTopics("politics"),
  ]);

  const edition = composeChannelEdition(payload, "politics", EDITION_DATE, publishedAt, topicPool);
  const draft = edition.find((item) => item.kind === "main" || item.slug === SLUG);
  if (!draft) {
    console.error(`draft missing: ${SLUG}`);
    process.exit(1);
  }

  const relatedKeywords = edition
    .filter((item) => item.slug !== draft.slug)
    .slice(0, 4)
    .map((item) => item.focusKeyword)
    .filter((value): value is string => Boolean(value?.trim()));

  console.log(
    `generating ${draft.slug} lead=${draft.focusKeyword ?? "—"} related=${relatedKeywords.join(", ")} provider=${briefingProvider()}`,
  );

  let article = await enrichBriefingWithAi(draft, {
    leadKeyword: draft.focusKeyword,
    relatedKeywords,
    categoryHint: "politics",
  });
  article = polishArticle(article);

  const plain = briefingPlainText(article);
  const chars = premiumCharCount(plain);
  const persistable = isPersistableBriefing(article);
  const gates = {
    persistable,
    chars,
    minChars: BRIEFING_FULL_MIN_CHARS,
    boilerplate: hasBriefingBoilerplate(plain),
    boilerplateHits: findBriefingBoilerplate(plain).slice(0, 5),
    genericPadding: hasGenericPadding(plain),
    leakedMetadata: hasLeakedMetadata(plain),
    repetitiveEndings: hasRepetitiveDeclarativeEndings(plain),
    connectiveSpam: hasTemplateConnectiveSpam(plain),
  };

  console.log(
    JSON.stringify(
      {
        slug: article.slug,
        title: article.title,
        wordCount: article.wordCount,
        characterCount: article.characterCount,
        focusKeyword: article.focusKeyword,
        sections: article.sections.length,
        faq: article.faq?.length ?? 0,
        gates,
      },
      null,
      2,
    ),
  );

  if (!persistable || chars < BRIEFING_FULL_MIN_CHARS) {
    console.error("quality gate failed");
    process.exit(1);
  }

  const result = await persistEdition([article]);
  console.log("persisted", result);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
