import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GeneratedPostArticle } from "@/components/posts/GeneratedPostArticle";
import { channelHref, getPostChannel, inferPostChannel, isPostChannel } from "@/lib/posts/channels";
import { getPostBySlug, listPosts } from "@/lib/posts/store";
import { SITE } from "@/lib/site";
import { decodeRouteSlug } from "@/lib/slugs";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateStaticParams() {
  const posts = await listPosts();
  return posts.map((post) => ({
    category: inferPostChannel(post),
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug: rawSlug } = await params;
  const slug = decodeRouteSlug(rawSlug);
  const post = await getPostBySlug(slug);
  if (!isPostChannel(category) || !post || inferPostChannel(post) !== category) {
    return { title: "칼럼을 찾을 수 없습니다" };
  }
  const meta = getPostChannel(category);
  const canonical = channelHref(category, post.slug);
  return {
    title: post.title,
    description: post.excerpt,
    keywords: [post.focusKeyword, post.supportKeyword, meta.label].filter(Boolean),
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

export default async function CategoryPostPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug: rawSlug } = await params;
  const slug = decodeRouteSlug(rawSlug);
  const post = await getPostBySlug(slug);
  if (!isPostChannel(category) || !post || inferPostChannel(post) !== category) notFound();
  return <GeneratedPostArticle post={post} />;
}
