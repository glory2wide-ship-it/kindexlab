import Link from "next/link";
import { BriefingCover } from "@/components/briefing/BriefingCover";
import { categoryLabel, heatmapHref } from "@/lib/briefing/metrics";
import { isLiveEdition } from "@/lib/briefing/dates";
import { withBriefingCover } from "@/lib/briefing/cover";
import type { BriefingArticle } from "@/lib/types";

export function BriefingCard({ article }: { article: BriefingArticle }) {
  const live = isLiveEdition(article.editionDate);
  const cover = withBriefingCover(article).coverImage;
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-panel">
      {cover ? (
        <Link href={`/briefing/${article.slug}`} className="block">
          <BriefingCover image={cover} variant="flush" showCaption={false} />
        </Link>
      ) : null}
      <div className="p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          {article.kind === "main" ? "Daily Briefing" : "Category Deep Dive"}
          {live ? " · Live" : " · Archive"}
        </p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight">
          <Link href={`/briefing/${article.slug}`} className="hover:text-accent">
            {article.title}
          </Link>
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">{article.excerpt}</p>
        <p className="mt-3 font-mono text-[11px] text-muted">
          {article.editionDate} · {categoryLabel(article.category)} · {article.readingMinutes}분 ·{" "}
          {article.wordCount.toLocaleString("ko-KR")}단어
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href={`/briefing/${article.slug}`} className="font-medium text-accent hover:underline">
            본문 읽기 →
          </Link>
          <Link href={heatmapHref(article.category)} className="text-muted hover:text-ink">
            {categoryLabel(article.category)} 히트맵
          </Link>
        </div>
      </div>
    </article>
  );
}
