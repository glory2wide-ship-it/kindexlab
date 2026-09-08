import { pollDelta, formatPollDelta, pollMetricLabels, POLL_LINKS, type PollBoardSnapshot } from "@/lib/politics/polls";
import { formatCount } from "@/lib/format";

function tone(value: number): string {
  if (value > 0) return "text-up";
  if (value < 0) return "text-down";
  return "text-muted";
}

export function AgencyPollComparisonBoard({ snapshot }: { snapshot: PollBoardSnapshot }) {
  const labels = pollMetricLabels(snapshot.kind);
  const title =
    snapshot.kind === "party"
      ? `${snapshot.subject} 정당 지지도 기관 비교`
      : snapshot.kind === "politician"
        ? `${snapshot.subject} 정치인 지지도 기관 비교`
        : "대통령 지지도 기관 비교";

  return (
    <section id="agency-poll-board" className="index-gothic scroll-mt-36 space-y-3 font-sans">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        <p className="text-[12px] text-muted">
          {snapshot.subject} · {snapshot.live ? "뉴스 수집 반영" : "최근 공표 시드"} · 상승 초록 / 하락 빨강
        </p>
      </div>

      {/* Mobile: stacked cards so six columns never force horizontal scroll. */}
      <ul className="space-y-3 md:hidden">
        {snapshot.polls.map((poll) => {
          const posDelta = pollDelta(poll.positive, poll.previousPositive);
          const negDelta = pollDelta(poll.negative, poll.previousNegative);
          return (
            <li key={poll.id} className="rounded-xl border border-line bg-panel p-3">
              <p className="font-medium">{poll.agencyLabel}</p>
              <p className="mt-1 text-[11px] text-muted">{poll.surveyedAt}</p>
              <p className="mt-1 text-[11px] tabular-nums text-muted">
                {formatCount(poll.sampleSize)}명 · ±{poll.marginOfError}%p
              </p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div>
                  <dt className="text-muted">{labels.positive}율</dt>
                  <dd className={`mt-0.5 font-semibold tabular-nums ${tone(posDelta)}`}>{poll.positive}%</dd>
                </div>
                <div>
                  <dt className="text-muted">{labels.negative}율</dt>
                  <dd className={`mt-0.5 tabular-nums ${tone(negDelta)}`}>{poll.negative}%</dd>
                </div>
                <div>
                  <dt className="text-muted">직전 대비</dt>
                  <dd className={`mt-0.5 font-semibold tabular-nums ${tone(posDelta)}`}>
                    {formatPollDelta(posDelta)}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-visible rounded-xl border border-line bg-panel md:block md:overflow-x-auto">
        <table className="w-full border-collapse text-sm md:min-w-[48rem]">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              {[
                "조사 기관명",
                "조사 기간",
                "표본 크기 및 오차",
                `${labels.positive}율 (%)`,
                `${labels.negative}율 (%)`,
                "직전 조사 대비 증감",
              ].map((header) => (
                <th key={header} className="border-b border-line px-3 py-2.5 text-left font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {snapshot.polls.map((poll) => {
              const posDelta = pollDelta(poll.positive, poll.previousPositive);
              const negDelta = pollDelta(poll.negative, poll.previousNegative);
              return (
                <tr key={poll.id} className="odd:bg-transparent even:bg-board/50">
                  <td className="border-b border-line px-3 py-2.5 font-medium">{poll.agencyLabel}</td>
                  <td className="border-b border-line px-3 py-2.5">{poll.surveyedAt}</td>
                  <td className="border-b border-line px-3 py-2.5 tabular-nums">
                    {formatCount(poll.sampleSize)}명 · ±{poll.marginOfError}%p
                  </td>
                  <td className={`border-b border-line px-3 py-2.5 tabular-nums font-semibold ${tone(posDelta)}`}>
                    {poll.positive}%
                  </td>
                  <td className={`border-b border-line px-3 py-2.5 tabular-nums ${tone(negDelta)}`}>
                    {poll.negative}%
                  </td>
                  <td className={`border-b border-line px-3 py-2.5 tabular-nums font-semibold ${tone(posDelta)}`}>
                    {formatPollDelta(posDelta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] leading-6 text-muted">
        표는 각 기관의 최근 공표치를 나란히 둔 비교 보드입니다. 전화면접과 ARS는 표본·질문이 달라 숫자를 한 줄로 합치지
        않습니다. 등록 원문은{" "}
        <a href={POLL_LINKS.nesdc.href} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
          {POLL_LINKS.nesdc.label}
        </a>
        에서 확인합니다.
      </p>
    </section>
  );
}
