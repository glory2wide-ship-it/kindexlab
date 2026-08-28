import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DailyBriefing } from "@/components/briefing/DailyBriefing";
import { getBriefingBySlug, getEntitiesBySlugs } from "@/lib/api";
import {
  briefingMatchesChannel,
  channelSectionHref,
  getPostChannel,
  isPostChannel,
} from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const briefing = await getBriefingBySlug(slug);
  if (!briefing) return { title: "브리핑을 찾을 수 없습니다" };
  return {
    title: briefing.title,
    description: briefing.excerpt,
    alternates: { canonical: `/briefing/${briefing.slug}` },
    openGraph: {
      title: briefing.title,
      description: briefing.excerpt,
      type: "article",
      publishedTime: briefing.publishedAt,
      modifiedTime: briefing.updatedAt,
    },
  };
}

export default async function CategoryBriefingArticlePage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  if (!isPostChannel(category)) notFound();
  const briefing = await getBriefingBySlug(slug);
  if (!briefing || !briefingMatchesChannel(briefing, category)) notFound();
  const related = await getEntitiesBySlugs(briefing.relatedEntitySlugs);
  const meta = getPostChannel(category);

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
    mainEntityOfPage: `${SITE.url}/briefing/${briefing.slug}`,
  };

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="text-sm text-muted">
        <Link href={channelSectionHref(category, "briefing")} className="hover:text-ink">
          {meta.label} 일일브리핑
        </Link>
        <span className="mx-2">/</span>
        {briefing.editionDate}
      </p>
      <DailyBriefing briefing={briefing} related={related} />
    </div>
  );
}
