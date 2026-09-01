import Link from "next/link";
import { categoryLabel, heatmapHref } from "@/lib/briefing/metrics";
import { isLiveEdition } from "@/lib/briefing/dates";
import { channelSectionHref, isPostChannel } from "@/lib/posts/channels";
import type { BriefingArticle } from "@/lib/types";
import { formatCount } from "@/lib/format";

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
          <span className="rounded-full border border-accent/40 px-2 py-0.5 font-sans text-[10px] font-semibold text-accent">
            {badge}
            {live ? " · Live" : " · Archive"}
          </span>
          <span className="font-sans text-[11px] text-muted">
            {article.editionDate} · {categoryLabel(article.category)} · {article.readingMinutes ?? 1}분 ·{" "}
            {formatCount(article.wordCount)}단어
          </span>
        </div>
        <h3
          className={`mt-2 font-semibold tracking-tight ${lead ? "text-lg md:text-xl" : "text-sm leading-6"}`}
        >
          {article.title}
        </h3>
        <p className={`mt-2 text-sm leading-6 text-muted ${lead ? "line-clamp-3" : "line-clamp-2"}`}>
          {article.excerpt}
        </p>
        <span className="mt-3 inline-flex text-sm font-medium text-accent">본문 읽기 →</span>
      </Link>
    </article>
  );
}
