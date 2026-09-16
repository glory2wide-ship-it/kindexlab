import { listAnalysis } from "@/lib/analysis/store";
import { getAllBriefingSlugs, listEditionDates } from "@/lib/api";
import { BOARDS, boardPath, menuBoardsForChannel } from "@/lib/boards/registry";
import { CHANNEL_SECTIONS, channelSectionHref, POST_CHANNELS } from "@/lib/posts/channels";
import { entityNameLooksIndexable } from "@/lib/seo/indexable-entity";
import { SITE } from "@/lib/site";
import { decodeRouteSlug, rankingUrl } from "@/lib/slugs";
import type { MetadataRoute } from "next";

/**
 * Rebuilt on a timer rather than per request.
 *
 * Assembling this list means a live rankings fetch plus analysis reads, which
 * measured around 24s under load — long enough that a crawler is liable to give
 * up on it. The underlying data turns over on the order of hours, so serving a
 * ten-minute-old list costs nothing in freshness and hands Googlebot an
 * immediate response.
 */
export const revalidate = 600;

/** Falls back to the crawl time only when an entry carries no usable date. */
function toDate(raw: string | undefined, fallback: Date): Date {
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [briefingSlugs, editionDates, analyses] = await Promise.all([
    getAllBriefingSlugs(),
    listEditionDates(),
    listAnalysis(),
  ]);
  const now = new Date();

  /**
   * Ranking detail URLs — only chain-grounded analyses whose keyword passes the
   * indexability name gate. Sitemap comments historically claimed robots would
   * allow these; meta robots now matches that policy (see isIndexableEntityPage).
   */
  const rankingEntries = new Map<string, { lastModified: Date; priority: number }>();
  for (const entry of analyses) {
    if (entry.provenance?.kind !== "chain") continue;
    const keyword = (entry.keyword || "").trim();
    if (!entityNameLooksIndexable(keyword)) continue;
    rankingEntries.set(decodeRouteSlug(entry.slug), {
      lastModified: toDate(entry.generatedAt ?? entry.article?.publishedAt, now),
      priority: 0.85,
    });
  }

  /** Stable board hubs — clearer intent than thin entity scraps. */
  const boardEntries = BOARDS.filter((board) =>
    menuBoardsForChannel(board.channel).some((item) => item.slug === board.slug),
  ).map((board) => ({
    url: `${SITE.url}${boardPath(board.slug)}`,
    lastModified: now,
    changeFrequency: "hourly" as const,
    priority: 0.88,
  }));

  return [
    { url: SITE.url, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE.url}/briefing`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...POST_CHANNELS.flatMap((channel) =>
      CHANNEL_SECTIONS.map((section) => ({
        url: `${SITE.url}${channelSectionHref(channel.id, section.id)}`,
        lastModified: now,
        changeFrequency: "hourly" as const,
        priority: section.id === "board" ? 0.95 : 0.8,
      })),
    ),
    ...boardEntries,
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
    ...[...rankingEntries].map(([slug, meta]) => ({
      url: rankingUrl(SITE.url, slug),
      lastModified: meta.lastModified,
      changeFrequency: "hourly" as const,
      priority: meta.priority,
    })),
  ];
}
