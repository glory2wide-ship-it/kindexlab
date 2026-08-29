import Link from "next/link";
import { BriefingCover } from "@/components/briefing/BriefingCover";
import { categoryLabel } from "@/lib/briefing/metrics";
import { isLiveEdition } from "@/lib/briefing/dates";
import { withBriefingCover } from "@/lib/briefing/cover";
import type { BriefingArticle } from "@/lib/types";
import { formatCount } from "@/lib/format";

export function FeaturedBriefingCard({
  article,
  href,
  kicker,
}: {
  article: BriefingArticle;
  href: string;
  kicker: string;
}) {
  const live = isLiveEdition(article.editionDate);
  const cover = withBriefingCover(article).coverImage;
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-panel md:grid md:grid-cols-[1.15fr_1fr]">
      {cover ? (
        <Link href={href} className="block min-h-[12rem]">
          <BriefingCover image={cover} variant="flush" showCaption={false} priority />
        </Link>
      ) : (
        <Link href={href} className="block min-h-[12rem] bg-gradient-to-br from-accent/20 via-board to-panel" />
      )}
      <div className="flex flex-col justify-center p-6 md:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          {kicker}
          {live ? " · Live" : " · Archive"}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
          <Link href={href} className="hover:text-accent">
            {article.title}
          </Link>
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted">{article.excerpt}</p>
        <p className="mt-4 font-mono text-[11px] text-muted">
          {article.editionDate} · {article.deskLabel || categoryLabel(article.category)} ·{" "}
          {article.readingMinutes ?? 1}분 · {formatCount(article.wordCount)}단어
        </p>
        <Link href={href} className="mt-5 inline-flex font-medium text-accent hover:underline">
          종합 브리핑 본문 읽기 →
        </Link>
      </div>
    </article>
  );
}
