import type { CategoryInfoPayload, CategoryInfoSparkline } from "@/lib/entity/category-info/types";

function formatDateOnly(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

/** KST date + time for refresh stamps (최근/다음 업데이트). */
function formatDateTime(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Display values as 억원 (public RTMS points are in 만원). */
function formatSparkEok(valueManwon: number): string {
  const eok = valueManwon / 10_000;
  if (eok >= 10) return `${eok % 1 < 0.05 ? eok.toFixed(0) : eok.toFixed(1)}억`;
  if (eok >= 1) return `${eok.toFixed(1)}억`;
  return `${Math.round(valueManwon).toLocaleString("ko-KR")}만`;
}

function formatAxisTime(label: string): string {
  // "2024.03" → "2024.3" / keep year.month
  const m = label.match(/^(\d{4})\.(\d{1,2})$/);
  if (!m) return label;
  return `${m[1]}.${Number(m[2])}`;
}

function CategoryInfoSparklineChart({ sparkline }: { sparkline: CategoryInfoSparkline }) {
  const values = sparkline.points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const w = 320;
  const h = 120;
  const padL = 42;
  const padR = 10;
  const padT = 12;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const coords = sparkline.points.map((point, index) => {
    const x =
      sparkline.points.length === 1
        ? padL + plotW / 2
        : padL + (index / (sparkline.points.length - 1)) * plotW;
    const y = padT + plotH - ((point.value - min) / span) * plotH;
    return { x, y, point };
  });
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const yTicks = [max, (max + min) / 2, min];
  const xLabels =
    sparkline.points.length <= 6
      ? sparkline.points.map((p, i) => ({ i, label: p.label }))
      : [
          { i: 0, label: sparkline.points[0]!.label },
          {
            i: Math.floor((sparkline.points.length - 1) / 2),
            label: sparkline.points[Math.floor((sparkline.points.length - 1) / 2)]!.label,
          },
          { i: sparkline.points.length - 1, label: sparkline.points.at(-1)!.label },
        ];

  return (
    <div className="housing-spark-120 mt-4 rounded-xl border border-line bg-board/50 px-3 py-3">
      <p className="text-xs font-semibold tracking-wide text-soft">{sparkline.title}</p>
      <p className="mt-0.5 text-[10px] text-muted">X: 시간(연·월) · Y: 거래금액(억원)</p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-2 h-36 w-full text-accent"
        role="img"
        aria-label={sparkline.title}
      >
        {yTicks.map((tick) => {
          const y = padT + plotH - ((tick - min) / span) * plotH;
          return (
            <g key={`y-${tick}`}>
              <line
                x1={padL}
                x2={w - padR}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeWidth="1"
              />
              <text
                x={padL - 4}
                y={y + 3}
                textAnchor="end"
                className="fill-current"
                style={{ fontSize: 8, opacity: 0.55 }}
              >
                {formatSparkEok(tick)}
              </text>
            </g>
          );
        })}
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polyline}
        />
        {coords.map(({ x, y, point }) => (
          <circle key={point.label} cx={x} cy={y} r="2.5" fill="currentColor" />
        ))}
        {xLabels.map(({ i, label }) => {
          const x =
            sparkline.points.length === 1
              ? padL + plotW / 2
              : padL + (i / (sparkline.points.length - 1)) * plotW;
          return (
            <text
              key={`x-${label}-${i}`}
              x={x}
              y={h - 8}
              textAnchor="middle"
              className="fill-current"
              style={{ fontSize: 8, opacity: 0.55 }}
            >
              {formatAxisTime(label)}
            </text>
          );
        })}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {sparkline.points.map((point) => (
          <li key={point.label}>
            {formatAxisTime(point.label)} {formatSparkEok(point.value)}
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
  const lastLabel =
    formatDateTime(payload.refreshLastAt) || formatDateTime(payload.updatedAt);
  const nextLabel = formatDateTime(payload.refreshNextAt);

  return (
    <section
      className="rounded-2xl border border-line bg-panel p-[18px] shadow-sm md:p-8"
      aria-label={`${payload.channelLabel} 종목 정보`}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="detail-section-title-120 text-[13px] text-muted">히트맵 채널 맞춤 정보</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink md:text-2xl">
            {payload.channelLabel}
            <span className="ml-2 text-base font-medium text-soft">· {payload.entityName}</span>
          </h2>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {payload.sparse ? (
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
              업데이트 중
            </span>
          ) : null}
          {lastLabel || nextLabel ? (
            <span className="category-info-refresh-120 grid max-w-[22rem] grid-cols-[7.5rem_minmax(0,1fr)] gap-x-1 text-left text-xs leading-snug text-muted sm:text-sm">
              {lastLabel ? (
                <>
                  <span className="whitespace-nowrap">최근 업데이트</span>
                  <span className="tabular-nums">{lastLabel}</span>
                </>
              ) : null}
              {nextLabel ? (
                <>
                  <span className="whitespace-nowrap">다음 업데이트</span>
                  <span className="tabular-nums">{nextLabel}</span>
                </>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>

      {payload.statusMessage ? (
        <p className="mt-3 rounded-xl border border-line/80 bg-board/70 px-3 py-2 text-base text-ink/90">
          {payload.statusMessage}
        </p>
      ) : null}

      {payload.rows.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-line">
          <table className="category-info-table min-w-full table-fixed text-left text-base">
            <caption className="sr-only">{payload.channelLabel} 상세 항목</caption>
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[72%]" />
            </colgroup>
            <thead className="bg-board text-sm text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">항목</th>
                <th className="px-3 py-2.5 font-medium">내용</th>
              </tr>
            </thead>
            <tbody>
              {payload.rows.map((row) => (
                <tr key={`${row.label}-${row.value.slice(0, 40)}`} className="border-t border-line">
                  <th
                    scope="row"
                    className={`px-3 py-3 align-top text-muted ${
                      row.emphasize ? "font-semibold text-ink" : "font-medium"
                    }`}
                  >
                    {row.label}
                  </th>
                  <td
                    className={`px-3 py-3 align-top leading-relaxed text-ink break-words ${
                      row.multiline || row.value.includes("\n")
                        ? "whitespace-pre-line"
                        : "leading-snug"
                    } ${row.emphasize ? "font-semibold" : ""}`}
                  >
                    {row.href ? (
                      <a
                        href={row.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-words text-accent underline decoration-line underline-offset-2 hover:opacity-80"
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
          <p className="text-xs font-semibold tracking-wide text-soft">{chip.label}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {chip.items.map((item) => (
              <li
                key={item}
                className="max-w-full break-words rounded-md border border-line bg-board px-2.5 py-1 text-sm font-semibold text-ink"
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

      {(payload.sparklines ?? [])
        .filter((chart) => chart.points.length >= 2)
        .filter((chart) => chart.title !== payload.sparkline?.title)
        .map((chart) => (
          <CategoryInfoSparklineChart key={chart.title} sparkline={chart} />
        ))}

      {payload.synopsis ? (
        <p className="mt-4 break-words text-base leading-7 text-ink/90">{payload.synopsis}</p>
      ) : null}

      <div className="mt-4 border-t border-line pt-4">
        <h3 className="text-sm font-semibold tracking-wide text-soft">
          관련 뉴스 · 이슈
        </h3>
        <ul className="mt-2 space-y-2.5">
          {payload.links.map((link) => {
            const published = formatDateOnly(link.publishedAt);
            return (
              <li key={link.href} className="break-words text-base leading-snug">
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent underline decoration-line underline-offset-2 hover:opacity-80"
                >
                  {link.title}
                </a>
                {link.source ? (
                  <span className="ml-2 text-sm text-muted">{link.source}</span>
                ) : null}
                {published ? (
                  <span className="ml-2 text-sm tabular-nums text-muted">{published}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {payload.notice ? (
        <p className="mt-4 break-words rounded-lg bg-board px-3 py-2 text-xs leading-5 text-muted">
          주의: {payload.notice}
        </p>
      ) : null}
    </section>
  );
}
