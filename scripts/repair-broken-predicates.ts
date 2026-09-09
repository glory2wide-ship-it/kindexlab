/**
 * Repair detached/truncated predicate endings in persisted briefings.
 *   npx tsx --env-file=.env.local scripts/repair-broken-predicates.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { hasBrokenPredicateEndings } from "../src/lib/editorial/rules";
import { scrubBrokenPredicateEndings } from "../src/lib/premium/postprocess";
import { renderSeoHtml, renderSeoMarkdown } from "../src/lib/premium/seo-format";
import type { BriefingArticle } from "../src/lib/types";

const EXTRA = path.join(process.cwd(), "src/data/briefings/extra.json");

function scrub(text: string | undefined): string {
  return scrubBrokenPredicateEndings(text ?? "");
}

async function main() {
  const raw = JSON.parse(await readFile(EXTRA, "utf8")) as { articles: BriefingArticle[] };
  let repaired = 0;
  const articles = raw.articles.map((article) => {
    const before = [
      article.title,
      article.excerpt,
      ...(article.sections ?? []).flatMap((section) => [section.heading, ...section.paragraphs]),
      ...(article.faq ?? []).flatMap((item) => [item.question, item.answer]),
      article.bodyMarkdown ?? "",
      article.bodyHtml ?? "",
    ].join("\n");
    if (!hasBrokenPredicateEndings(before) && !/(?<![\uac00-\ud7a3])습니다/.test(before)) {
      return article;
    }

    const sections = (article.sections ?? []).map((section) => ({
      ...section,
      heading: scrub(section.heading),
      paragraphs: section.paragraphs.map((paragraph) => scrub(paragraph)),
    }));
    const faq = (article.faq ?? []).map((item) => ({
      ...item,
      question: scrub(item.question),
      answer: scrub(item.answer),
    }));
    const excerpt = scrub(article.excerpt);
    const title = scrub(article.title);
    const externalLink = article.externalLink ?? { href: "/", label: "외부 원문" };
    const internalLink = article.internalLink ?? {
      href: `/${article.channel}/briefing`,
      label: "브리핑",
    };
    const table = article.table ?? { caption: "팩트 체크", headers: [], rows: [] };
    const next: BriefingArticle = {
      ...article,
      title,
      excerpt,
      sections,
      faq,
      bodyHtml: renderSeoHtml({ excerpt, sections, table, faq, externalLink, internalLink }),
      bodyMarkdown: renderSeoMarkdown({
        title,
        excerpt,
        sections,
        table,
        faq,
        externalLink,
        internalLink,
      }),
    };
    repaired += 1;
    console.log(`[repaired] ${article.slug}`);
    return next;
  });

  await writeFile(EXTRA, `${JSON.stringify({ articles }, null, 2)}\n`, "utf8");
  console.log(`[done] repaired=${repaired}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
