import type { Metadata } from "next";
import { ChannelBoardPageBody } from "@/components/dashboard/ChannelBoardPageBody";
import { getPostChannel, LIVE_INDEX_LABEL } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

/** ISR: matches the 3-minute live board refresh cadence. */
export const revalidate = 180;

const meta = getPostChannel("politics");

export const metadata: Metadata = {
  title: `${meta.label} ${LIVE_INDEX_LABEL}`,
  description:
    "정치 종합 브리핑과 헤드라인·대통령·정당 등 Update 키워드, 히트맵 지수를 같은 페이지에서 봅니다.",
  alternates: { canonical: meta.href },
  openGraph: {
    title: `${meta.indexTitle} · ${SITE.name}`,
    description: "정치 종합 브리핑과 Update 키워드, 3분봉 히트맵 지수.",
    url: `${SITE.url}/politics`,
  },
};

export default function PoliticsBoardPage() {
  return <ChannelBoardPageBody channel="politics" />;
}
