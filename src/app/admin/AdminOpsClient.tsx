"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminDashboardPayload } from "@/lib/ops/admin-dashboard";

function levelClass(level: string): string {
  if (level === "ok") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (level === "warn") return "text-amber-800 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

function LevelBadge({ level }: { level: string }) {
  const label = level === "ok" ? "정상" : level === "warn" ? "주의" : "실패";
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium tracking-wide ${levelClass(level)}`}
    >
      {label}
    </span>
  );
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function Section({
  title,
  subtitle,
  level,
  children,
}: {
  title: string;
  subtitle: string;
  level?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line py-8 last:border-b-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        {level ? <LevelBadge level={level} /> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminOpsClient({ initial }: { initial: AdminDashboardPayload }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/admin/ops?date=${encodeURIComponent(data.editionDate)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setError(`새로고침 실패 (${res.status})`);
          return;
        }
        setData((await res.json()) as AdminDashboardPayload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "네트워크 오류");
      }
    });
  }, [data.editionDate]);

  const logout = useCallback(() => {
    startTransition(async () => {
      await fetch("/api/admin/logout", { method: "POST" });
      router.replace("/admin");
      router.refresh();
    });
  }, [router]);

  const { daily, traffic, webHealth, liveFill } = data;

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10 sm:px-6">
      <header className="border-b border-line pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">KinDex · Ops</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">운영 현황</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={pending}
              className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-ink hover:bg-board disabled:opacity-50"
            >
              {pending ? "갱신 중…" : "지금 갱신"}
            </button>
            <button
              type="button"
              onClick={logout}
              disabled={pending}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-board disabled:opacity-50"
            >
              로그아웃
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted">
          KST {data.editionDate} · 측정{" "}
          {new Date(data.generatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
        </p>
        <p className="mt-1 text-sm text-muted">
          웹 URL:{" "}
          <a
            className="text-ink underline decoration-line underline-offset-2 hover:text-accent"
            href="https://www.kindexlab.com/admin"
          >
            https://www.kindexlab.com/admin
          </a>
        </p>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </header>

      <Section
        title="방문자"
        subtitle={`일일 순방문자 · 현재 접속(최근 ${traffic.activeWindowMinutes}분 하트비트).`}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <dl className="rounded-xl border border-line bg-panel px-4 py-4">
            <dt className="text-xs text-muted">오늘 방문자 (KST)</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums text-ink">
              {traffic.dailyVisitors.toLocaleString("ko-KR")}
              <span className="ml-2 text-base font-normal text-muted">명</span>
            </dd>
          </dl>
          <dl className="rounded-xl border border-line bg-panel px-4 py-4">
            <dt className="text-xs text-muted">현재 방문자</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums text-ink">
              {traffic.activeVisitors.toLocaleString("ko-KR")}
              <span className="ml-2 text-base font-normal text-muted">명</span>
            </dd>
          </dl>
        </div>
        {traffic.note ? <p className="mt-3 text-xs text-amber-800">{traffic.note}</p> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">오늘 많이 본 글</h3>
            {traffic.topBriefings.length === 0 ? (
              <p className="mt-2 text-sm text-muted">아직 집계된 브리핑 조회가 없습니다.</p>
            ) : (
              <ol className="mt-2 space-y-2 text-sm">
                {traffic.topBriefings.map((row, index) => (
                  <li
                    key={row.slug}
                    className="flex items-baseline justify-between gap-3 border-b border-line/50 py-1.5 last:border-0"
                  >
                    <a className="min-w-0 truncate text-ink hover:underline" href={row.path}>
                      {index + 1}. {row.title}
                    </a>
                    <span className="shrink-0 tabular-nums text-muted">{row.count}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">오늘 많이 본 종목</h3>
            {traffic.topRankings.length === 0 ? (
              <p className="mt-2 text-sm text-muted">아직 집계된 종목 조회가 없습니다.</p>
            ) : (
              <ol className="mt-2 space-y-2 text-sm">
                {traffic.topRankings.map((row, index) => (
                  <li
                    key={row.slug}
                    className="flex items-baseline justify-between gap-3 border-b border-line/50 py-1.5 last:border-0"
                  >
                    <a className="min-w-0 truncate text-ink hover:underline" href={row.path}>
                      {index + 1}. {row.title}
                    </a>
                    <span className="shrink-0 tabular-nums text-muted">{row.count}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="일일 생성 · 비용"
        subtitle="브리핑·히트맵 분석 성공/실패와 Gemini API 추정 비용. 보드 갱신 비용은 별도."
      >
        {!daily.hasData ? (
          <p className="rounded-lg border border-dashed border-line bg-panel px-4 py-6 text-sm text-muted">
            오늘자 ops digest가 아직 없습니다. CI 생성 잡이 커밋하면 여기에 쌓입니다.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <dl className="rounded-xl border border-line bg-panel px-4 py-4">
              <dt className="text-xs text-muted">생성 성공 / 실패 / 스킵</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums text-ink">
                {daily.generationOk}
                <span className="mx-1 text-base font-normal text-muted">/</span>
                {daily.generationFail}
                <span className="mx-1 text-base font-normal text-muted">/</span>
                {daily.generationSkip}
              </dd>
              <dd className="mt-3 text-sm text-muted">생성 API {daily.generationKrwLabel}</dd>
            </dl>
            <dl className="rounded-xl border border-line bg-panel px-4 py-4">
              <dt className="text-xs text-muted">보드 갱신</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums text-ink">
                {daily.boardsRefreshed}
                <span className="ml-2 text-base font-normal text-muted">보드</span>
              </dd>
              <dd className="mt-3 text-sm text-muted">
                갱신 API {daily.boardRefreshKrwLabel}
                {daily.boardRefreshFail > 0 ? ` · 실패 ${daily.boardRefreshFail}` : ""}
              </dd>
            </dl>
          </div>
        )}
      </Section>

      <Section
        title="웹 병목 · 로딩 · 랜딩"
        subtitle="약 6시간 창 — 트렌드 스냅샷, 랜딩 캐시, published 보드 TTL."
        level={webHealth.level}
      >
        <ul className="space-y-2">
          {webHealth.checks.map((check) => (
            <li
              key={check.id}
              className="flex flex-col gap-1 rounded-lg border border-line bg-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-2">
                <LevelBadge level={check.level} />
                <span className="text-sm font-medium text-ink">{check.label}</span>
              </div>
              <p className="text-sm text-muted sm:max-w-[60%] sm:text-right">{check.detail}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="히트맵 LIVE 채움"
        subtitle="약 1시간 창 — 카테고리별 화면 헤드 LIVE 비율 (스냅샷·오버레이 기준)."
        level={liveFill.level}
      >
        <p className="mb-4 text-sm text-muted">
          스냅샷 {liveFill.snapshotItems.toLocaleString("ko-KR")}항목
          {liveFill.snapshotAgeMinutes != null ? ` · ${liveFill.snapshotAgeMinutes}분 전` : ""}
          {" · "}
          랜딩 LIVE {liveFill.landingLiveLead}/{liveFill.screenCap} ({pct(liveFill.landingLivePct)})
        </p>
        {liveFill.notes.length > 0 ? (
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {liveFill.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-board text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">카테고리</th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2 font-medium">LIVE</th>
                <th className="px-3 py-2 font-medium">채움</th>
                <th className="px-3 py-2 font-medium">보드</th>
              </tr>
            </thead>
            <tbody>
              {liveFill.channels.map((row) => (
                <tr key={row.channel} className="border-t border-line">
                  <td className="px-3 py-2.5 font-medium text-ink">{row.label}</td>
                  <td className="px-3 py-2.5">
                    <LevelBadge level={row.level} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-ink">{pct(row.livePct)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-ink">{pct(row.fillPct)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">{row.boardCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
