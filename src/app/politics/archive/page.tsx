import type { Metadata } from "next";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import { ChannelBriefingPage } from "@/components/briefing/ChannelBriefingPage";
import { getArchiveBriefings } from "@/lib/api";
import { briefingMatchesChannel, channelSectionHref } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "정치 아카이브",
  description: "정치 종합 브리핑과 하부 메뉴 심층 분석 목록.",
  alternates: { canonical: channelSectionHref("politics", "archive") },
  openGraph: {
    title: `정치 아카이브 · ${SITE.name}`,
    url: `${SITE.url}${channelSectionHref("politics", "archive")}`,
  },
};

export default async function PoliticsArchivePage() {
  const archive = await getArchiveBriefings();
  const past = archive.filter((article) => briefingMatchesChannel(article, "politics"));

  return (
    <div className="space-y-12">
      <ChannelBriefingPage channel="politics" heading="정치 아카이브" />
      {past.length ? (
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
      ) : (
        <p className="text-sm text-muted">아직 보관된 브리핑이 없습니다.</p>
      )}
    </div>
  );
}
