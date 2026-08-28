import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DailyBriefing } from "@/components/briefing/DailyBriefing";
import { getBriefingBySlug, getEntitiesBySlugs } from "@/lib/api";
import { briefingMatchesChannel, channelSectionHref, getPostChannel } from "@/lib/posts/channels";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const briefing = await getBriefingBySlug(slug);
  if (!briefing) return { title: "브리핑을 찾을 수 없습니다" };
  return {
    title: briefing.title,
    description: briefing.excerpt,
    alternates: { canonical: `${channelSectionHref("politics", "briefing")}/${briefing.slug}` },
  };
}

export default async function PoliticsBriefingArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const briefing = await getBriefingBySlug(slug);
  if (!briefing || !briefingMatchesChannel(briefing, "politics")) notFound();
  const related = await getEntitiesBySlugs(briefing.relatedEntitySlugs);
  const meta = getPostChannel("politics");

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        <Link href={channelSectionHref("politics", "briefing")} className="hover:text-ink">
          {meta.label} 일일브리핑
        </Link>
        <span className="mx-2">/</span>
        {briefing.editionDate}
      </p>
      <DailyBriefing briefing={briefing} related={related} />
    </div>
  );
}
