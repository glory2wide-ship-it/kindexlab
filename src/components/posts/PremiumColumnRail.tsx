import Link from "next/link";
import { INSIGHT_CARD_TYPE } from "@/components/briefing/insight-card-type";
import { channelHref, getPostChannel } from "@/lib/posts/channels";
import type { FeaturedColumn } from "@/lib/posts/featured";

/**
 * Landing rail of the newest premium columns.
 *
 * The lead card is given the full width so the rail has an entry point, and the
 * rest sit in a grid; every card carries its desk label because the rail mixes
 * all four categories.
 */
export function PremiumColumnRail({ columns }: { columns: FeaturedColumn[] }) {
  if (!columns.length) return null;
  const [lead, ...rest] = columns;

  return (
    <section aria-labelledby="trend-briefing-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="trend-briefing-heading" className="text-xl font-semibold tracking-tight">
          투데이 브리핑
        </h2>
      </div>

      <ColumnCard column={lead} lead />
      {rest.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((column) => (
            <ColumnCard key={column.post.slug} column={column} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ColumnCard({ column, lead = false }: { column: FeaturedColumn; lead?: boolean }) {
  const { post, channel } = column;
  const meta = getPostChannel(channel);

  return (
    <article className="rounded-2xl border border-line bg-panel transition-colors hover:border-accent/50">
      <Link href={channelHref(channel, post.slug)} className="block p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={INSIGHT_CARD_TYPE.badge}>{meta.label}</span>
          <span className={INSIGHT_CARD_TYPE.meta}>{post.editionDate}</span>
        </div>
        <h3 className={`mt-2 ${lead ? INSIGHT_CARD_TYPE.titleLead : INSIGHT_CARD_TYPE.title}`}>
          {post.title}
        </h3>
        <p
          className={`mt-2 ${INSIGHT_CARD_TYPE.body} ${lead ? "line-clamp-3" : "line-clamp-2"}`}
        >
          {post.excerpt}
        </p>
      </Link>
    </article>
  );
}
