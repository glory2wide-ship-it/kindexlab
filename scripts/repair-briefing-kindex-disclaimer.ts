/**
 * Repair briefing ❺ sections that only contain the legacy trend-analysis disclaimer.
 * Replaces empty/disclaimer-only KinDex bodies with real copy and strips the disclaimer.
 *
 *   npx tsx scripts/repair-briefing-kindex-disclaimer.ts
 *   npx tsx scripts/repair-briefing-kindex-disclaimer.ts --slug=2026-09-10-entertainment-kpop-fandom-power
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  TREND_ANALYSIS_DISCLAIMER,
  ensureSectionsDisclaimer,
  isTrendDisclaimerOnly,
  stripTrendDisclaimer,
} from "../src/lib/editorial/disclaimer";
import {
  buildKindexFeatureParagraph,
  extractStoryBeatsFromSections,
  isKindexFeatureSectionHeading,
  isUnusableKindexFeatureBody,
} from "../src/lib/editorial/tense-rules";
import type { BriefingArticle } from "../src/lib/types";

function flag(name: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match?.slice(name.length + 3);
}

function replaceOnce(haystack: string, from: string, to: string): string {
  if (!from || !haystack.includes(from)) return haystack;
  return haystack.replace(from, to);
}

function patchArticle(article: BriefingArticle): { article: BriefingArticle; changed: boolean } {
  const sections = article.sections ?? [];
  const kindexIndex = sections.findIndex((section) =>
    isKindexFeatureSectionHeading(section.heading ?? ""),
  );
  if (kindexIndex < 0) {
    const stripped = ensureSectionsDisclaimer(sections);
    const hadDisclaimer =
      JSON.stringify(sections).includes(TREND_ANALYSIS_DISCLAIMER) ||
      Boolean(article.bodyMarkdown?.includes(TREND_ANALYSIS_DISCLAIMER)) ||
      Boolean(article.bodyHtml?.includes(TREND_ANALYSIS_DISCLAIMER));
    if (!hadDisclaimer) return { article, changed: false };
    return {
      changed: true,
      article: {
        ...article,
        sections: stripped,
        ...(article.bodyMarkdown
          ? { bodyMarkdown: stripTrendDisclaimer(article.bodyMarkdown) }
          : {}),
        ...(article.bodyHtml ? { bodyHtml: stripTrendDisclaimer(article.bodyHtml) } : {}),
      },
    };
  }

  const kindex = sections[kindexIndex]!;
  const body = (kindex.paragraphs ?? []).join(" ").trim();
  const withoutDisclaimer = stripTrendDisclaimer(body);
  if (!isUnusableKindexFeatureBody(body) && !isTrendDisclaimerOnly(body)) {
    const stripped = ensureSectionsDisclaimer(sections);
    const hadDisclaimer = JSON.stringify(sections).includes(TREND_ANALYSIS_DISCLAIMER);
    if (!hadDisclaimer) return { article, changed: false };
    return {
      changed: true,
      article: {
        ...article,
        sections: stripped,
        ...(article.bodyMarkdown
          ? { bodyMarkdown: stripTrendDisclaimer(article.bodyMarkdown) }
          : {}),
        ...(article.bodyHtml ? { bodyHtml: stripTrendDisclaimer(article.bodyHtml) } : {}),
      },
    };
  }
  if (withoutDisclaimer && !isUnusableKindexFeatureBody(withoutDisclaimer)) {
    const nextSections = ensureSectionsDisclaimer(
      sections.map((section, index) =>
        index === kindexIndex
          ? { ...section, paragraphs: [withoutDisclaimer] }
          : section,
      ),
    );
    return {
      changed: true,
      article: rewriteBodies(article, body, withoutDisclaimer, nextSections),
    };
  }

  const keyword = article.focusKeyword || article.title || article.slug;
  const paragraph = buildKindexFeatureParagraph({
    keyword,
    storyBeats: extractStoryBeatsFromSections(
      sections.map((section) => ({
        heading: section.heading ?? "",
        paragraphs: section.paragraphs ?? [],
      })),
    ),
  });
  const nextSections = ensureSectionsDisclaimer(
    sections.map((section, index) =>
      index === kindexIndex ? { ...section, paragraphs: [paragraph] } : section,
    ),
  );

  return {
    changed: true,
    article: rewriteBodies(article, body, paragraph, nextSections),
  };
}

function rewriteBodies(
  article: BriefingArticle,
  oldBody: string,
  newParagraph: string,
  nextSections: BriefingArticle["sections"],
): BriefingArticle {
  let bodyMarkdown = article.bodyMarkdown ?? "";
  let bodyHtml = article.bodyHtml ?? "";

  if (oldBody && bodyMarkdown.includes(oldBody)) {
    bodyMarkdown = replaceOnce(bodyMarkdown, oldBody, newParagraph);
  }
  if (oldBody && bodyHtml.includes(oldBody)) {
    bodyHtml = replaceOnce(bodyHtml, oldBody, newParagraph);
  }

  const kindexHeading = /KinDex 데이터가 보여주는 특징/;
  if (bodyMarkdown && kindexHeading.test(bodyMarkdown) && isTrendDisclaimerOnly(oldBody)) {
    bodyMarkdown = bodyMarkdown.replace(
      /(##\s*[❺]?\s*KinDex 데이터가 보여주는 특징\s*\n+)본 글은 단순 트렌드 분석이며 투자 권유가 아닙니다\./,
      `$1${newParagraph}`,
    );
  }
  if (bodyHtml && kindexHeading.test(bodyHtml) && isTrendDisclaimerOnly(oldBody)) {
    bodyHtml = bodyHtml.replace(
      /(<h2>[^<]*KinDex 데이터가 보여주는 특징<\/h2>\s*<p>)본 글은 단순 트렌드 분석이며 투자 권유가 아닙니다\.(<\/p>)/,
      `$1${newParagraph}$2`,
    );
  }

  if (bodyMarkdown.includes(TREND_ANALYSIS_DISCLAIMER)) {
    bodyMarkdown = stripTrendDisclaimer(bodyMarkdown);
  }
  if (bodyHtml.includes(TREND_ANALYSIS_DISCLAIMER)) {
    bodyHtml = stripTrendDisclaimer(bodyHtml);
  }

  return {
    ...article,
    sections: nextSections,
    ...(bodyMarkdown ? { bodyMarkdown } : {}),
    ...(bodyHtml ? { bodyHtml } : {}),
  };
}

async function main() {
  const onlySlug = flag("slug");
  const file = path.join(process.cwd(), "src/data/briefings/extra.json");
  const parsed = JSON.parse(await readFile(file, "utf8")) as {
    articles: BriefingArticle[];
  };

  let scanned = 0;
  let repaired = 0;
  const nextArticles = parsed.articles.map((article) => {
    if (onlySlug && article.slug !== onlySlug) return article;
    scanned += 1;
    const { article: next, changed } = patchArticle(article);
    if (changed) {
      repaired += 1;
      console.log(`[repaired] ${article.slug}`);
    }
    return next;
  });

  if (repaired > 0) {
    await writeFile(
      file,
      `${JSON.stringify({ ...parsed, articles: nextArticles }, null, 2)}\n`,
      "utf8",
    );
  }
  console.log(`[done] scanned=${scanned} repaired=${repaired}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
