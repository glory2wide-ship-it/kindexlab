import type { Metadata } from "next";
import { AboutArticle } from "@/components/about/AboutArticle";
import { channelSectionHref, getPostChannel } from "@/lib/posts/channels";

export const dynamic = "force-dynamic";

const meta = getPostChannel("politics");

export const metadata: Metadata = {
  title: `${meta.label} 소개`,
  description: meta.description,
  alternates: { canonical: channelSectionHref("politics", "about") },
};

export default function PoliticsAboutPage() {
  return <AboutArticle channel="politics" />;
}
