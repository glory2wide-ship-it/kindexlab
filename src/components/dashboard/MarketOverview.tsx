import { formatKst, formatRate, formatScore } from "@/lib/format";
import type { MarketIndex, MarketStatus } from "@/lib/types";

export function MarketOverview({
  indices,
  updatedAt,
  status,
}: {
  indices: MarketIndex[];
  updatedAt: string;
  status: MarketStatus;
}) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      {indices.map((index) => {
        const up = index.changeRate > 0;
        const down = index.changeRate < 0;
        return (
          <article
            key={index.id}
            className="rounded-xl border border-line bg-panel p-4 shadow-sm"
          >
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{index.label}</span>
              <span className={up ? "text-up" : down ? "text-down" : ""}>
                {formatRate(index.changeRate)}
              </span>
            </div>
            <p className="mt-2 font-mono text-xl font-semibold tracking-tight lg:text-2xl">
              {formatScore(index.value)}
            </p>
            <p className="mt-1 text-xs text-muted">{index.note}</p>
          </article>
        );
      })}
      <p className="col-span-2 font-mono text-[11px] text-muted sm:col-span-3 lg:col-span-7">
        {status === "open" ? "실시간 집계 중" : "집계 마감"} · 기준 {formatKst(updatedAt)}{" "}
        KST · 등락 색상은 국내 시세판 관례(상승 빨강 / 하락 파랑)
      </p>
    </section>
  );
}
