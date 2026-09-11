import Link from "next/link";
import { INSIGHT_CARD_TYPE } from "@/components/briefing/insight-card-type";
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
          <span className={INSIGHT_CARD_TYPE.badge}>
            {kicker}
            {live ? " · Live" : " · Archive"}
          </span>
          <span className={INSIGHT_CARD_TYPE.meta}>
            {article.editionDate} · {article.deskLabel || categoryLabel(article.category)}
          </span>
        </div>
        <h2 className={`mt-2 ${INSIGHT_CARD_TYPE.titleLead}`}>{article.title}</h2>
        <p className={`mt-2 line-clamp-3 ${INSIGHT_CARD_TYPE.body}`}>{article.excerpt}</p>
        <span className={`mt-4 ${INSIGHT_CARD_TYPE.cta}`}>종합 브리핑 본문 읽기 →</span>
      </Link>
    </article>
  );
}
