import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import { ChannelBriefingPage } from "@/components/briefing/ChannelBriefingPage";
import { getArchiveBriefings } from "@/lib/api";
import {
  briefingMatchesChannel,
  channelSectionHref,
  getPostChannel,
  isPostChannel,
} from "@/lib/posts/channels";

export const dynamic = "force-dynamic";

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

export default async function CategoryArchivePage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isPostChannel(category)) notFound();
  const meta = getPostChannel(category);
  const archive = await getArchiveBriefings();
  const past = archive.filter((article) => briefingMatchesChannel(article, category));

  return (
    <div className="space-y-12">
      <ChannelBriefingPage channel={category} heading={`${meta.label} 아카이브`} />
      {past.length ? (
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
      ) : (
        <p className="text-sm text-muted">아직 보관된 브리핑이 없습니다.</p>
      )}
    </div>
  );
}
