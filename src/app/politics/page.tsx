import type { Metadata } from "next";
import { ChannelBoardPageBody } from "@/components/dashboard/ChannelBoardPageBody";
import { getPostChannel } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

/** ISR: matches the 3-minute live board refresh cadence. */
export const revalidate = 300;

const meta = getPostChannel("politics");

export const metadata: Metadata = {
  title: `${meta.label} 실시간 화제성 랭킹·지지율 지수`,
  description:
    "정당·정치인 지지도, 정부지원금, 정치 유튜브 등 실시간 히트맵과 투데이 브리핑을 KinDex에서 확인하세요.",
  alternates: { canonical: meta.href },
  openGraph: {
    title: `${meta.label} 실시간 화제성 랭킹·지지율 지수`,
    description: "정당·정치인 지지도와 5분봉 히트맵 지수를 한 페이지에서 봅니다.",
    url: `${SITE.url}/politics`,
  },
};

export default function PoliticsBoardPage() {
  return <ChannelBoardPageBody channel="politics" />;
}
