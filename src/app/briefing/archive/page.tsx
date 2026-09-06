import type { Metadata } from "next";
import { ArchiveSearchForm } from "@/components/briefing/ArchiveSearchForm";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import { BriefingDateGroup } from "@/components/briefing/BriefingDateGroup";
import {
  getArchiveBriefings,
  groupBriefingsByDate,
  parseCategoryParam,
  searchBriefings,
} from "@/lib/api";
import { categoryLabel } from "@/lib/briefing/metrics";
import { SITE } from "@/lib/site";
import { DeskEyebrow } from "@/components/ui/DeskEyebrow";

export const metadata: Metadata = {
  title: "브리핑 아카이브",
  description:
    "날짜가 지난 KinDex 일일 브리핑과 카테고리 심층을 검색합니다. 히트맵과 종목 시세로 다시 연결되는 장기 SEO 아카이브입니다.",
  alternates: { canonical: "/briefing/archive" },
};

export default async function BriefingArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const category = parseCategoryParam(params.category);
  const archive = await getArchiveBriefings();
  const results = searchBriefings(archive, query, category && category !== "all" ? category : undefined);
  const grouped = groupBriefingsByDate(results);
  const filtered = Boolean(query || (category && category !== "all"));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${SITE.name} 브리핑 아카이브`,
    url: `${SITE.url}/briefing/archive`,
    numberOfItems: results.length,
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="space-y-3">
        <DeskEyebrow variant="xs">MAGAZINE ARCHIVE</DeskEyebrow>
        <h1 className="text-3xl font-semibold tracking-tight">브리핑 아카이브</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          어제 이전 에디션이 날짜별로 자동 분류됩니다. 카테고리와 키워드로 과거 수급 해설을
          찾고, 각 기사에서 지수(INDEX) 히트맵으로 돌아갈 수 있습니다.
        </p>
        <ArchiveSearchForm query={query} category={category} />
        <p className="font-mono text-[11px] text-muted">
          {results.length}건 · {grouped.length}일
          {query ? ` · “${query}”` : ""}
          {category && category !== "all" ? ` · ${categoryLabel(category)}` : ""}
        </p>
      </header>
      {results.length === 0 ? (
        <p className="rounded-2xl border border-line bg-panel px-5 py-10 text-sm text-muted">
          조건에 맞는 아카이브 기사가 없습니다. 검색어를 줄이거나 카테고리를 종합으로 바꿔
          보세요.
        </p>
      ) : filtered ? (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((article) => (
            <BriefingCard key={article.slug} article={article} />
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map((group) => (
            <BriefingDateGroup key={group.date} date={group.date} articles={group.articles} />
          ))}
        </div>
      )}
    </div>
  );
}
