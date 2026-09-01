import Link from "next/link";
import { formatCount } from "@/lib/format";
import { DeskEyebrow } from "@/components/ui/DeskEyebrow";
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
        <div>
          <DeskEyebrow variant="sans">
            Today&apos;s Desk
          </DeskEyebrow>
          <h2 id="trend-briefing-heading" className="mt-1 text-xl font-semibold tracking-tight">
            오늘의 트렌드 브리핑
          </h2>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/briefing" className="font-medium text-accent hover:underline">
            브리핑 허브
          </Link>
          <Link href="/briefing/archive" className="text-muted hover:text-ink">
            아카이브
          </Link>
        </div>
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
          <span className="rounded-full border border-accent/40 px-2 py-0.5 font-sans text-[10px] font-semibold text-accent">
            {meta.label}
          </span>
          <span className="font-sans text-[11px] text-muted">
            {post.editionDate} · {post.readingMinutes ?? 1}분 ·{" "}
            {formatCount(post.characterCount)}자
          </span>
        </div>
        <h3
          className={`mt-2 font-semibold tracking-tight ${lead ? "text-lg md:text-xl" : "text-sm leading-6"}`}
        >
          {post.title}
        </h3>
        <p
          className={`mt-2 text-sm leading-6 text-muted ${lead ? "line-clamp-3" : "line-clamp-2"}`}
        >
          {post.excerpt}
        </p>
      </Link>
    </article>
  );
}
