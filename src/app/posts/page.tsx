import type { Metadata } from "next";
import { PostsIndexWithChannels } from "@/components/posts/ChannelHubPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "이슈 칼럼",
  description: `공개 환율·물가·날씨 데이터를 하루 3회 자동 해설합니다. ${SITE.name} SEO 칼럼.`,
  alternates: { canonical: "/posts" },
};

export const dynamic = "force-dynamic";

export default function PostsIndexPage() {
  return <PostsIndexWithChannels />;
}
