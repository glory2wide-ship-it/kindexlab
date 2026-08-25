import type { Metadata } from "next";
import Link from "next/link";
import { ArchiveSearchForm } from "@/components/briefing/ArchiveSearchForm";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import { BriefingDateGroup } from "@/components/briefing/BriefingDateGroup";
import { getArchiveBriefings, getTodaysBriefings, groupBriefingsByDate } from "@/lib/api";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "데일리 트렌드 브리핑",
  description:
    "매일 종합 1편과 히트맵 전 카테고리 심층(1,000단어 이상)을 자동 발행합니다. 어제 글은 매거진 아카이브로 쌓입니다.",
  alternates: { canonical: "/briefing" },
};

export const dynamic = "force-dynamic";

export default async function BriefingHubPage() {
  const [today, archive] = await Promise.all([getTodaysBriefings(), getArchiveBriefings()]);
  const recentGroups = groupBriefingsByDate(archive).slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${SITE.name} 데일리 브리핑`,
    url: `${SITE.url}/briefing`,
    hasPart: today.map((item) => ({
      "@type": "NewsArticle",
      headline: item.title,
      url: `${SITE.url}/briefing/${item.slug}`,
      datePublished: item.publishedAt,
      wordCount: item.wordCount,
      image: item.coverImage?.src,
    })),
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="space-y-3">
        <p className="font-mono text-xs text-accent">BRIEFING DESK</p>
        <h1 className="text-3xl font-semibold tracking-tight">데일리 트렌드 브리핑</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          최신 순위·등락 데이터를 바탕으로 매일 종합 브리핑 1편과 히트맵 전 카테고리 심층을
          발행합니다. 날짜가 바뀌면 전날 기사는 검색 가능한 아카이브로 넘어가 장기 SEO
          유입을 만듭니다.
        </p>
        <ArchiveSearchForm />
      </header>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">오늘의 에디션</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {today.map((article) => (
            <BriefingCard key={article.slug} article={article} />
          ))}
        </div>
      </section>
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">아카이브 최근호</h2>
          <Link href="/briefing/archive" className="text-sm text-accent hover:underline">
            전체 아카이브 →
          </Link>
        </div>
        {recentGroups.map((group) => (
          <BriefingDateGroup key={group.date} date={group.date} articles={group.articles} />
        ))}
      </section>
    </div>
  );
}
