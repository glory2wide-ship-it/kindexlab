import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import { ChannelBriefingPage } from "@/components/briefing/ChannelBriefingPage";
import { getArchiveBriefings } from "@/lib/api";
import {
  briefingMatchesChannel,
  channelHref,
  channelSectionHref,
  getPostChannel,
  isPostChannel,
} from "@/lib/posts/channels";
import { listPostsByChannel } from "@/lib/posts/store";
import Link from "next/link";

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
    description: `${meta.label} 종합 브리핑과 하부 메뉴 심층 분석, 지난 이슈 칼럼 목록.`,
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
  const [posts, archive] = await Promise.all([
    listPostsByChannel(category),
    getArchiveBriefings(),
  ]);
  const past = archive.filter((article) => briefingMatchesChannel(article, category));

  return (
    <div className="space-y-12">
      <ChannelBriefingPage channel={category} heading={`${meta.label} 아카이브`} />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">이슈 칼럼 아카이브</h2>
        {posts.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={channelHref(category, post.slug)}
                  className="block rounded-2xl border border-line bg-panel p-5 hover:border-accent"
                >
                  <p className="font-mono text-[11px] text-muted">{post.editionDate}</p>
                  <h3 className="mt-2 font-semibold tracking-tight">{post.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{post.excerpt}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">아직 보관된 칼럼이 없습니다.</p>
        )}
      </section>
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
      ) : null}
    </div>
  );
}
