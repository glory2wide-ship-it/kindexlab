import { clearAnalysis } from "@/lib/analysis/store";
import { clearPersistedEditions } from "@/lib/briefing/persist";
import { listPosts, replaceGeneratedArticles } from "@/lib/posts/store";

export interface PurgeReport {
  /** 오늘의 분석 — heatmap and ranking-list keyword columns. */
  analysis: number;
  /** 이슈칼럼 — generated posts. */
  posts: number;
  /** 일일브리핑 + 아카이브 — persisted editions. */
  briefings: number;
  total: number;
}

/**
 * Empties every store a published article can live in. Boards are deliberately
 * left alone: they supply the keyword universe the rebuild writes against, so
 * wiping them would leave nothing to regenerate.
 */
export async function purgeContentStores(): Promise<PurgeReport> {
  const posts = (await listPosts()).length;
  const [analysis, briefings] = await Promise.all([clearAnalysis(), clearPersistedEditions()]);
  await replaceGeneratedArticles([]);

  return {
    analysis,
    posts,
    briefings,
    total: analysis + posts + briefings,
  };
}
