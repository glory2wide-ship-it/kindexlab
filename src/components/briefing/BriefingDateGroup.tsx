import Link from "next/link";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import { formatKoreanDate } from "@/lib/briefing/dates";
import type { BriefingArticle } from "@/lib/types";

export function BriefingDateGroup({
  date,
  articles,
}: {
  date: string;
  articles: BriefingArticle[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
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
          <BriefingCard key={article.slug} article={article} />
        ))}
      </div>
    </section>
  );
}
