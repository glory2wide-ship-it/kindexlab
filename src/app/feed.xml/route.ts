import { listAnalysis } from "@/lib/analysis/store";
import { SITE } from "@/lib/site";
import { decodeRouteSlug, rankingUrl } from "@/lib/slugs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RSS 2.0 feed of the generated columns.
 *
 * A sitemap tells a crawler which URLs exist; a feed tells it which ones are
 * new. Publishing both means a column written minutes ago can be picked up on
 * the feed poll rather than waiting for the next full sitemap crawl.
 *
 * Both stores are read because they are populated on different deployments.
 * `listAnalysis` is backed by `src/data/analysis/`, which is git-ignored TTL
 * data and therefore never ships to Vercel — on production it answers empty
 * unless Supabase is configured, which is how this feed went out with zero
 * items. The column store is committed and bundled at build time, so it is
 * what actually carries published work into a deploy.
 */
const MAX_ITEMS = 100;

interface FeedItem {
  url: string;
  title: string;
  excerpt: string;
  stamp: string;
  category?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822(raw: string | undefined): string {
  const parsed = raw ? new Date(raw) : new Date();
  return (Number.isNaN(parsed.getTime()) ? new Date() : parsed).toUTCString();
}

export async function GET() {
  // 이슈칼럼 store retired — feed carries grounded analysis only.
  const analyses = await listAnalysis();

  const bySlug = new Map<string, FeedItem>();
  for (const entry of analyses) {
    // Matches the sitemap and the detail page's robots tag: a template column is
    // not something to push at an aggregator.
    if (entry.provenance?.kind !== "chain") continue;
    const url = rankingUrl(SITE.url, entry.slug);
    bySlug.set(url, {
      url,
      title: entry.article.title,
      excerpt: entry.article.excerpt ?? "",
      stamp: entry.generatedAt ?? entry.article.publishedAt,
      category: entry.keyword || undefined,
    });
  }

  const feed = [...bySlug.values()]
    .sort((a, b) => (b.stamp || "").localeCompare(a.stamp || ""))
    .slice(0, MAX_ITEMS);

  const items = feed
    .map((entry) =>
      [
        "    <item>",
        `      <title>${escapeXml(entry.title)}</title>`,
        `      <link>${escapeXml(entry.url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(entry.url)}</guid>`,
        `      <pubDate>${rfc822(entry.stamp)}</pubDate>`,
        `      <description>${escapeXml(entry.excerpt)}</description>`,
        entry.category ? `      <category>${escapeXml(entry.category)}</category>` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(SITE.name)} · ${escapeXml(SITE.tagline)}</title>`,
    `    <link>${escapeXml(SITE.url)}</link>`,
    `    <description>${escapeXml(SITE.description)}</description>`,
    "    <language>ko</language>",
    `    <lastBuildDate>${rfc822(feed[0]?.stamp)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(`${SITE.url}/feed.xml`)}" rel="self" type="application/rss+xml" />`,
    items,
    "  </channel>",
    "</rss>",
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=600",
    },
  });
}
