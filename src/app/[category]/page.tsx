import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelBoardPageBody } from "@/components/dashboard/ChannelBoardPageBody";
import { getPostChannel, isPostChannel, LIVE_INDEX_LABEL } from "@/lib/posts/channels";

/** ISR: matches the 3-minute live board refresh cadence. */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isPostChannel(category)) return { title: LIVE_INDEX_LABEL };
  const meta = getPostChannel(category);
  return {
    title: `${meta.label} ${LIVE_INDEX_LABEL}`,
    description: `${meta.indexTitle}와 종합 브리핑, 투데이 인사이트를 한 페이지에서 봅니다. ${meta.description}`,
    alternates: { canonical: meta.href },
  };
}

export default async function CategoryBoardPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isPostChannel(category)) notFound();
  // Resolve the channel id only — desk/briefing stream in Suspense so
  // CategoryChrome's H1 paints without waiting on board/quote work.
  return <ChannelBoardPageBody channel={category} />;
}
