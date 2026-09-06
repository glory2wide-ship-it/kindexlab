import { listAnalysis } from "@/lib/analysis/store";
import { getAllBriefingSlugs, listEditionDates } from "@/lib/api";
import { CHANNEL_SECTIONS, channelHref, channelSectionHref, inferPostChannel, POST_CHANNELS } from "@/lib/posts/channels";
import { listPosts } from "@/lib/posts/store";
import { SITE } from "@/lib/site";
import { decodeRouteSlug, rankingUrl } from "@/lib/slugs";
import type { MetadataRoute } from "next";

/**
 * Rebuilt on a timer rather than per request.
 *
 * Assembling this list means a live rankings fetch plus a full read of the
 * column store, which measured around 24s under load — long enough that a
 * crawler is liable to give up on it. The underlying data turns over on the
 * order of hours, so serving a ten-minute-old list costs nothing in freshness
 * and hands Googlebot an immediate response.
 */
export const revalidate = 600;

/** Falls back to the crawl time only when an entry carries no usable date. */
function toDate(raw: string | undefined, fallback: Date): Date {
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [briefingSlugs, editionDates, posts, analyses] = await Promise.all([
    getAllBriefingSlugs(),
    listEditionDates(),
    listPosts(),
    listAnalysis(),
  ]);
  const now = new Date();

  /**
   * Ranking detail URLs, restricted to columns the chain grounded in reporting.
   *
   * Every live heatmap entity used to be listed here, which advertised a few
   * hundred URLs whose 오늘의 분석 block is the deterministic template — one
   * skeleton with the keyword swapped in. Submitting those in bulk is what a
   * crawler reads as scaled low-value content, so the sitemap now carries only
   * what `robots` on the detail page is willing to let be indexed. The set
   * refills on its own as the pipeline grounds more keywords.
   */
  const rankingEntries = new Map<string, { lastModified: Date; priority: number }>();
  for (const entry of analyses) {
    if (entry.provenance?.kind !== "chain") continue;
    rankingEntries.set(decodeRouteSlug(entry.slug), {
      lastModified: toDate(entry.generatedAt ?? entry.article?.publishedAt, now),
      priority: 0.9,
    });
  }
  return [
    { url: SITE.url, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE.url}/briefing`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/posts`, lastModified: now, changeFrequency: "hourly", priority: 0.85 },
    ...POST_CHANNELS.flatMap((channel) =>
      CHANNEL_SECTIONS.map((section) => ({
        url: `${SITE.url}${channelSectionHref(channel.id, section.id)}`,
        lastModified: now,
        changeFrequency: "hourly" as const,
        priority: section.id === "board" ? 0.9 : 0.8,
      })),
    ),
    {
      url: `${SITE.url}/briefing/archive`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    { url: `${SITE.url}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/disclaimer`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    ...editionDates.map((date) => ({
      url: `${SITE.url}/briefing/archive/${date}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })),
    ...briefingSlugs.map((slug) => ({
      url: `${SITE.url}/briefing/${slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...posts.map((post) => ({
      url: `${SITE.url}${channelHref(inferPostChannel(post), post.slug)}`,
      lastModified: toDate(post.updatedAt ?? post.publishedAt, now),
      changeFrequency: "daily" as const,
      priority: 0.72,
    })),
    ...[...rankingEntries].map(([slug, meta]) => ({
      url: rankingUrl(SITE.url, slug),
      lastModified: meta.lastModified,
      changeFrequency: "hourly" as const,
      priority: meta.priority,
    })),
  ];
}
