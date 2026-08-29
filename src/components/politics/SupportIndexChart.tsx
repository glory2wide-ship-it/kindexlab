"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MultiLineChart } from "@/components/charts/MultiLineChart";
import {
  POLL_METHOD_CARD,
  SUPPORT_AGENCIES,
  SUPPORT_COMPOSITE_COLOR,
  type SupportBar,
  type SupportChartPayload,
  type SupportKind,
} from "@/lib/politics/support-series";

const BARS: { id: SupportBar; label: string }[] = [
  { id: "1d", label: "일봉" },
  { id: "1w", label: "주봉" },
  { id: "1mo", label: "월봉" },
];

function formatWhen(iso?: string): string {
  if (!iso) return "시각 미상";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "시각 미상";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function SupportIndexChart({ kind }: { kind: SupportKind }) {
  const [subject, setSubject] = useState("");
  const [bar, setBar] = useState<SupportBar>("1w");
  const [payload, setPayload] = useState<SupportChartPayload | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    async (nextSubject: string, nextBar: SupportBar) => {
      setError("");
      const params = new URLSearchParams({ kind, bar: nextBar });
      if (nextSubject) params.set("subject", nextSubject);
      try {
        const response = await fetch(`/api/politics/support?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("load failed");
        const body = (await response.json()) as SupportChartPayload;
        setPayload(body);
        setSubject(body.subject);
      } catch {
        setError("여론조사 차트를 불러오지 못했습니다.");
      }
    },
    [kind],
  );

  useEffect(() => {
    void load("", "1w");
  }, [kind, load]);

  const lines = useMemo(() => {
    if (!payload) return [];
    return [
      ...SUPPORT_AGENCIES.map((agency) => ({
        id: agency.id,
        label: agency.label,
        color: agency.color,
        width: 1.8,
        values: payload.series.map((row) => row[agency.id]),
      })),
      {
        id: "composite",
        label: "KINDEX 통합 평균",
        color: SUPPORT_COMPOSITE_COLOR,
        width: 3.4,
        values: payload.series.map((row) => row.composite),
      },
    ];
  }, [payload]);

  const title = kind === "party" ? "정당 지지도 차트" : "정치인 지지도 차트";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-sans text-xs font-semibold tracking-[0.14em] text-accent">
            KINDEX POLL COMPOSITE · 6M
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        <p className="text-[12px] text-muted">
          한국갤럽 · 리얼미터 · NBS 전국지표조사 최근 6개월. 굵은 선은 기간 내 단순 평균 통합 지수입니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(payload?.subjects ?? []).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              setSubject(name);
              void load(name, bar);
            }}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              subject === name ? "border-accent bg-accent text-black" : "border-line text-muted hover:text-ink"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {BARS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setBar(item.id);
              void load(subject, item.id);
            }}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              bar === item.id ? "border-accent bg-accent text-black" : "border-line text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="rounded-xl border border-line bg-panel px-3 py-3">
          {error ? <p className="px-3 py-10 text-center text-sm text-muted">{error}</p> : null}
          {!error && payload ? (
            <MultiLineChart labels={payload.series.map((row) => row.t)} lines={lines} />
          ) : null}
          {!error && !payload ? (
            <p className="px-3 py-10 text-center text-sm text-muted">시계열을 집계하는 중입니다.</p>
          ) : null}
          <ul className="mt-2 flex flex-wrap gap-3 px-2 text-[11px] text-muted">
            {SUPPORT_AGENCIES.map((agency) => (
              <li key={agency.id} className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-4 rounded-full" style={{ background: agency.color }} />
                {agency.label}
                {payload?.latest[agency.id] != null ? ` ${payload.latest[agency.id]}%` : ""}
              </li>
            ))}
            <li className="flex items-center gap-1.5 font-semibold text-ink">
              <span className="inline-block h-1.5 w-4 rounded-full" style={{ background: "#f59e0b" }} />
              KINDEX 통합 {payload?.latest.composite ?? "–"}%
            </li>
          </ul>
        </div>
        <aside className="rounded-xl border border-line bg-panel p-4 text-[12px] leading-6 text-muted">
          <p className="text-xs font-semibold text-ink">조사 방식 안내</p>
          <p className="mt-2">
            <span className="text-ink">주기</span> · {POLL_METHOD_CARD.cadence}
          </p>
          <p>
            <span className="text-ink">방식</span> · {POLL_METHOD_CARD.method}
          </p>
          <p>
            <span className="text-ink">표본오차</span> · {POLL_METHOD_CARD.margin}
          </p>
          <p>
            <span className="text-ink">응답률</span> · {POLL_METHOD_CARD.response}
          </p>
          <p className="mt-3 text-[11px]">
            NBS는 엠브레인퍼블릭·케이스탯리서치·코리아리서치·한국리서치 4사 공동 격주 조사입니다. 기관 간 질문·표본이
            달라 통합 선은 참고용 단순 평균입니다.
          </p>
        </aside>
      </div>

      <div className="rounded-xl border border-line bg-panel">
        <div className="border-b border-line px-4 py-3">
          <p className="text-xs font-semibold">관련 주요 기사 5건</p>
          <p className="text-[11px] text-muted">조선·연합·중앙·동아 등 주요 언론 보도를 자동 수집합니다.</p>
        </div>
        <ol>
          {(payload?.related ?? []).length ? (
            payload?.related.map((story, index) => (
              <li key={story.url} className="border-b border-line last:border-b-0">
                <a
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 px-4 py-3 hover:bg-board/50"
                >
                  <span className="w-5 shrink-0 font-sans text-xs tabular-nums text-accent">{index + 1}</span>
                  <span>
                    <span className="block text-sm font-medium leading-6">{story.title}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      {story.publisher} · {formatWhen(story.publishedAt)}
                    </span>
                  </span>
                </a>
              </li>
            ))
          ) : (
            <li className="px-4 py-6 text-sm text-muted">관련 기사를 모으는 중이거나, 오늘 수집분이 없습니다.</li>
          )}
        </ol>
      </div>
    </section>
  );
}
