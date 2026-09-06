import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelHubPage, channelHubMetadata } from "@/components/posts/ChannelHubPage";
import { isPostChannel } from "@/lib/posts/channels";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isPostChannel(category)) return { title: "이슈 칼럼" };
  return channelHubMetadata(category);
}

export default async function CategoryPostsPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isPostChannel(category)) notFound();
  return <ChannelHubPage channel={category} />;
}
