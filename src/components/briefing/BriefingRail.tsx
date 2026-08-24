import Link from "next/link";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import type { BriefingArticle } from "@/lib/types";

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
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            Today&apos;s Desk
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">오늘의 트렌드 브리핑</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            매일 종합 1편과 카테고리 심층 1~2편을 자동 발행합니다. 전문은 개별 페이지에 1,000단어
            이상으로 남기고, 어제 글은 아카이브 검색으로 쌓입니다.
          </p>
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <BriefingCard article={main} />
        <div className="grid gap-4">
          {dives.map((article) => (
            <BriefingCard key={article.slug} article={article} />
          ))}
        </div>
      </div>
    </section>
  );
}
