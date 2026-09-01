import type { Metadata } from "next";
import Link from "next/link";
import { ArchiveSearchForm } from "@/components/briefing/ArchiveSearchForm";
import { FeaturedBriefingCard } from "@/components/briefing/FeaturedBriefingCard";
import { getChannelBriefingEdition, splitChannelEdition } from "@/lib/api";
import { channelMainLabel } from "@/lib/briefing/desks";
import { channelSectionHref, POST_CHANNELS } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";
import { DeskEyebrow } from "@/components/ui/DeskEyebrow";

export const metadata: Metadata = {
  title: "데일리 트렌드 브리핑",
  description:
    "엔터테인먼트·정치·경제·문화/생활·여행/맛집 각 채널의 종합 브리핑과 하부 메뉴 심층 분석을 매일 발행합니다. 어제 글은 매거진 아카이브로 쌓입니다.",
  alternates: { canonical: "/briefing" },
};

export const dynamic = "force-dynamic";

export default async function BriefingHubPage() {
  const featuredChannels = POST_CHANNELS.filter(
    (channel) => channel.id === "entertainment" || channel.id === "politics",
  );
  const editions = await Promise.all(
    featuredChannels.map(async (channel) => {
      const articles = await getChannelBriefingEdition(channel.id);
      return { channel, ...splitChannelEdition(articles) };
    }),
  );
  const mains = editions.flatMap((item) => (item.main ? [item.main] : []));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${SITE.name} 데일리 브리핑`,
    url: `${SITE.url}/briefing`,
    hasPart: mains.map((item) => ({
      "@type": "NewsArticle",
      headline: item.title,
      url: `${SITE.url}${channelSectionHref(item.channel ?? "entertainment", "briefing")}/${item.slug}`,
      datePublished: item.publishedAt,
      wordCount: item.wordCount,
      image: item.coverImage?.src,
    })),
  };

  return (
    <div className="space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="space-y-3">
        <DeskEyebrow variant="xs">BRIEFING DESK</DeskEyebrow>
        <h1 className="text-3xl font-semibold tracking-tight">오늘의 트렌드 브리핑</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          카테고리마다 상단은 종합 브리핑, 아래는 하부 메뉴별 심층 분석입니다. 날짜가 바뀌면 전날
          기사는 검색 가능한 아카이브로 넘어갑니다.
        </p>
        <ArchiveSearchForm />
      </header>

      <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {POST_CHANNELS.map((channel) => (
          <Link
            key={channel.id}
            href={channelSectionHref(channel.id, "briefing")}
            className="rounded-2xl border border-line bg-panel p-4 hover:border-accent"
          >
            <DeskEyebrow variant="base">{channel.eyebrow}</DeskEyebrow>
            <h2 className="mt-2 font-semibold tracking-tight">{channel.label} 일일브리핑</h2>
            <p className="mt-1 text-xs leading-5 text-muted">종합 브리핑 + 하부 메뉴 심층 분석</p>
          </Link>
        ))}
      </nav>

      <section className="space-y-8">
        {editions.map(({ channel, main, dives }) => (
          <div key={channel.id} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{channel.label}</h2>
              <Link
                href={channelSectionHref(channel.id, "briefing")}
                className="text-sm text-accent hover:underline"
              >
                {channel.label} 일일브리핑 · 심층 {dives.length}편 →
              </Link>
            </div>
            {main ? (
              <FeaturedBriefingCard
                article={main}
                href={`${channelSectionHref(channel.id, "briefing")}/${main.slug}`}
                kicker={channelMainLabel(channel.id)}
              />
            ) : (
              <p className="rounded-2xl border border-dashed border-line bg-panel p-6 text-sm leading-6 text-muted">
                {channel.label} 종합 브리핑은 하부 메뉴가 열리면 같은 규격으로 붙습니다.
              </p>
            )}
          </div>
        ))}
      </section>

      <p className="text-sm text-muted">
        <Link href="/briefing/archive" className="text-accent hover:underline">
          전체 아카이브 →
        </Link>
      </p>
    </div>
  );
}
