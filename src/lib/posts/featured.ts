import { inferPostChannel, POST_CHANNELS } from "@/lib/posts/channels";
import { listPosts } from "@/lib/posts/store";
import type { GeneratedPost, PostChannel } from "@/lib/posts/types";

export interface FeaturedColumn {
  post: GeneratedPost;
  channel: PostChannel;
}

/**
 * Ranking within one desk.
 *
 * There is no view counter behind these columns, so "중요도" is stood up from
 * what the store does record: freshness first, then how much was actually
 * written. A longer column cleared more of the generation audit, which is the
 * closest proxy for depth available without analytics.
 */
function byImportance(a: GeneratedPost, b: GeneratedPost): number {
  const stamp = (b.publishedAt || "").localeCompare(a.publishedAt || "");
  if (stamp !== 0) return stamp;
  return (b.characterCount ?? 0) - (a.characterCount ?? 0);
}

/**
 * Latest premium columns across every desk, drawn round-robin.
 *
 * Generation runs channel by channel, so a straight recency sort hands the
 * whole rail to whichever desk was rebuilt last. Alternating desks keeps the
 * landing rail as cross-category as the board above it.
 */
export async function loadFeaturedColumns(limit: number): Promise<FeaturedColumn[]> {
  let posts: GeneratedPost[] = [];
  try {
    posts = await listPosts();
  } catch {
    return [];
  }

  const pools = new Map<PostChannel, GeneratedPost[]>();
  for (const post of posts) {
    const channel = inferPostChannel(post);
    const pool = pools.get(channel);
    if (pool) pool.push(post);
    else pools.set(channel, [post]);
  }
  for (const pool of pools.values()) pool.sort(byImportance);

  const order = POST_CHANNELS.map((meta) => meta.id);
  const cursors = new Map<PostChannel, number>(order.map((channel) => [channel, 0]));
  const picked: FeaturedColumn[] = [];

  while (picked.length < limit) {
    let advanced = false;
    for (const channel of order) {
      if (picked.length >= limit) break;
      const pool = pools.get(channel) ?? [];
      const cursor = cursors.get(channel) ?? 0;
      const post = pool[cursor];
      if (!post) continue;
      cursors.set(channel, cursor + 1);
      picked.push({ post, channel });
      advanced = true;
    }
    if (!advanced) break;
  }

  return picked;
}
