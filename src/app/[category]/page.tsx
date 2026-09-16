import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelBoardPageBody } from "@/components/dashboard/ChannelBoardPageBody";
import { getPostChannel, isPostChannel, LIVE_INDEX_LABEL } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

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
    title: `${meta.label} 실시간 화제성 랭킹·지수`,
    description: `${meta.label} 카테고리의 실시간 히트맵·하위 보드 랭킹과 투데이 브리핑을 KinDex에서 확인하세요. ${meta.description}`,
    alternates: { canonical: meta.href },
    openGraph: {
      title: `${meta.label} 실시간 화제성 랭킹·지수`,
      description: meta.description,
      url: `${SITE.url}${meta.href}`,
    },
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
