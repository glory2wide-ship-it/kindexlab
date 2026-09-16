import type { CategoryInfoPayload, CategoryInfoSparkline } from "@/lib/entity/category-info/types";

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatSparkValue(value: number): string {
  if (value >= 10_000) {
    const eok = value / 10_000;
    return `${eok % 1 === 0 ? eok.toFixed(0) : eok.toFixed(1)}억`;
  }
  return `${Math.round(value).toLocaleString("ko-KR")}만`;
}

function CategoryInfoSparklineChart({ sparkline }: { sparkline: CategoryInfoSparkline }) {
  const values = sparkline.points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const w = 280;
  const h = 56;
  const pad = 4;
  const coords = sparkline.points.map((point, index) => {
    const x =
      sparkline.points.length === 1
        ? w / 2
        : pad + (index / (sparkline.points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((point.value - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  const polyline = coords.join(" ");

  return (
    <div className="mt-4 rounded-xl border border-line bg-board/50 px-3 py-3">
      <p className="text-[11px] font-semibold tracking-wide text-soft">{sparkline.title}</p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-2 h-14 w-full text-accent"
        role="img"
        aria-label={sparkline.title}
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polyline}
        />
        {sparkline.points.map((point, index) => {
          const [x, y] = coords[index]!.split(",").map(Number);
          return <circle key={point.label} cx={x} cy={y} r="2.5" fill="currentColor" />;
        })}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
        {sparkline.points.map((point) => (
          <li key={point.label}>
            {point.label} {formatSparkValue(point.value)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Presentational card/table for Excel-driven channel packs.
 * Kept free of data loading so Suspense + skeleton can wrap the async parent.
 */
export function ItemDetailCategoryInfoView({
  payload,
}: {
  payload: CategoryInfoPayload;
}) {
  const updated = formatUpdatedAt(payload.updatedAt);

  return (
    <section
      className="rounded-2xl border border-line bg-panel p-[18px] shadow-sm md:p-8"
      aria-label={`${payload.channelLabel} 종목 정보`}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-muted">히트맵 채널 맞춤 정보</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink md:text-xl">
            {payload.channelLabel}
            <span className="ml-2 text-sm font-medium text-soft">· {payload.entityName}</span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-line bg-board px-2 py-1 text-[11px] font-semibold text-soft">
            {payload.category === "entertainment"
              ? "엔터"
              : payload.category === "politics"
                ? "정치"
                : payload.category === "economy"
                  ? "경제"
                  : payload.category === "culture"
                    ? "문화/생활"
                    : "여행/맛집"}
          </span>
          {payload.sparse ? (
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
              업데이트 중
            </span>
          ) : null}
          {updated ? (
            <span className="text-[10px] text-muted">점검 {updated}</span>
          ) : null}
        </div>
      </div>

      {payload.statusMessage ? (
        <p className="mt-3 rounded-xl border border-line/80 bg-board/70 px-3 py-2 text-sm text-ink/90">
          {payload.statusMessage}
        </p>
      ) : null}

      {payload.rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">{payload.channelLabel} 상세 항목</caption>
            <thead className="bg-board text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">항목</th>
                <th className="px-3 py-2 font-medium">내용</th>
              </tr>
            </thead>
            <tbody>
              {payload.rows.map((row) => (
                <tr key={`${row.label}-${row.value}`} className="border-t border-line">
                  <th
                    scope="row"
                    className={`whitespace-nowrap px-3 py-2.5 align-top text-muted ${
                      row.emphasize ? "font-semibold text-ink" : "font-medium"
                    }`}
                  >
                    {row.label}
                  </th>
                  <td
                    className={`px-3 py-2.5 leading-snug text-ink ${
                      row.emphasize ? "font-semibold" : ""
                    }`}
                  >
                    {row.href ? (
                      <a
                        href={row.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent underline decoration-line underline-offset-2 hover:opacity-80"
                      >
                        {row.value}
                      </a>
                    ) : (
                      row.value
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {payload.chips.map((chip) => (
        <div key={chip.label} className="mt-4">
          <p className="text-[11px] font-semibold tracking-wide text-soft">{chip.label}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {chip.items.map((item) => (
              <li
                key={item}
                className="rounded-md border border-line bg-board px-2 py-1 text-xs font-semibold text-ink"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {payload.sparkline && payload.sparkline.points.length >= 2 ? (
        <CategoryInfoSparklineChart sparkline={payload.sparkline} />
      ) : null}

      {payload.synopsis ? (
        <p className="mt-4 text-sm leading-6 text-ink/90">{payload.synopsis}</p>
      ) : null}

      <div className="mt-4 border-t border-line pt-4">
        <h3 className="text-[11px] font-semibold tracking-wide text-soft">
          관련 뉴스 · 이슈 링크
        </h3>
        <ul className="mt-2 space-y-2">
          {payload.links.map((link) => (
            <li key={link.href} className="text-sm">
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent underline decoration-line underline-offset-2 hover:opacity-80"
              >
                {link.title}
              </a>
              {link.source ? (
                <span className="ml-2 text-[11px] text-muted">{link.source}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {payload.notice ? (
        <p className="mt-4 rounded-lg bg-board px-3 py-2 text-[11px] leading-5 text-muted">
          주의: {payload.notice}
        </p>
      ) : null}
    </section>
  );
}
