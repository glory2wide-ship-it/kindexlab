/**
 * Delete 일일 브리핑 / 심층분석 / 이슈칼럼 / 오늘의 분석 / 보드 리포트
 * generated before a KST cutoff. Default: 2026-09-04 00:00 KST.
 *
 *   npx tsx --env-file=.env.local scripts/purge-content-before.ts
 *   npx tsx scripts/purge-content-before.ts --before=2026-09-04T00:00:00+09:00
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CachedAnalysis } from "../src/lib/analysis/store";
import { emptyBoardReport } from "../src/lib/boards/chain/report";
import { getBoard } from "../src/lib/boards/registry";
import type { CachedBoard } from "../src/lib/boards/types";
import type { BriefingArticle } from "../src/lib/types";
import type { GeneratedPost } from "../src/lib/posts/types";

/** Visitors must never see content before this instant (KST midnight Sep 4). */
const DEFAULT_BEFORE = "2026-09-04T00:00:00+09:00";
const MIN_EDITION_DATE = "2026-09-04";

const ADSENSE_QUALITY_PHRASE =
  /애드센스\s*고품질\s*본문\s*기준\s*충족|고품질\s*본문\s*기준\s*충족/g;

function flag(name: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match?.slice(name.length + 3);
}

function stamp(value?: string | null): number | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function isBeforeCutoff(
  ms: number | null,
  cutoffMs: number,
  editionDate?: string | null,
): boolean {
  if (editionDate && /^\d{4}-\d{2}-\d{2}$/.test(editionDate) && editionDate < MIN_EDITION_DATE) {
    return true;
  }
  // Missing timestamps are treated as old (pre-cutoff) and removed.
  if (ms === null) return Boolean(editionDate && editionDate < MIN_EDITION_DATE);
  return ms < cutoffMs;
}

function scrubText(value: string): string {
  if (!ADSENSE_QUALITY_PHRASE.test(value)) return value;
  ADSENSE_QUALITY_PHRASE.lastIndex = 0;
  return value.replace(ADSENSE_QUALITY_PHRASE, "").replace(/[ \t]{2,}/g, " ").trim();
}

function scrubUnknown(value: unknown): unknown {
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.map(scrubUnknown);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = scrubUnknown(child);
    }
    return out;
  }
  return value;
}

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function writeJson(rel: string, payload: unknown): Promise<void> {
  const file = path.join(process.cwd(), rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function supabaseDeleteBySlugs(table: string, slugs: string[]): Promise<number> {
  const config = supabaseConfig();
  if (!config || !slugs.length) return 0;
  let deleted = 0;
  const chunkSize = 50;
  for (let i = 0; i < slugs.length; i += chunkSize) {
    const chunk = slugs.slice(i, i + chunkSize);
    const filter = chunk.map((slug) => `"${slug.replace(/"/g, '\\"')}"`).join(",");
    const response = await fetch(`${config.url}/rest/v1/${table}?slug=in.(${filter})`, {
      method: "DELETE",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Prefer: "return=minimal",
      },
    });
    if (response.ok) deleted += chunk.length;
    else {
      console.warn(`[supabase] ${table} delete failed: ${response.status} ${await response.text()}`);
    }
  }
  return deleted;
}

async function main() {
  const beforeRaw = flag("before") ?? DEFAULT_BEFORE;
  const cutoffMs = stamp(beforeRaw);
  if (cutoffMs === null) throw new Error(`invalid --before=${beforeRaw}`);
  const cutoffIso = new Date(cutoffMs).toISOString();
  console.log(`[cutoff] ${beforeRaw} → ${cutoffIso} (UTC) · editionDate >= ${MIN_EDITION_DATE}`);

  // --- Briefings (extra.json): mains + deep-dives / Update keywords ---
  const briefingRel = path.join("src", "data", "briefings", "extra.json");
  const briefingRaw = JSON.parse(await readFile(path.join(process.cwd(), briefingRel), "utf8")) as {
    articles?: BriefingArticle[];
  };
  const briefingAll = briefingRaw.articles ?? [];
  const briefingKeep: BriefingArticle[] = [];
  const briefingDrop: BriefingArticle[] = [];
  for (const article of briefingAll) {
    const ms = stamp(article.updatedAt) ?? stamp(article.publishedAt);
    if (isBeforeCutoff(ms, cutoffMs, article.editionDate)) briefingDrop.push(article);
    else briefingKeep.push(scrubUnknown(article) as BriefingArticle);
  }
  await writeJson(briefingRel, { articles: briefingKeep });
  console.log(
    `[briefings] removed ${briefingDrop.length} (main=${briefingDrop.filter((a) => a.kind === "main").length}, deep-dive=${briefingDrop.filter((a) => a.kind === "deep-dive").length}) · kept ${briefingKeep.length}`,
  );

  // --- Issue columns (generated.json) ---
  const postsRel = path.join("src", "data", "posts", "generated.json");
  const postsRaw = JSON.parse(await readFile(path.join(process.cwd(), postsRel), "utf8")) as {
    articles?: GeneratedPost[];
  };
  const postsAll = postsRaw.articles ?? [];
  const postsKeep: GeneratedPost[] = [];
  const postsDrop: GeneratedPost[] = [];
  for (const post of postsAll) {
    const ms = stamp(post.updatedAt) ?? stamp(post.publishedAt);
    if (isBeforeCutoff(ms, cutoffMs, post.editionDate)) postsDrop.push(post);
    else postsKeep.push(scrubUnknown(post) as GeneratedPost);
  }
  await writeJson(postsRel, { articles: postsKeep });
  console.log(`[posts/이슈칼럼] removed ${postsDrop.length} · kept ${postsKeep.length}`);

  // --- Today's analysis (cache.json) ---
  const analysisRel = path.join("src", "data", "analysis", "cache.json");
  const analysisRaw = JSON.parse(await readFile(path.join(process.cwd(), analysisRel), "utf8")) as {
    entries?: CachedAnalysis[];
  };
  const analysisAll = analysisRaw.entries ?? [];
  const analysisKeep: CachedAnalysis[] = [];
  const analysisDrop: CachedAnalysis[] = [];
  for (const entry of analysisAll) {
    const ms = stamp(entry.generatedAt);
    const edition = entry.editionDate || entry.article?.editionDate;
    if (isBeforeCutoff(ms, cutoffMs, edition)) analysisDrop.push(entry);
    else analysisKeep.push(scrubUnknown(entry) as CachedAnalysis);
  }
  await writeJson(analysisRel, { entries: analysisKeep });
  console.log(`[analysis/오늘의분석] removed ${analysisDrop.length} · kept ${analysisKeep.length}`);

  // --- Board ranking reports: keep rankings, strip pre-cutoff editorial reports ---
  const boardsRel = path.join("src", "data", "boards", "cache.json");
  const boardsReportCleared: string[] = [];
  try {
    const boardsRaw = JSON.parse(await readFile(path.join(process.cwd(), boardsRel), "utf8")) as
      | CachedBoard[]
      | { entries?: CachedBoard[] };
    const boardsAll = Array.isArray(boardsRaw) ? boardsRaw : (boardsRaw.entries ?? []);
    const boardsKeep: CachedBoard[] = [];
    for (const entry of boardsAll) {
      const ms = stamp(entry.generatedAt);
      const scrubbed = scrubUnknown(entry) as CachedBoard;
      if (isBeforeCutoff(ms, cutoffMs, entry.editionDate)) {
        boardsReportCleared.push(entry.slug);
        const def = getBoard(entry.slug);
        boardsKeep.push({
          ...scrubbed,
          report: def ? emptyBoardReport(def) : scrubbed.report,
        });
      } else {
        boardsKeep.push(scrubbed);
      }
    }
    await writeJson(boardsRel, Array.isArray(boardsRaw) ? boardsKeep : { entries: boardsKeep });
    console.log(
      `[boards] cleared reports on ${boardsReportCleared.length} pre-cutoff rows · kept rankings ${boardsKeep.length}`,
    );
  } catch {
    console.log("[boards] skipped (no cache.json)");
  }

  // --- Seeded archive briefings (published.ts) ---
  const publishedRel = path.join("src", "data", "briefings", "published.ts");
  const publishedSrc = await readFile(path.join(process.cwd(), publishedRel), "utf8");
  const nextPublished = publishedSrc.replace(
    /const ARCHIVE_DATES = \[[^\]]*\] as const;/,
    "const ARCHIVE_DATES = [] as const;",
  );
  if (nextPublished === publishedSrc) {
    console.warn("[published.ts] ARCHIVE_DATES pattern not updated — check file manually");
  } else {
    await writeFile(path.join(process.cwd(), publishedRel), nextPublished, "utf8");
    console.log("[published.ts] cleared ARCHIVE_DATES");
  }

  // --- Supabase (if configured) ---
  const remotePosts = await supabaseDeleteBySlugs(
    "posts",
    postsDrop.map((item) => item.slug),
  );
  const remoteAnalysis = await supabaseDeleteBySlugs(
    "analysis_cache",
    analysisDrop.map((item) => item.slug),
  );
  if (supabaseConfig()) {
    console.log(
      `[supabase] posts deleted≈${remotePosts} · analysis deleted≈${remoteAnalysis} · board reports cleared locally (rankings retained)`,
    );
  } else {
    console.log("[supabase] skipped (SUPABASE_URL / SERVICE_ROLE_KEY not set)");
  }

  console.log(
    `[done] articles removed≈${briefingDrop.length + postsDrop.length + analysisDrop.length} · board reports cleared≈${boardsReportCleared.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
