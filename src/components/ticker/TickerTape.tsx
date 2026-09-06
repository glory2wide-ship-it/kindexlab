import Link from "next/link";
import { formatRate } from "@/lib/format";
import { entityHref } from "@/lib/slugs";
import { rankForTicker, tickerBuzzScore, tickerChangeRate } from "@/lib/ticker/rank";
import type { RankingEntity } from "@/lib/types";

export function TickerTape({ items }: { items: RankingEntity[] }) {
  const ranked = rankForTicker(items);
  if (!ranked.length) return null;
  const loop = [...ranked, ...ranked];
  const durationSec = Math.max(120, Math.round(Math.max(ranked.length, 1) * 2.4));

  return (
    <div className="relative overflow-hidden border-b border-line bg-panel">
      <div
        className="ticker-track flex w-max gap-8 py-2 pr-8"
        style={{ ["--ticker-duration" as string]: `${durationSec}s` }}
      >
        {loop.map((item, index) => {
          const change = tickerChangeRate(item);
          const up = change > 0;
          const down = change < 0;
          const tone = up ? "text-up" : down ? "text-down" : "text-muted";
          return (
            <Link
              key={`${item.id}-${index}`}
              href={entityHref(item)}
              suppressHydrationWarning
              className="flex shrink-0 items-center gap-2 font-sans text-[13.8px] font-medium tracking-tight"
            >
              <span className="text-muted">{String(item.rank).padStart(2, "0")}</span>
              <span className="text-ink">{item.name}</span>
              <span className={tone}>
                {up ? "▲" : down ? "▼" : "–"} {formatRate(change)}
              </span>
              <span className="text-muted">{tickerBuzzScore(item).toFixed(1)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
