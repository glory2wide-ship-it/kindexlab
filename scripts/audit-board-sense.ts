/**
 * Audit Today's Analysis cache for board-sense mismatches (homonym hijacks).
 *
 *   npx tsx scripts/audit-board-sense.ts
 *   npx tsx scripts/audit-board-sense.ts --purge
 */
import { detectBoardSenseMismatch, resolveBoardSense } from "../src/lib/boards/sense";
import { deleteAnalysis, listAnalysis } from "../src/lib/analysis/store";
import { boardSlugFromEntitySlug } from "../src/lib/analysis/briefing-boards";

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function plainFromArticle(article: {
  title?: string;
  excerpt?: string;
  sections?: { heading?: string; paragraphs?: string[] }[];
  faq?: { question?: string; answer?: string }[];
}): string {
  const parts = [article.title ?? "", article.excerpt ?? ""];
  for (const section of article.sections ?? []) {
    parts.push(section.heading ?? "");
    parts.push(...(section.paragraphs ?? []));
  }
  for (const item of article.faq ?? []) {
    parts.push(item.question ?? "", item.answer ?? "");
  }
  return parts.join("\n");
}

async function main() {
  const purge = flag("purge");
  const entries = await listAnalysis();
  const bad: { slug: string; keyword: string; label: string; title: string }[] = [];

  for (const entry of entries) {
    const boardSlug = boardSlugFromEntitySlug(entry.slug);
    const sense = resolveBoardSense({
      boardSlug,
      entitySlug: entry.slug,
      keyword: entry.keyword,
    });
    if (!sense) continue;
    const plain = plainFromArticle(entry.article);
    const label = detectBoardSenseMismatch({
      plainText: plain,
      boardSlug,
      entitySlug: entry.slug,
      keyword: entry.keyword,
    });
    if (!label) continue;
    bad.push({
      slug: entry.slug,
      keyword: entry.keyword,
      label,
      title: entry.article.title,
    });
  }

  console.log(`[audit] scanned=${entries.length} mismatches=${bad.length}`);
  for (const row of bad) {
    console.log(`- ${row.slug} · ${row.label}`);
    console.log(`  keyword=${row.keyword}`);
    console.log(`  title=${row.title}`);
  }

  if (!purge || bad.length === 0) return;

  let removed = 0;
  for (const row of bad) {
    if (await deleteAnalysis(row.slug)) removed += 1;
  }
  console.log(`[purge] removed=${removed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
