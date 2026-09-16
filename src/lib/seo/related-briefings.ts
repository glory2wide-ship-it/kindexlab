/**
 * Related daily briefings for entity detail pages (ranking ↔ briefing graph).
 */

import { getChannelBriefingEdition } from "@/lib/briefing/store";
import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import {
  channelFromEntityType,
  channelSectionHref,
  getPostChannel,
} from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import type { BriefingArticle, RankingEntity } from "@/lib/types";

function entityChannel(entity: Pick<RankingEntity, "type" | "sourceChannel">): PostChannel {
  return entity.sourceChannel ?? channelFromEntityType(entity.type);
}

function scoreBriefing(article: BriefingArticle, entity: RankingEntity): number {
  let score = 0;
  const name = entity.name;
  const key = normalizeName(name);
  if (!key) return 0;

  if (article.relatedEntitySlugs?.some((slug) => slug === entity.slug || slug.endsWith(`--${key}`))) {
    score += 12;
  }
  if (article.relatedEntitySlugs?.some((slug) => namesOverlap(slug, name) || slug.includes(key))) {
    score += 6;
  }
  const blob = `${article.title} ${article.excerpt ?? ""}`;
  if (blob.includes(name) || namesOverlap(blob, name)) score += 8;
  if (article.channel === entityChannel(entity)) score += 2;
  if (article.kind === "deep-dive") score += 1;
  return score;
}

/** Same-channel briefings that mention or relate to this entity. */
export async function relatedBriefingsForEntity(
  entity: RankingEntity,
  limit = 4,
): Promise<BriefingArticle[]> {
  const channel = entityChannel(entity);
  const edition = await getChannelBriefingEdition(channel);
  const ranked = edition
    .map((article) => ({ article, score: scoreBriefing(article, entity) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || b.article.editionDate.localeCompare(a.article.editionDate));

  const picked: BriefingArticle[] = [];
  const seen = new Set<string>();
  for (const row of ranked) {
    if (seen.has(row.article.slug)) continue;
    seen.add(row.article.slug);
    picked.push(row.article);
    if (picked.length >= limit) break;
  }

  // Always keep at least the channel main briefing when nothing matched by name.
  if (!picked.length) {
    const main = edition.find((item) => item.kind === "main") ?? edition[0];
    if (main) picked.push(main);
  }
  return picked;
}

export function channelBriefingHubHref(entity: Pick<RankingEntity, "type" | "sourceChannel">): string {
  return channelSectionHref(entityChannel(entity), "briefing");
}

export function channelBriefingHubLabel(
  entity: Pick<RankingEntity, "type" | "sourceChannel">,
): string {
  const meta = getPostChannel(entityChannel(entity));
  return `${meta.label} 투데이 브리핑`;
}
