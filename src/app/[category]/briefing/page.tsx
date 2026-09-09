import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelBriefingPage } from "@/components/briefing/ChannelBriefingPage";
import { channelSectionHref, getPostChannel, isPostChannel } from "@/lib/posts/channels";

/** ISR — persisted edition; avoid force-dynamic so soft-nav can reuse the cache. */
export const revalidate = 180;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isPostChannel(category)) return { title: "투데이 브리핑" };
  const meta = getPostChannel(category);
  return {
    title: `${meta.label} 투데이 브리핑`,
    description: `${meta.label} 종합 브리핑과 투데이 인사이트. 표, FAQ, 1,500단어 이상 본문을 같은 규격으로 발행합니다.`,
    alternates: { canonical: channelSectionHref(category, "briefing") },
  };
}

export default async function CategoryBriefingPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isPostChannel(category)) notFound();
  return <ChannelBriefingPage channel={category} />;
}
