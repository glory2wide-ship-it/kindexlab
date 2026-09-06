/**
 * One-off: generate culture daily briefing with a longer focus keyword
 * to avoid keyword-stuffing on short board leaders like "혈압".
 *
 * Usage: npx tsx --env-file=.env.local scripts/generate-culture-daily.ts
 */
import { enrichBriefingWithAi } from "../src/lib/briefing/ai-main";
import { editionDateTime } from "../src/lib/briefing/dates";
import { composeBoardChannelEdition } from "../src/lib/briefing/from-boards";
import { persistEdition } from "../src/lib/briefing/persist";
import { isPersistableBriefing } from "../src/lib/briefing/quality";
import {
  polishArticleSections,
  polishFaq,
  polishProseText,
  renderSeoHtml,
  renderSeoMarkdown,
} from "../src/lib/premium/seo-format";
import type { BriefingArticle } from "../src/lib/types";

const EDITION_DATE = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg)) ?? "2026-09-02";
const SLUG = `${EDITION_DATE}-culture-daily`;

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
  const internalLink = article.internalLink ?? { href: "/search", label: "관련 이슈" };
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
  const edition = await composeBoardChannelEdition(
    "culture",
    EDITION_DATE,
    editionDateTime(EDITION_DATE),
  );
  const draft = edition.find((item) => item.slug === SLUG);
  if (!draft) {
    console.error(`draft missing: ${SLUG}`);
    process.exit(1);
  }

  const lead = draft.focusKeyword?.trim() || "혈압";
  const leadKeyword = lead.includes(" ") ? lead : `${lead} 이슈`;
  console.log(`generating ${SLUG} leadKeyword=${leadKeyword}`);

  let article = await enrichBriefingWithAi(draft, {
    leadKeyword,
    relatedKeywords: edition
      .filter((item) => item.slug !== SLUG)
      .slice(0, 4)
      .map((item) => item.focusKeyword)
      .filter((value): value is string => Boolean(value?.trim())),
    categoryHint: "culture",
  });

  article = polishArticle(article);
  const persistable = isPersistableBriefing(article);
  console.log(
    JSON.stringify(
      {
        slug: article.slug,
        title: article.title,
        wordCount: article.wordCount,
        persistable,
      },
      null,
      2,
    ),
  );

  if (!persistable) {
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
