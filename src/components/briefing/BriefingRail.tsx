import Link from "next/link";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import type { BriefingArticle } from "@/lib/types";
import { DeskEyebrow } from "@/components/ui/DeskEyebrow";

export function BriefingRail({
  main,
  dives,
}: {
  main: BriefingArticle;
  dives: BriefingArticle[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <DeskEyebrow variant="sans">
            Today&apos;s Desk
          </DeskEyebrow>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">오늘의 트렌드 브리핑</h2>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/briefing" className="font-medium text-accent hover:underline">
            브리핑 허브
          </Link>
          <Link href="/briefing/archive" className="text-muted hover:text-ink">
            아카이브
          </Link>
        </div>
      </div>
      <div className="space-y-4">
        <BriefingCard article={main} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dives.map((article) => (
            <BriefingCard key={article.slug} article={article} />
          ))}
        </div>
      </div>
    </section>
  );
}
