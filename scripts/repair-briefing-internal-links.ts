/**
 * Rewrite broken `/search?q=` cross-check links in persisted briefings to
 * stable board / channel / briefing routes, then rebuild bodyHtml/Markdown.
 *
 * Usage: npx tsx scripts/repair-briefing-internal-links.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  deskIdFromBriefingSlug,
  isStableInternalHref,
  resolveInternalLink,
} from "../src/lib/premium/internal-link";
import { renderSeoHtml, renderSeoMarkdown } from "../src/lib/premium/seo-format";
import type { BriefingArticle } from "../src/lib/types";

const FILE = path.join(process.cwd(), "src", "data", "briefings", "extra.json");

function rebuildBodies(article: BriefingArticle): BriefingArticle {
  const excerpt = article.excerpt ?? "";
  const sections = (article.sections ?? []).map((section) => ({
    heading: section.heading,
    headingLevel: (section.headingLevel === 3 ? 3 : 2) as 2 | 3,
    paragraphs: section.paragraphs ?? [],
  }));
  const table = article.table ?? { caption: "팩트 체크", headers: [], rows: [] };
  const faq = article.faq ?? [];
  const externalLink = article.externalLink ?? { href: "/", label: "외부 원문" };
  const internalLink = article.internalLink ?? { href: "/briefing", label: "일일브리핑" };
  return {
    ...article,
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
  const raw = await readFile(FILE, "utf8");
  const parsed = JSON.parse(raw) as { articles?: BriefingArticle[] };
  const articles = parsed.articles ?? [];
  let fixed = 0;

  const next = articles.map((article) => {
    const href = article.internalLink?.href ?? "";
    if (isStableInternalHref(href)) return article;

    const deskId =
      article.deskId ||
      deskIdFromBriefingSlug(article.slug, article.channel) ||
      undefined;
    const resolved = resolveInternalLink({
      preferred: null,
      fromModel: article.internalLink,
      channel: article.channel,
      deskId,
      labelHint: article.internalLink?.label || article.deskLabel || article.focusKeyword,
    });

    if (resolved.href === href) return article;
    fixed += 1;
    return rebuildBodies({
      ...article,
      internalLink: resolved,
    });
  });

  await writeFile(FILE, `${JSON.stringify({ articles: next }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ total: articles.length, fixed, path: FILE }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
