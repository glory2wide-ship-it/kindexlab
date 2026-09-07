import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import { ChannelBriefingPage } from "@/components/briefing/ChannelBriefingPage";
import { getArchiveBriefings } from "@/lib/api";
import {
  briefingMatchesChannel,
  channelSectionHref,
  getPostChannel,
  isPostChannel,
} from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

/** ISR — archive is persisted data; soft-nav should not wait on a dynamic render. */
export const revalidate = 180;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isPostChannel(category)) return { title: "아카이브" };
  const meta = getPostChannel(category);
  return {
    title: `${meta.label} 아카이브`,
    description: `${meta.label} 종합 브리핑과 Update 키워드 목록.`,
    alternates: { canonical: channelSectionHref(category, "archive") },
  };
}

async function PastArchive({ category }: { category: PostChannel }) {
  const meta = getPostChannel(category);
  const archive = await getArchiveBriefings();
  const past = archive.filter((article) => briefingMatchesChannel(article, category));

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
            href={`${channelSectionHref(category, "briefing")}/${article.slug}`}
            kicker={article.deskLabel || meta.label}
          />
        ))}
      </div>
    </section>
  );
}

export default async function CategoryArchivePage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isPostChannel(category)) notFound();
  const meta = getPostChannel(category);

  return (
    <div className="space-y-12">
      <ChannelBriefingPage channel={category} heading={`${meta.label} 아카이브`} />
      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-2xl bg-line/40" aria-hidden />
        }
      >
        <PastArchive category={category} />
      </Suspense>
    </div>
  );
}
