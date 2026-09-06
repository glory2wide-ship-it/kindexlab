import type { Metadata } from "next";
import Link from "next/link";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import { DeskEyebrow } from "@/components/ui/DeskEyebrow";
import { getChannelBriefingEdition } from "@/lib/api";
import { UPDATE_KEYWORD_LABEL } from "@/lib/briefing/labels";
import {
  channelHref,
  channelSectionHref,
  getPostChannel,
  POST_CHANNELS,
} from "@/lib/posts/channels";
import { listPosts, listPostsByChannel } from "@/lib/posts/store";
import type { GeneratedPost, PostChannel } from "@/lib/posts/types";

function PostCard({ post, href }: { post: GeneratedPost; href: string }) {
  return (
    <Link href={href} className="block rounded-2xl border border-line bg-panel p-5 hover:border-accent">
      <p className="font-mono text-[11px] text-muted">{post.editionDate}</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight">{post.title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{post.excerpt}</p>
    </Link>
  );
}

export function channelHubMetadata(channel: PostChannel): Metadata {
  const meta = getPostChannel(channel);
  return {
    title: `${meta.label} 이슈 칼럼`,
    description: meta.description,
    alternates: { canonical: channelSectionHref(channel, "board") },
  };
}

/**
 * Issue-column hub: today's channel briefings (daily + deep-dives) plus any
 * magazine posts. Politics previously 404'd on /politics/posts because
 * politics/[id] reserved the segment without a dedicated posts page; travel had
 * no generated posts — briefings fill that gap.
 */
export async function ChannelHubPage({ channel }: { channel: PostChannel }) {
  const meta = getPostChannel(channel);
  const [posts, briefings] = await Promise.all([
    listPostsByChannel(channel),
    getChannelBriefingEdition(channel),
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{meta.label} 이슈 칼럼</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          오늘의 일일 브리핑·Update 키워드와 키워드 매거진 칼럼을 모았습니다. 지수(INDEX)는 키워드를 고르는
          트리거이고, 본문은 그 키워드만으로 쓴 독립 칼럼입니다.
        </p>
        <p className="text-sm text-muted">
          <Link href="/posts" className="underline hover:text-ink">
            전체 칼럼
          </Link>
          {POST_CHANNELS.filter((item) => item.id !== channel).map((item) => (
            <span key={item.id}>
              <span className="mx-2">·</span>
              <Link href={channelSectionHref(item.id, "board")} className="underline hover:text-ink">
                {item.label}
              </Link>
            </span>
          ))}
        </p>
      </header>

      {briefings.length ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">오늘의 이슈 브리핑</h2>
            <Link
              href={channelSectionHref(channel, "briefing")}
              className="text-sm font-medium text-accent hover:underline"
            >
              일일브리핑 전체 →
            </Link>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {briefings.map((article) => (
              <li key={article.slug}>
                <BriefingCard
                  article={article}
                  href={`${channelSectionHref(channel, "briefing")}/${article.slug}`}
                  kicker={
                    article.kind === "main"
                      ? `${meta.label} 종합`
                      : article.deskLabel || UPDATE_KEYWORD_LABEL
                  }
                  lead={article.kind === "main"}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {posts.length ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">매거진 칼럼</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {posts.map((post) => (
              <li key={post.slug}>
                <PostCard
                  post={post}
                  href={
                    channel === "politics" ? `/posts/${post.slug}` : channelHref(channel, post.slug)
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!briefings.length && !posts.length ? (
        <p className="rounded-2xl border border-dashed border-line bg-panel p-6 text-sm leading-6 text-muted">
          아직 이 카테고리의 이슈 글이 없습니다. 일일 브리핑이 발행되면 이 허브에 함께 노출됩니다.
        </p>
      ) : null}
    </div>
  );
}

export async function PostsIndexWithChannels() {
  const posts = await listPosts();
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">이슈 칼럼</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          지수(INDEX)는 오늘의 키워드를 고르는 트리거입니다. 본문은 그 키워드만으로 쓴 매거진 칼럼과
          일일 브리핑입니다. 투자 권유가 아닙니다.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {POST_CHANNELS.map((item) => (
          <li key={item.id}>
            <Link
              href={channelSectionHref(item.id, "board")}
              className="block rounded-2xl border border-line bg-panel p-4 hover:border-accent"
            >
              <DeskEyebrow variant="base">{item.eyebrow}</DeskEyebrow>
              <h2 className="mt-2 font-semibold tracking-tight">{item.label}</h2>
              <p className="mt-1 text-xs leading-5 text-muted">{item.description}</p>
            </Link>
          </li>
        ))}
      </ul>
      <ul className="grid gap-4 md:grid-cols-2">
        {posts.map((post) => (
          <li key={post.slug}>
            <PostCard
              post={post}
              href={
                post.channel === "politics" ? `/posts/${post.slug}` : channelHref(post.channel, post.slug)
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
