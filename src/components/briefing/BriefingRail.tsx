import Link from "next/link";
import { BriefingCard } from "@/components/briefing/BriefingCard";
import { getPostChannel, isPostChannel } from "@/lib/posts/channels";
import type { BriefingArticle } from "@/lib/types";

function channelKicker(article: BriefingArticle): string | undefined {
  if (article.deskLabel) return article.deskLabel;
  if (article.channel && isPostChannel(article.channel)) {
    return getPostChannel(article.channel).label;
  }
  return undefined;
}

/**
 * Landing rail for "Update 브리핑".
 *
 * Must be fed by `loadFeaturedBriefings` — never premium columns from
 * generated.json, which can show a stale editionDate after midnight KST.
 */
export function BriefingRail({ articles }: { articles: BriefingArticle[] }) {
  if (!articles.length) return null;
  const [lead, ...rest] = articles;

  return (
    <section aria-labelledby="trend-briefing-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="trend-briefing-heading" className="text-xl font-semibold tracking-tight">
          Update 브리핑
        </h2>
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
        <BriefingCard article={lead} kicker={channelKicker(lead)} lead />
        {rest.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((article) => (
              <BriefingCard
                key={article.slug}
                article={article}
                kicker={channelKicker(article)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
