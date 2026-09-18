import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DailyBriefing } from "@/components/briefing/DailyBriefing";
import { getEntitiesBySlugs } from "@/lib/api";
import { loadBriefingBySlug } from "@/lib/briefing/store";
import { briefingMatchesChannel, channelSectionHref, getPostChannel } from "@/lib/posts/channels";
import { breadcrumbJsonLd } from "@/lib/seo/indexable-entity";
import { SITE } from "@/lib/site";

export const revalidate = 60;

const loadBriefingPage = cache(async (slug: string) => {
  const briefing = await loadBriefingBySlug(slug);
  if (!briefing) return null;
  const related = briefing.relatedEntitySlugs.length
    ? await getEntitiesBySlugs(briefing.relatedEntitySlugs)
    : [];
  return { briefing, related };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const detail = await loadBriefingPage(slug);
  if (!detail) return { title: "브리핑을 찾을 수 없습니다" };
  const { briefing } = detail;
  const canonical = `/briefing/${briefing.slug}`;
  return {
    title: briefing.title,
    description: briefing.excerpt,
    alternates: { canonical },
    openGraph: {
      title: briefing.title,
      description: briefing.excerpt,
      type: "article",
      publishedTime: briefing.publishedAt,
      modifiedTime: briefing.updatedAt,
      url: `${SITE.url}${canonical}`,
    },
  };
}

export default async function PoliticsBriefingArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await loadBriefingPage(slug);
  if (!detail) notFound();
  const { briefing, related } = detail;
  if (!briefingMatchesChannel(briefing, "politics")) notFound();
  const meta = getPostChannel("politics");
  const canonicalPath = `/briefing/${briefing.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: briefing.title,
    description: briefing.excerpt,
    datePublished: briefing.publishedAt,
    dateModified: briefing.updatedAt,
    inLanguage: "ko",
    author: { "@type": "Organization", name: SITE.name },
    publisher: { "@type": "Organization", name: SITE.name },
    wordCount: briefing.wordCount,
    mainEntityOfPage: `${SITE.url}${canonicalPath}`,
  };
  const crumbs = breadcrumbJsonLd([
    { name: "KinDex", url: SITE.url },
    { name: meta.label, url: `${SITE.url}/politics` },
    { name: "투데이 브리핑", url: `${SITE.url}${channelSectionHref("politics", "briefing")}` },
    { name: briefing.title, url: `${SITE.url}${canonicalPath}` },
  ]);

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <p className="text-sm text-muted">
        <Link href={channelSectionHref("politics", "briefing")} className="hover:text-ink">
          {meta.label} 투데이 브리핑
        </Link>
        <span className="mx-2">/</span>
        {briefing.editionDate}
      </p>
      <DailyBriefing briefing={briefing} related={related} />
    </div>
  );
}
