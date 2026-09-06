import { getTodaysBriefings } from "@/lib/briefing/store";
import { compareArticles } from "@/lib/briefing/catalog";
import { kstDateString } from "@/lib/briefing/dates";
import { POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import type { BriefingArticle } from "@/lib/types";

/** Drop anything that is not the current KST edition before rendering. */
export function filterLiveBriefings(
  articles: BriefingArticle[],
  editionDate = kstDateString(),
): BriefingArticle[] {
  return articles.filter((item) => item.editionDate === editionDate);
}

function assertTodaysEditions(articles: BriefingArticle[], today: string): void {
  const stale = articles.filter((item) => item.editionDate !== today);
  if (!stale.length) return;
  const slugs = stale.map((item) => `${item.slug} (${item.editionDate})`).join(", ");
  throw new Error(`Featured briefings must be today's edition (${today}); stale: ${slugs}`);
}

/**
 * Today's live briefings across every desk, drawn round-robin.
 *
 * The landing rail is titled "오늘의 트렌드 브리핑", so it must reflect the
 * current KST edition — not archived premium columns from generated.json.
 */
export async function loadFeaturedBriefings(limit: number): Promise<BriefingArticle[]> {
  const today = kstDateString();
  const articles = filterLiveBriefings(await getTodaysBriefings(), today);
  if (!articles.length) return [];

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
      if (picked.length >= limit) break;
      const pool = pools.get(channel) ?? [];
      const cursor = cursors.get(channel) ?? 0;
      const article = pool[cursor];
      if (!article) continue;
      cursors.set(channel, cursor + 1);
      picked.push(article);
      advanced = true;
    }
    if (!advanced) break;
  }

  assertTodaysEditions(picked, today);
  return picked;
}
