/**
 * Re-polish persisted briefing prose: insert missing Korean sentence periods
 * and rebuild bodyHtml / bodyMarkdown.
 *
 * Usage: npx tsx --env-file=.env.local scripts/polish-briefing-punctuation.ts [channel]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  polishArticleSections,
  polishFaq,
  polishProseText,
  renderSeoHtml,
  renderSeoMarkdown,
} from "../src/lib/premium/seo-format";
import type { BriefingArticle } from "../src/lib/types";
import type { PostChannel } from "../src/lib/posts/types";

const EXTRA = path.join("src", "data", "briefings", "extra.json");

async function main() {
  const channelFilter = process.argv.find((arg) =>
    ["entertainment", "politics", "economy", "culture", "travel"].includes(arg),
  ) as PostChannel | undefined;

  const raw = await import("../src/data/briefings/extra.json");
  const articles = ((raw as { articles?: BriefingArticle[] }).articles ?? []) as BriefingArticle[];

  let touched = 0;
  const next = articles.map((article) => {
    if (channelFilter && article.channel !== channelFilter) return article;

    const sections = polishArticleSections(
      (article.sections ?? []).map((section) => ({
        heading: section.heading,
        headingLevel: section.headingLevel === 3 ? 3 : 2,
        paragraphs: section.paragraphs ?? [],
      })),
    );
    const excerpt = polishProseText(article.excerpt ?? "");
    const faq = polishFaq(article.faq ?? []);
    const externalLink = article.externalLink ?? { href: "/", label: "외부 원문" };
    const internalLink = article.internalLink ?? { href: "/search", label: "관련 이슈" };
    const table = article.table ?? { caption: "팩트 체크", headers: [], rows: [] };

    const bodyHtml = renderSeoHtml({
      excerpt,
      sections,
      table,
      faq,
      externalLink,
      internalLink,
    });
    const bodyMarkdown = renderSeoMarkdown({
      title: article.title,
      excerpt,
      sections,
      table,
      faq,
      externalLink,
      internalLink,
    });

    touched += 1;
    return {
      ...article,
      excerpt,
      sections: sections.map((section, index) => ({
        ...(article.sections?.[index] ?? {}),
        heading: section.heading,
        headingLevel: section.headingLevel,
        paragraphs: section.paragraphs,
      })),
      faq,
      bodyHtml,
      bodyMarkdown,
      updatedAt: new Date().toISOString(),
    };
  });

  await writeFile(EXTRA, `${JSON.stringify({ articles: next }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ path: EXTRA, touched, total: articles.length, channel: channelFilter ?? "all" }));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
