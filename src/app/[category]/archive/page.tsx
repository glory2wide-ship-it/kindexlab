import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BriefingDateGroup } from "@/components/briefing/BriefingDateGroup";
import { getArchiveBriefings, groupBriefingsByDate } from "@/lib/api";
import {
  briefingMatchesChannel,
  channelSectionHref,
  getPostChannel,
  isPostChannel,
} from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import { DeskEyebrow } from "@/components/ui/DeskEyebrow";

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
    description: `${meta.label} 종합 브리핑과 Update 키워드를 발행일 기준으로 보관합니다.`,
    alternates: { canonical: channelSectionHref(category, "archive") },
  };
}

async function PastArchive({ category }: { category: PostChannel }) {
  const meta = getPostChannel(category);
  const archive = await getArchiveBriefings();
  const past = archive.filter((article) => briefingMatchesChannel(article, category));
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
          hrefFor={(article) => `${channelSectionHref(category, "briefing")}/${article.slug}`}
          kicker={meta.label}
        />
      ))}
    </div>
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
    <div className="space-y-8">
      <header className="space-y-3">
        <DeskEyebrow variant="xs">MAGAZINE ARCHIVE</DeskEyebrow>
        <h1 className="text-3xl font-semibold tracking-tight">{meta.label} 아카이브</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          {meta.label} 데스크에서 발행한 종합 브리핑과 Update 키워드를 날짜별로 모았습니다.
          최신 발행일이 위에 옵니다.
        </p>
      </header>
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
