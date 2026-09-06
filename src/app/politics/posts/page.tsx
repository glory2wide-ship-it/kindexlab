import type { Metadata } from "next";
import { ChannelHubPage, channelHubMetadata } from "@/components/posts/ChannelHubPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = channelHubMetadata("politics");

export default function PoliticsPostsPage() {
  return <ChannelHubPage channel="politics" />;
}
