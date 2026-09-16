import { listAnalysis } from "@/lib/analysis/store";
import { listAllBriefings } from "@/lib/briefing/store";
import { briefingPlainText, isPersistableBriefing } from "@/lib/briefing/quality";
import { entityNameLooksIndexable } from "@/lib/seo/indexable-entity";
import { SITE } from "@/lib/site";
import { decodeRouteSlug, rankingUrl } from "@/lib/slugs";
import type { BriefingArticle } from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 600;

/**
 * RSS 2.0 for Naver Search Advisor + aggregators.
 *
 * Naver treats submitted RSS as a “content feed” and re-visits it often.
 * Guide: put newest posts with as much body text as practical (not URL-only).
 * Briefings lead; chain-grounded ranking analyses follow (name-quality gated).
 */
const MAX_BRIEFINGS = 40;
const MAX_ANALYSES = 40;

interface FeedItem {
  url: string;
  title: string;
  excerpt: string;
  body: string;
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

function briefingBody(article: BriefingArticle): string {
  if (article.bodyHtml?.trim()) {
    return article.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 6000);
  }
  return briefingPlainText(article).slice(0, 6000);
}

function briefingToItem(article: BriefingArticle): FeedItem {
  return {
    url: `${SITE.url}/briefing/${article.slug}`,
    title: article.title,
    excerpt: article.excerpt,
    body: briefingBody(article),
    stamp: article.updatedAt || article.publishedAt,
    category: article.deskLabel || article.channel || article.category,
  };
}

export async function GET() {
  const [briefings, analyses] = await Promise.all([listAllBriefings(), listAnalysis()]);

  const byUrl = new Map<string, FeedItem>();

  for (const article of briefings.filter(isPersistableBriefing).slice(0, MAX_BRIEFINGS * 2)) {
    const item = briefingToItem(article);
    byUrl.set(item.url, item);
  }

  for (const entry of analyses) {
    if (entry.provenance?.kind !== "chain") continue;
    const keyword = (entry.keyword || "").trim();
    if (!entityNameLooksIndexable(keyword)) continue;
    const url = rankingUrl(SITE.url, decodeRouteSlug(entry.slug));
    if (byUrl.has(url)) continue;
    byUrl.set(url, {
      url,
      title: entry.article.title,
      excerpt: entry.article.excerpt ?? "",
      body: [entry.article.excerpt, ...entry.article.sections.flatMap((s) => s.paragraphs)]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 4000),
      stamp: entry.generatedAt ?? entry.article.publishedAt,
      category: keyword || undefined,
    });
  }

  const feed = [...byUrl.values()]
    .sort((a, b) => (b.stamp || "").localeCompare(a.stamp || ""))
    .slice(0, MAX_BRIEFINGS + MAX_ANALYSES);

  const items = feed
    .map((entry) => {
      const description = entry.body || entry.excerpt;
      return [
        "    <item>",
        `      <title>${escapeXml(entry.title)}</title>`,
        `      <link>${escapeXml(entry.url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(entry.url)}</guid>`,
        `      <pubDate>${rfc822(entry.stamp)}</pubDate>`,
        `      <description>${escapeXml(description)}</description>`,
        `      <content:encoded><![CDATA[${description}]]></content:encoded>`,
        entry.category ? `      <category>${escapeXml(entry.category)}</category>` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    "  <channel>",
    `    <title>${escapeXml(SITE.nameKo)} · ${escapeXml(SITE.name)} 투데이 브리핑</title>`,
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
