import Link from "next/link";
import { INSIGHT_CARD_TYPE } from "@/components/briefing/insight-card-type";
import { categoryLabel } from "@/lib/briefing/metrics";
import { isLiveEdition } from "@/lib/briefing/dates";
import { channelSectionHref, isPostChannel } from "@/lib/posts/channels";
import type { BriefingArticle } from "@/lib/types";

/** Text-only briefing card — matches landing `PremiumColumnRail` layout. */
export function BriefingCard({
  article,
  href,
  kicker,
  lead = false,
}: {
  article: BriefingArticle;
  href?: string;
  kicker?: string;
  lead?: boolean;
}) {
  const live = isLiveEdition(article.editionDate);
  const articleHref =
    href ??
    (isPostChannel(article.channel)
      ? `${channelSectionHref(article.channel, "briefing")}/${article.slug}`
      : `/briefing/${article.slug}`);
  const badge =
    kicker ||
    article.deskLabel ||
    (article.kind === "main" ? "Daily Briefing" : "Category Deep Dive");

  return (
    <article className="rounded-2xl border border-line bg-panel transition-colors hover:border-accent/50">
      <Link href={articleHref} className="block p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={INSIGHT_CARD_TYPE.badge}>
            {badge}
            {live ? " · Live" : " · Archive"}
          </span>
          <span className={INSIGHT_CARD_TYPE.meta}>
            {article.editionDate} · {categoryLabel(article.category)}
          </span>
        </div>
        <h3 className={`mt-2 ${lead ? INSIGHT_CARD_TYPE.titleLead : INSIGHT_CARD_TYPE.title}`}>
          {article.title}
        </h3>
        <p
          className={`mt-2 ${INSIGHT_CARD_TYPE.body} ${lead ? "line-clamp-3" : "line-clamp-2"}`}
        >
          {article.excerpt}
        </p>
        <span className={`mt-3 ${INSIGHT_CARD_TYPE.cta}`}>본문 읽기 →</span>
      </Link>
    </article>
  );
}
