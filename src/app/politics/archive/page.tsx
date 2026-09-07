import type { Metadata } from "next";
import { Suspense } from "react";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import { ChannelBriefingPage } from "@/components/briefing/ChannelBriefingPage";
import { getArchiveBriefings } from "@/lib/api";
import { briefingMatchesChannel, channelSectionHref } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

export const revalidate = 180;

export const metadata: Metadata = {
  title: "정치 아카이브",
  description: "정치 종합 브리핑과 Update 키워드 목록.",
  alternates: { canonical: channelSectionHref("politics", "archive") },
  openGraph: {
    title: `정치 아카이브 · ${SITE.name}`,
    url: `${SITE.url}${channelSectionHref("politics", "archive")}`,
  },
};

async function PastArchive() {
  const archive = await getArchiveBriefings();
  const past = archive.filter((article) => briefingMatchesChannel(article, "politics"));

  if (!past.length) {
    return <p className="text-sm text-muted">아직 보관된 브리핑이 없습니다.</p>;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">지난 브리핑</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {past.map((article) => (
          <BriefingCard
            key={article.slug}
            article={article}
            href={`${channelSectionHref("politics", "briefing")}/${article.slug}`}
            kicker={article.deskLabel || "정치"}
          />
        ))}
      </div>
    </section>
  );
}

export default async function PoliticsArchivePage() {
  return (
    <div className="space-y-12">
      <ChannelBriefingPage channel="politics" heading="정치 아카이브" />
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
