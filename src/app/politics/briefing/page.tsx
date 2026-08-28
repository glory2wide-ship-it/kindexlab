import type { Metadata } from "next";
import { ChannelBriefingPage } from "@/components/briefing/ChannelBriefingPage";
import { channelSectionHref } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "정치 일일브리핑",
  description:
    "정치 종합 브리핑과 헤드라인·대통령·정당·정치인 등 하부 메뉴 심층 분석. 표, FAQ, 1,500단어 이상 본문을 같은 규격으로 발행합니다.",
  alternates: { canonical: channelSectionHref("politics", "briefing") },
  openGraph: {
    title: `정치 일일브리핑 · ${SITE.name}`,
    url: `${SITE.url}${channelSectionHref("politics", "briefing")}`,
  },
};

export default async function PoliticsBriefingPage() {
  return <ChannelBriefingPage channel="politics" />;
}
