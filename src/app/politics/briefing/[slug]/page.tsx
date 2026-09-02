import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DailyBriefing } from "@/components/briefing/DailyBriefing";
import { getEntitiesBySlugs } from "@/lib/api";
import { loadBriefingBySlug } from "@/lib/briefing/store";
import { briefingMatchesChannel, channelSectionHref, getPostChannel } from "@/lib/posts/channels";

export const revalidate = 60;

const loadBriefingPage = cache(async (slug: string) => {
  const briefing = await loadBriefingBySlug(slug);
  if (!briefing) return null;
  const related = briefing.relatedEntitySlugs.length
    ? await getEntitiesBySlugs(briefing.relatedEntitySlugs)
    : [];
  return { briefing, related };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const detail = await loadBriefingPage(slug);
  if (!detail) return { title: "브리핑을 찾을 수 없습니다" };
  const { briefing } = detail;
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
  const detail = await loadBriefingPage(slug);
  if (!detail) notFound();
  const { briefing, related } = detail;
  if (!briefingMatchesChannel(briefing, "politics")) notFound();
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
