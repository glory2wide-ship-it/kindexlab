import { getAllBriefingSlugs, getAllSlugs, listEditionDates } from "@/lib/api";
import { listPosts } from "@/lib/posts/store";
import { SITE } from "@/lib/site";
import { rankingUrl } from "@/lib/slugs";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, briefingSlugs, editionDates, posts] = await Promise.all([
    getAllSlugs(),
    getAllBriefingSlugs(),
    listEditionDates(),
    listPosts(),
  ]);
  const now = new Date();
  return [
    { url: SITE.url, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE.url}/briefing`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/posts`, lastModified: now, changeFrequency: "hourly", priority: 0.85 },
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
      url: `${SITE.url}/posts/${post.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.72,
    })),
    ...slugs.map((slug) => ({
      url: rankingUrl(SITE.url, slug),
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
  ];
}
