import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GeneratedPostArticle } from "@/components/posts/GeneratedPostArticle";
import { channelHref, inferPostChannel } from "@/lib/posts/channels";
import { getPostBySlug, listSeededSlugs } from "@/lib/posts/store";
import { SITE } from "@/lib/site";
import { decodeRouteSlug } from "@/lib/slugs";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateStaticParams() {
  return listSeededSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteSlug(rawSlug);
  const post = await getPostBySlug(slug);
  if (!post) return { title: "포스트를 찾을 수 없습니다" };
  const canonical = channelHref(inferPostChannel(post), post.slug);
  const keywords = [post.focusKeyword, post.supportKeyword].filter(Boolean);
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

export default async function GeneratedPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteSlug(rawSlug);
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  return <GeneratedPostArticle post={post} />;
}
