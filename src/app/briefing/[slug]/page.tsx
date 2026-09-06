import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DailyBriefing } from "@/components/briefing/DailyBriefing";
import { listSeeded } from "@/lib/briefing/catalog";
import { getBriefingBySlug, getEntitiesBySlugs } from "@/lib/api";
import { SITE } from "@/lib/site";

export const dynamicParams = true;

export async function generateStaticParams() {
  return listSeeded().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
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

export default async function BriefingArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const briefing = await getBriefingBySlug(slug);
  if (!briefing) notFound();
  const related = await getEntitiesBySlugs(briefing.relatedEntitySlugs);

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
        <Link href="/briefing" className="hover:text-ink">
          브리핑
        </Link>
        <span className="mx-2">/</span>
        <Link href="/briefing/archive" className="hover:text-ink">
          아카이브
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/briefing/archive/${briefing.editionDate}`} className="hover:text-ink">
          {briefing.editionDate}
        </Link>
      </p>
      <DailyBriefing briefing={briefing} related={related} />
    </div>
  );
}
