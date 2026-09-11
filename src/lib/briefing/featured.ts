import { compareArticles } from "@/lib/briefing/catalog";
import { slimBriefingsForCards } from "@/lib/briefing/card-dto";
import { kstDateString } from "@/lib/briefing/dates";
import { readFeaturedCardsIndex } from "@/lib/briefing/featured-cards";
import { getTodaysBriefings } from "@/lib/briefing/store";
import { POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import type { BriefingArticle } from "@/lib/types";

/**
 * Prefer today's KST edition; when the daily job has not landed yet, keep
 * whatever `getTodaysBriefings` already selected (latest successful slot).
 */
export function filterLiveBriefings(
  articles: BriefingArticle[],
  editionDate = kstDateString(),
): BriefingArticle[] {
  const todays = articles.filter((item) => item.editionDate === editionDate);
  return todays.length ? todays : articles;
}

function pickRoundRobin(articles: BriefingArticle[], limit: number): BriefingArticle[] {
  if (!articles.length || limit <= 0) return [];

  const pools = new Map<PostChannel, BriefingArticle[]>();
  for (const article of articles) {
    const channel = article.channel;
    if (!channel) continue;
    const pool = pools.get(channel);
    if (pool) pool.push(article);
    else pools.set(channel, [article]);
  }
  for (const pool of pools.values()) {
    pool.sort(compareArticles);
  }

  const order = POST_CHANNELS.map((meta) => meta.id);
  const cursors = new Map<PostChannel, number>(order.map((channel) => [channel, 0]));
  const picked: BriefingArticle[] = [];

  while (picked.length < limit) {
    let advanced = false;
    for (const channel of order) {
      if (picked.length < limit) {
        const pool = pools.get(channel) ?? [];
        const cursor = cursors.get(channel) ?? 0;
        const article = pool[cursor];
        if (!article) continue;
        cursors.set(channel, cursor + 1);
        picked.push(article);
        advanced = true;
      }
    }
    if (!advanced) break;
  }

  return picked;
}

/**
 * Live desk briefings across every channel, drawn round-robin for the landing.
 *
 * Prefers the prebuilt `featured-cards.json` index (slim card DTOs only) so the
 * landing never parses multi-MB `extra.json`. Falls back to the live store path
 * when the index is missing (local first run / tests).
 */
export async function loadFeaturedBriefings(limit: number): Promise<BriefingArticle[]> {
  const indexed = readFeaturedCardsIndex();
  if (indexed.length) return pickRoundRobin(indexed, limit);

  const articles = slimBriefingsForCards(filterLiveBriefings(await getTodaysBriefings()));
  return pickRoundRobin(articles, limit);
}
