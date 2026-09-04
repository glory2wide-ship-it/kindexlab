import Link from "next/link";
import { categoryLabel } from "@/lib/briefing/metrics";
import { isLiveEdition } from "@/lib/briefing/dates";
import type { BriefingArticle } from "@/lib/types";

/** Text-only featured briefing — matches landing lead column card. */
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

  return (
    <article className="rounded-2xl border border-line bg-panel transition-colors hover:border-accent/50">
      <Link href={href} className="block p-5 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-accent/40 px-2 py-0.5 font-sans text-[10px] font-semibold text-accent">
            {kicker}
            {live ? " · Live" : " · Archive"}
          </span>
          <span className="font-sans text-[11px] text-muted">
            {article.editionDate} · {article.deskLabel || categoryLabel(article.category)}
          </span>
        </div>
        <h2 className="mt-2 text-lg font-semibold tracking-tight md:text-xl">{article.title}</h2>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{article.excerpt}</p>
        <span className="mt-4 inline-flex font-medium text-accent">종합 브리핑 본문 읽기 →</span>
      </Link>
    </article>
  );
}
