import { composeArticle, composeEdition } from "@/lib/briefing/compose";
import { hasEdition, listSeeded } from "@/lib/briefing/catalog";
import { editionDateTime, kstDateString } from "@/lib/briefing/dates";
import { applyAiDraft, generateWithAi } from "@/lib/briefing/ai";
import { describeEntity, snapshotFromPayload } from "@/lib/briefing/metrics";
import { persistEdition } from "@/lib/briefing/persist";
import { getRankings } from "@/lib/providers/trends";
import type { BriefingArticle, RankingsPayload } from "@/lib/types";

async function currentPayload(): Promise<RankingsPayload> {
  return getRankings();
}

function factsBlock(payload: RankingsPayload): string {
  const snap = snapshotFromPayload(payload);
  const indices = payload.indices
    .map((row) => `${row.label} ${row.value} ${row.changeRate}% (${row.note})`)
    .join("\n");
  const movers = [...snap.gainers.slice(0, 8), ...snap.losers.slice(0, 4)]
    .map(describeEntity)
    .join("\n");
  return `지수\n${indices}\n\n종목\n${movers}`;
}

async function maybeAi(article: BriefingArticle, payload: RankingsPayload): Promise<BriefingArticle> {
  const draft = await generateWithAi({
    editionDate: article.editionDate,
    kind: article.kind,
    category: article.category,
    facts: factsBlock(payload),
  });
  return draft ? applyAiDraft(article, draft) : article;
}

export async function generateEdition(
  payload: RankingsPayload,
  editionDate = kstDateString(),
  persist = false,
): Promise<BriefingArticle[]> {
  const publishedAt = editionDateTime(editionDate);
  const composed = composeEdition(payload, editionDate, publishedAt);
  const articles = await Promise.all(composed.map((article) => maybeAi(article, payload)));

  if (persist) await persistEdition(articles);
  return articles;
}

export async function generateSingle(
  payload: RankingsPayload,
  editionDate: string,
  kind: BriefingArticle["kind"],
  category: BriefingArticle["category"],
): Promise<BriefingArticle> {
  const publishedAt = editionDateTime(editionDate, 7, kind === "main" ? 5 : 20);
  const base = composeArticle(payload, { editionDate, kind, category, publishedAt });
  return maybeAi(base, payload);
}

export async function runDailyBriefingJob(options?: {
  persist?: boolean;
  force?: boolean;
  editionDate?: string;
}): Promise<{
  skipped: boolean;
  reason?: string;
  editionDate: string;
  persisted: boolean;
  articles: BriefingArticle[];
}> {
  const editionDate = options?.editionDate ?? kstDateString();
  if (!options?.force && hasEdition(editionDate)) {
    return {
      skipped: true,
      reason: "edition already published",
      editionDate,
      persisted: false,
      articles: listSeeded().filter((item) => item.editionDate === editionDate),
    };
  }

  const persist = options?.persist ?? true;
  const articles = await generateEdition(await currentPayload(), editionDate, persist);
  return {
    skipped: false,
    editionDate,
    persisted: persist,
    articles,
  };
}
