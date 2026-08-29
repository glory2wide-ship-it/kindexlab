import Link from "next/link";
import { formatRate } from "@/lib/format";
import { entityHref } from "@/lib/slugs";
import type { RankingEntity } from "@/lib/types";

export function TickerTape({ items }: { items: RankingEntity[] }) {
  const safe = (items ?? []).filter((item) => item?.id && item?.name);
  if (!safe.length) return null;
  const loop = [...safe, ...safe];
  const durationSec = Math.max(120, Math.round(Math.max(safe.length, 1) * 2.4));

  return (
    <div className="relative overflow-hidden border-b border-line bg-panel">
      <div
        className="ticker-track flex w-max gap-8 py-2 pr-8"
        style={{ ["--ticker-duration" as string]: `${durationSec}s` }}
      >
        {loop.map((item, index) => {
          const up = item.fluctuationRate > 0;
          const down = item.fluctuationRate < 0;
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
                {up ? "▲" : down ? "▼" : "–"} {formatRate(item.fluctuationRate)}
              </span>
              <span className="text-muted">{Number(item.buzzScore ?? 0).toFixed(1)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
