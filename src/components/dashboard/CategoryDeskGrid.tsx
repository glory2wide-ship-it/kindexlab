import Link from "next/link";
import { formatRate } from "@/lib/format";
import { stripRowQualifier } from "@/lib/boards/heatmap";
import { entityHref } from "@/lib/slugs";
import { changeForEntity } from "@/lib/timeframes";
import type { ChannelDesk } from "@/lib/boards/composite-desk";

function rateClass(rate: number): string {
  if (rate > 0.25) return "text-up";
  if (rate < -0.25) return "text-down";
  return "text-muted";
}

/**
 * Channel desk cards under the unified heatmap — five categories in one row on the landing page.
 */
export function CategoryDeskGrid({ desks }: { desks: ChannelDesk[] }) {
  if (!desks.length) return null;

  return (
    <section aria-labelledby="desk-grid-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="desk-grid-heading" className="text-xl font-semibold tracking-tight">
            카테고리별 실시간 데스크
          </h2>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="flex min-w-[56rem] gap-3 sm:min-w-0">
          {desks.map((desk) => (
            <article
              key={desk.channel}
              className="flex min-w-0 flex-1 basis-0 flex-col rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-accent/50"
            >
              <h3 className="text-sm font-semibold leading-6 tracking-tight">{desk.label}</h3>

              <ol className="mt-3 flex-1 space-y-2">
                {desk.top.length ? (
                  desk.top.map((item, index) => {
                    const rate = changeForEntity(item, "5m");
                    return (
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
                            className={`font-sans text-[11px] font-semibold tabular-nums ${rateClass(rate)}`}
                          >
                            {formatRate(rate)}
                          </span>
                        </Link>
                      </li>
                    );
                  })
                ) : (
                  <li className="px-1 py-1 text-xs text-muted">집계 준비 중</li>
                )}
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
      </div>
    </section>
  );
}
