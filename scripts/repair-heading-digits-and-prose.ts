/**
 * Repair numbered H2s whose content digits were stripped by the old
 * formatNumberedH2 regex (e.g. "❶ 만 인파" ← "100만"), and coalesce thin
 * one-sentence paragraphs in briefings/extra.json.
 *
 *   npx tsx scripts/repair-heading-digits-and-prose.ts
 */
import { writeAnalysis, type CachedAnalysis } from "../src/lib/analysis/store";
import {
  coalesceThinParagraphs,
  recoverStrippedHeadingDigits,
} from "../src/lib/premium/postprocess";
import { isKindexFeatureSectionHeading } from "../src/lib/editorial/tense-rules";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

function stripBracket(name: string): string {
  return name.replace(/^\[[^\]]+\]\s*/, "").trim();
}

async function repairAnalyses() {
  const dir = path.join(process.cwd(), "src/data/analysis/entries");
  const files = (await readdir(dir)).filter((name) => name.endsWith(".json"));
  let repaired = 0;

  for (const file of files) {
    const entry = JSON.parse(await readFile(path.join(dir, file), "utf8")) as CachedAnalysis;
    if (!entry?.article?.sections?.length) continue;
    const evidence = [
      entry.article.title,
      entry.article.excerpt,
      ...entry.article.sections.flatMap((section) => section.paragraphs),
    ].join(" ");

    let changed = false;
    const sections = entry.article.sections.map((section) => {
      let heading = section.heading;
      const nextHeading = recoverStrippedHeadingDigits(heading, evidence);
      if (nextHeading !== heading) {
        heading = nextHeading;
        changed = true;
      }
      const paragraphs = coalesceThinParagraphs(section.paragraphs, {
        skip: isKindexFeatureSectionHeading(heading),
      });
      if (paragraphs.join("\n") !== section.paragraphs.join("\n")) changed = true;
      return { ...section, heading, paragraphs };
    });

    // Diversify generic 지원금 ❸/❹ headings with focus keyword.
    const focus = stripBracket(entry.keyword || entry.article.focusKeyword || "");
    if (focus) {
      for (const section of sections) {
        const clean = section.heading.replace(/^[❶❷❸❹❺]\s*/, "");
        if (clean === "지원금을 신청하는 방법") {
          section.heading = section.heading.replace(
            clean,
            `${focus} 신청·자격에서 놓치기 쉬운 점`,
          );
          changed = true;
        }
        if (clean === "다음 모집·쿠폰 일정을 확인하는 법") {
          section.heading = section.heading.replace(
            clean,
            `${focus} 다음 모집·지급 일정을 읽는 법`,
          );
          changed = true;
        }
      }
    }

    if (!changed) continue;
    await writeAnalysis({ ...entry, article: { ...entry.article, sections } });
    repaired += 1;
    console.log(`[analysis] ${entry.slug}`);
  }
  console.log(`[analysis done] repaired=${repaired}`);
}

async function repairBriefingsExtra() {
  const file = path.join(process.cwd(), "src/data/briefings/extra.json");
  const data = JSON.parse(await readFile(file, "utf8")) as {
    articles?: Array<{
      title?: string;
      excerpt?: string;
      focusKeyword?: string;
      sections?: Array<{ heading?: string; paragraphs: string[] }>;
      bodyHtml?: string;
      bodyMarkdown?: string;
    }>;
  };

  let changedArticles = 0;
  for (const article of data.articles ?? []) {
    if (!article.sections?.length) continue;
    const evidence = [
      article.title,
      article.excerpt,
      ...article.sections.flatMap((section) => section.paragraphs),
    ].join(" ");

    let changed = false;
    article.sections = article.sections.map((section) => {
      const heading = section.heading
        ? recoverStrippedHeadingDigits(section.heading, evidence)
        : section.heading;
      if (heading !== section.heading) changed = true;
      const paragraphs = coalesceThinParagraphs(section.paragraphs, {
        skip: isKindexFeatureSectionHeading(heading ?? ""),
      });
      if (paragraphs.join("\n") !== section.paragraphs.join("\n")) changed = true;
      return { ...section, heading, paragraphs };
    });

    if (!changed) continue;
    changedArticles += 1;

    // Refresh markdown/html section bodies when boilerplate structure is simple enough.
    if (article.bodyMarkdown && article.title) {
      // Rebuild bodyMarkdown sections from structured paragraphs (best-effort).
      const blocks = [
        `# ${article.title}`,
        "",
        article.excerpt ?? "",
        "",
        ...article.sections.flatMap((section) => [
          `## ${section.heading ?? ""}`,
          "",
          ...section.paragraphs.flatMap((paragraph) => [paragraph, ""]),
        ]),
      ];
      article.bodyMarkdown = blocks.join("\n");
    }
    if (article.bodyHtml && article.excerpt) {
      const htmlSections = article.sections
        .map((section) => {
          const paras = section.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("\n");
          return `<section>\n<h2>${section.heading ?? ""}</h2>\n${paras}\n</section>`;
        })
        .join("\n");
      article.bodyHtml = `<article class="seo-body">\n<p class="lead">${article.excerpt}</p>\n${htmlSections}\n</article>`;
    }
    console.log(`[briefing] ${article.title}`);
  }

  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`[briefing done] changed=${changedArticles}`);
}

async function main() {
  await repairAnalyses();
  await repairBriefingsExtra();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
