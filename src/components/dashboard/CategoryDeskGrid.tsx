import Link from "next/link";
import { formatRate } from "@/lib/format";
import { stripRowQualifier } from "@/lib/boards/heatmap";
import { entityHref } from "@/lib/slugs";
import type { ChannelDesk } from "@/lib/boards/composite-desk";

function rateClass(rate: number): string {
  if (rate > 0.25) return "text-up";
  if (rate < -0.25) return "text-down";
  return "text-muted";
}

/**
 * Four desk cards under the unified heatmap.
 *
 * The landing board deliberately mixes every category together, which makes it
 * a poor map of what each desk actually covers. These cards restore that: three
 * live names per channel and a direct route into the desk itself.
 */
export function CategoryDeskGrid({ desks }: { desks: ChannelDesk[] }) {
  const populated = desks.filter((desk) => desk.top.length > 0);
  if (!populated.length) return null;

  return (
    <section aria-labelledby="desk-grid-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-sans text-[11px] font-semibold tracking-[0.18em] text-accent">
            CATEGORY DESKS
          </p>
          <h2 id="desk-grid-heading" className="mt-1 text-xl font-semibold tracking-tight">
            카테고리별 실시간 데스크
          </h2>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {populated.map((desk) => (
          <article
            key={desk.channel}
            className="flex flex-col rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-accent/50"
          >
            <p className="font-sans text-[10px] font-semibold tracking-[0.16em] text-accent">
              {desk.eyebrow}
            </p>
            <h3 className="mt-1 text-sm font-semibold leading-6 tracking-tight">
              {desk.label} DESK
            </h3>

            <ol className="mt-3 flex-1 space-y-2">
              {desk.top.map((item, index) => (
                <li key={item.id}>
                  <Link
                    href={entityHref(item)}
                    className="flex items-baseline gap-2 rounded-md px-1 py-1 text-sm hover:bg-board/60"
                  >
                    <span className="font-sans text-[11px] font-semibold tabular-nums text-muted">
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate font-medium" title={item.name}>
                      {stripRowQualifier(item.name)}
                    </span>
                    <span
                      className={`font-sans text-[11px] font-semibold tabular-nums ${rateClass(item.fluctuationRate)}`}
                    >
                      {formatRate(item.fluctuationRate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>

            <Link
              href={desk.href}
              className="mt-4 inline-flex items-center justify-center rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
            >
              {desk.label} 지수 바로가기 →
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
