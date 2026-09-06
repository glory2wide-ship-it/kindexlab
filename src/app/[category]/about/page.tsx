import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AboutArticle } from "@/components/about/AboutArticle";
import { channelSectionHref, getPostChannel, isPostChannel } from "@/lib/posts/channels";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isPostChannel(category)) return { title: "소개" };
  const meta = getPostChannel(category);
  return {
    title: `${meta.label} 소개`,
    description: meta.description,
    alternates: { canonical: channelSectionHref(category, "about") },
  };
}

export default async function CategoryAboutPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isPostChannel(category)) notFound();
  return <AboutArticle channel={category} />;
}
