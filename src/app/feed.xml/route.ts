import { listAnalysis } from "@/lib/analysis/store";
import { SITE } from "@/lib/site";
import { rankingUrl } from "@/lib/slugs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RSS 2.0 feed of the generated columns.
 *
 * A sitemap tells a crawler which URLs exist; a feed tells it which ones are
 * new. Publishing both means a column written minutes ago can be picked up on
 * the feed poll rather than waiting for the next full sitemap crawl.
 */
const MAX_ITEMS = 100;

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
  const analyses = (await listAnalysis()).slice(0, MAX_ITEMS);

  const items = analyses
    .map((entry) => {
      const article = entry.article;
      const url = rankingUrl(SITE.url, entry.slug);
      return [
        "    <item>",
        `      <title>${escapeXml(article.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <pubDate>${rfc822(entry.generatedAt ?? article.publishedAt)}</pubDate>`,
        `      <description>${escapeXml(article.excerpt ?? "")}</description>`,
        entry.keyword ? `      <category>${escapeXml(entry.keyword)}</category>` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(SITE.name)} · ${escapeXml(SITE.tagline)}</title>`,
    `    <link>${escapeXml(SITE.url)}</link>`,
    `    <description>${escapeXml(SITE.description)}</description>`,
    "    <language>ko</language>",
    `    <lastBuildDate>${rfc822(analyses[0]?.generatedAt)}</lastBuildDate>`,
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
