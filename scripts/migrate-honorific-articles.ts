/**
 * One-shot: convert stored briefings / today's analysis / board reports to 합니다체.
 * Usage: npx tsx scripts/migrate-honorific-articles.ts
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  hasPlainDeclarativeEndings,
  toHonorificArticleFields,
  toHonorificProse,
} from "../src/lib/editorial/honorific";

async function migrateBriefings() {
  const file = path.join(process.cwd(), "src/data/briefings/extra.json");
  const raw = JSON.parse(await readFile(file, "utf8")) as { articles: Array<Record<string, unknown>> };
  let changed = 0;
  let plainBefore = 0;
  raw.articles = raw.articles.map((article) => {
    const plain = [
      String(article.excerpt ?? ""),
      ...((article.sections as Array<{ paragraphs?: string[] }> | undefined) ?? []).flatMap(
        (section) => section.paragraphs ?? [],
      ),
    ].join(" ");
    if (hasPlainDeclarativeEndings(plain)) plainBefore += 1;
    const next = toHonorificArticleFields(article as never) as Record<string, unknown>;
    changed += 1;
    return next;
  });
  await writeFile(file, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  return { file: "briefings/extra.json", total: raw.articles.length, plainBefore, changed };
}

async function migrateAnalysisCache() {
  const file = path.join(process.cwd(), "src/data/analysis/cache.json");
  const raw = JSON.parse(await readFile(file, "utf8")) as {
    entries: Record<string, { article?: Record<string, unknown> }>;
  };
  let changed = 0;
  let plainBefore = 0;
  for (const [key, entry] of Object.entries(raw.entries ?? {})) {
    if (!entry?.article) continue;
    const art = entry.article;
    const plain = [
      String(art.excerpt ?? ""),
      ...((art.sections as Array<{ paragraphs?: string[] }> | undefined) ?? []).flatMap(
        (section) => section.paragraphs ?? [],
      ),
    ].join(" ");
    if (hasPlainDeclarativeEndings(plain)) plainBefore += 1;
    entry.article = toHonorificArticleFields(art as never) as Record<string, unknown>;
    raw.entries[key] = entry;
    changed += 1;
  }
  await writeFile(file, `${JSON.stringify(raw)}\n`, "utf8");

  // Shard files under entries/
  const dir = path.join(process.cwd(), "src/data/analysis/entries");
  let shards = 0;
  try {
    const files = await readdir(dir);
    for (const name of files) {
      if (!name.endsWith(".json")) continue;
      const shardPath = path.join(dir, name);
      const shard = JSON.parse(await readFile(shardPath, "utf8")) as {
        article?: Record<string, unknown>;
      };
      if (!shard.article) continue;
      shard.article = toHonorificArticleFields(shard.article as never) as Record<string, unknown>;
      await writeFile(shardPath, `${JSON.stringify(shard)}\n`, "utf8");
      shards += 1;
    }
  } catch {
    /* optional dir */
  }

  return { file: "analysis/cache.json", changed, plainBefore, shards };
}

async function migrateBoardsCache() {
  const file = path.join(process.cwd(), "src/data/boards/cache.json");
  const raw = JSON.parse(await readFile(file, "utf8")) as {
    entries: Record<string, { report?: Record<string, unknown> }>;
  };
  let changed = 0;
  for (const [key, entry] of Object.entries(raw.entries ?? {})) {
    const report = entry?.report as
      | {
          excerpt?: string;
          sections?: Array<{ paragraphs: string[] }>;
          targetAnalysis?: { paragraphs: string[] };
          faq?: Array<{ answer: string }>;
        }
      | undefined;
    if (!report) continue;
    if (report.excerpt) report.excerpt = toHonorificProse(report.excerpt);
    report.sections = report.sections?.map((section) => ({
      ...section,
      paragraphs: section.paragraphs.map((paragraph) => toHonorificProse(paragraph)),
    }));
    if (report.targetAnalysis) {
      report.targetAnalysis = {
        ...report.targetAnalysis,
        paragraphs: report.targetAnalysis.paragraphs.map((paragraph) => toHonorificProse(paragraph)),
      };
    }
    report.faq = report.faq?.map((item) => ({
      ...item,
      answer: toHonorificProse(item.answer),
    }));
    entry.report = report;
    raw.entries[key] = entry;
    changed += 1;
  }
  await writeFile(file, `${JSON.stringify(raw)}\n`, "utf8");
  return { file: "boards/cache.json", changed };
}

async function main() {
  const results = [
    await migrateBriefings(),
    await migrateAnalysisCache(),
    await migrateBoardsCache(),
  ];
  console.log(JSON.stringify(results, null, 2));

  // Spot-check the two named briefings
  const extra = JSON.parse(
    await readFile(path.join(process.cwd(), "src/data/briefings/extra.json"), "utf8"),
  ) as { articles: Array<{ title: string; sections: Array<{ paragraphs: string[] }> }> };
  for (const title of [
    "웹예능 디지털 방송의 변화와 문명특급 이슈 트렌드 분석",
    "GPU 넘어 AI 생태계 플랫폼으로 거듭나는 반도체 공룡의 전략",
  ]) {
    const article = extra.articles.find((item) => item.title === title);
    if (!article) {
      console.log("missing", title);
      continue;
    }
    const plain = article.sections.flatMap((section) => section.paragraphs).join(" ");
    console.log(title, "plainLeft=", hasPlainDeclarativeEndings(plain));
    console.log(" sample:", article.sections[0]?.paragraphs[0]?.slice(0, 120));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
