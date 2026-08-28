import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GeneratedPostArticle } from "@/components/posts/GeneratedPostArticle";
import { channelHref, getPostChannel, inferPostChannel } from "@/lib/posts/channels";
import { getPostBySlug, listPostsByChannel } from "@/lib/posts/store";
import { SITE } from "@/lib/site";
import { decodeRouteSlug } from "@/lib/slugs";
import type { PostChannel } from "@/lib/posts/types";

export function createChannelSlugPage(channel: PostChannel) {
  const meta = getPostChannel(channel);

  async function generateStaticParams() {
    const posts = await listPostsByChannel(channel);
    return posts.map((post) => ({ slug: post.slug }));
  }

  async function generateMetadata({
    params,
  }: {
    params: Promise<{ slug: string }>;
  }): Promise<Metadata> {
    const { slug: rawSlug } = await params;
    const slug = decodeRouteSlug(rawSlug);
    const post = await getPostBySlug(slug);
    if (!post || inferPostChannel(post) !== channel) {
      return { title: `${meta.label} 칼럼을 찾을 수 없습니다` };
    }
    const keywords = [post.focusKeyword, post.supportKeyword, meta.label].filter(Boolean);
    const canonical = channelHref(channel, post.slug);
    return {
      title: post.title,
      description: post.excerpt,
      keywords,
      alternates: { canonical },
      openGraph: {
        title: post.title,
        description: post.excerpt,
        type: "article",
        publishedTime: post.publishedAt,
        modifiedTime: post.updatedAt,
        url: `${SITE.url}${canonical}`,
      },
    };
  }

  async function Page({ params }: { params: Promise<{ slug: string }> }) {
    const { slug: rawSlug } = await params;
    const slug = decodeRouteSlug(rawSlug);
    const post = await getPostBySlug(slug);
    if (!post || inferPostChannel(post) !== channel) notFound();
    return <GeneratedPostArticle post={post} />;
  }

  return {
    dynamic: "force-dynamic" as const,
    dynamicParams: true as const,
    generateStaticParams,
    generateMetadata,
    Page,
  };
}
