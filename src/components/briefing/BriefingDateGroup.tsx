import Link from "next/link";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import { formatKoreanDate } from "@/lib/briefing/dates";
import type { BriefingArticle } from "@/lib/types";

export function BriefingDateGroup({
  date,
  articles,
  hrefFor,
  kicker,
}: {
  date: string;
  articles: BriefingArticle[];
  hrefFor?: (article: BriefingArticle) => string;
  kicker?: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h2 className="text-lg font-semibold">
          <Link href={`/briefing/archive/${date}`} className="hover:text-accent">
            {formatKoreanDate(date)}
          </Link>
        </h2>
        <p className="font-mono text-[11px] text-muted">
          {date} · {articles.length}편
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {articles.map((article) => (
          <BriefingCard
            key={article.slug}
            article={article}
            href={hrefFor?.(article)}
            kicker={kicker || article.deskLabel}
          />
        ))}
      </div>
    </section>
  );
}
