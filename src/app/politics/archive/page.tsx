import type { Metadata } from "next";
import { Suspense } from "react";
import { BriefingDateGroup } from "@/components/briefing/BriefingDateGroup";
import { getArchiveBriefings, groupBriefingsByDate } from "@/lib/api";
import { briefingMatchesChannel, channelSectionHref } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

export const revalidate = 180;

export const metadata: Metadata = {
  title: "정치 인사이트 매거진",
  description: "정치 종합 브리핑과 투데이 인사이트를 발행일 기준으로 보관합니다.",
  alternates: { canonical: channelSectionHref("politics", "archive") },
  openGraph: {
    title: `정치 인사이트 매거진 · ${SITE.name}`,
    url: `${SITE.url}${channelSectionHref("politics", "archive")}`,
  },
};

async function PastArchive() {
  const archive = await getArchiveBriefings();
  const past = archive.filter((article) => briefingMatchesChannel(article, "politics"));
  const grouped = groupBriefingsByDate(past);

  if (!grouped.length) {
    return <p className="text-sm text-muted">아직 보관된 브리핑이 없습니다.</p>;
  }

  return (
    <div className="space-y-10">
      <p className="font-mono text-[11px] text-muted">
        {past.length}건 · {grouped.length}일
      </p>
      {grouped.map((group) => (
        <BriefingDateGroup
          key={group.date}
          date={group.date}
          articles={group.articles}
          hrefFor={(article) => `${channelSectionHref("politics", "briefing")}/${article.slug}`}
          kicker="정치"
        />
      ))}
    </div>
  );
}

export default async function PoliticsArchivePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">정치 인사이트 매거진</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          정치 데스크에서 발행한 종합 브리핑과 투데이 인사이트를 날짜별로 모았습니다.
          최신 발행일이 위에 옵니다.
        </p>
      </header>
      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-2xl bg-line/40" aria-hidden />
        }
      >
        <PastArchive />
      </Suspense>
    </div>
  );
}
