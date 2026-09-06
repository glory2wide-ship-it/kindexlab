import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveSearchForm } from "@/components/briefing/ArchiveSearchForm";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import { getBriefingsByDate, listEditionDates } from "@/lib/api";
import { listSeeded } from "@/lib/briefing/catalog";
import { formatKoreanDate, isEditionDate } from "@/lib/briefing/dates";
import { SITE } from "@/lib/site";
import { DeskEyebrow } from "@/components/ui/DeskEyebrow";

export const dynamicParams = true;

export async function generateStaticParams() {
  const dates = [...new Set(listSeeded().map((item) => item.editionDate))];
  return dates.map((date) => ({ date }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  if (!isEditionDate(date)) return { title: "브리핑 아카이브" };
  return {
    title: `${formatKoreanDate(date)} 브리핑`,
    description: `${date} KindexLab 일일 트렌드 브리핑 아카이브. 종합 해설과 카테고리 심층을 날짜별로 보관합니다.`,
    alternates: { canonical: `/briefing/archive/${date}` },
  };
}

export default async function BriefingArchiveDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isEditionDate(date)) notFound();

  const articles = await getBriefingsByDate(date);
  if (articles.length === 0) notFound();

  const dates = await listEditionDates();
  const index = dates.indexOf(date);
  const newer = index > 0 ? dates[index - 1] : undefined;
  const older = index >= 0 ? dates[index + 1] : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${SITE.name} ${date} 브리핑`,
    url: `${SITE.url}/briefing/archive/${date}`,
    numberOfItems: articles.length,
    hasPart: articles.map((item) => ({
      "@type": "NewsArticle",
      headline: item.title,
      url: `${SITE.url}/briefing/${item.slug}`,
      datePublished: item.publishedAt,
      wordCount: item.wordCount,
    })),
  };

  return (
    <div className="space-y-8">
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
        {date}
      </p>
      <header className="space-y-3">
        <DeskEyebrow variant="xs">DAILY EDITION</DeskEyebrow>
        <h1 className="text-3xl font-semibold tracking-tight">{formatKoreanDate(date)} 브리핑</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          이 날짜에 발행된 종합 브리핑과 카테고리 심층입니다. 하루 종합 1편과 히트맵 전 카테고리
          심층이 자동으로 묶여 장기 검색 유입용 아카이브가 됩니다.
        </p>
        <ArchiveSearchForm />
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {articles.map((article) => (
          <BriefingCard key={article.slug} article={article} />
        ))}
      </div>
      <nav className="flex items-center justify-between text-sm text-muted">
        {older ? (
          <Link href={`/briefing/archive/${older}`} className="hover:text-ink">
            ← {older}
          </Link>
        ) : (
          <span />
        )}
        {newer ? (
          <Link href={`/briefing/archive/${newer}`} className="hover:text-ink">
            {newer} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
