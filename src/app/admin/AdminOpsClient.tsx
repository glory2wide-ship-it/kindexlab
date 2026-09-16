"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_REFRESH_SCHEDULE } from "@/lib/ops/admin-schedule";
import type { AdminDashboardPayload } from "@/lib/ops/admin-types";

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

function formatKst(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatKstDate(editionDate: string): string {
  const [y, m, d] = editionDate.split("-").map(Number);
  if (!y || !m || !d) return editionDate;
  const dt = new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
  return dt.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

/** Milliseconds until the next KST wall-clock hour:minute (today or tomorrow). */
function msUntilNextKstTime(hour: number, minute: number): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const pick = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const y = pick("year");
  const mo = pick("month");
  const d = pick("day");
  const h = pick("hour");
  const mi = pick("minute");
  const s = pick("second");

  const nowUtcMs = Date.now();
  const asIfLocal = Date.UTC(y, mo - 1, d, h, mi, s);
  const kstOffsetMs = asIfLocal - nowUtcMs;

  let targetUtc = Date.UTC(y, mo - 1, d, hour, minute, 0) - kstOffsetMs;
  if (targetUtc <= nowUtcMs + 500) {
    targetUtc += 24 * 60 * 60 * 1000;
  }
  return Math.max(1_000, targetUtc - nowUtcMs);
}

function Section({
  title,
  subtitle,
  meta,
  level,
  children,
}: {
  title: string;
  subtitle: string;
  meta?: string;
  level?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line py-8 last:border-b-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          {meta ? <p className="mt-1 text-xs text-muted">{meta}</p> : null}
        </div>
        {level ? <LevelBadge level={level} /> : null}
      </div>
      {children}
    </section>
  );
}

type SectionKey = "daily" | "webHealth" | "liveFill";

type TabId = "traffic" | "daily" | "webHealth" | "liveFill" | "detailCollect";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "traffic", label: "방문자 현황" },
  { id: "daily", label: "일일 글생성비용" },
  { id: "webHealth", label: "웹 병목 · 로딩 · 랜딩" },
  { id: "liveFill", label: "히트맵 LIVE 채움" },
  { id: "detailCollect", label: "상세페이지 정보수집" },
];

export function AdminOpsClient({ initial }: { initial: AdminDashboardPayload }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabId>("traffic");
  const [sectionUpdatedAt, setSectionUpdatedAt] = useState({
    daily: initial.daily.updatedAt,
    webHealth: initial.webHealth.updatedAt,
    liveFill: initial.liveFill.updatedAt,
  });
  const editionRef = useRef(initial.editionDate);
  editionRef.current = data.editionDate;

  const fetchPayload = useCallback(async (): Promise<AdminDashboardPayload | null> => {
    const res = await fetch(`/api/admin/ops?date=${encodeURIComponent(editionRef.current)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setError(`새로고침 실패 (${res.status})`);
      return null;
    }
    return (await res.json()) as AdminDashboardPayload;
  }, []);

  const refreshSection = useCallback(
    (key: SectionKey) => {
      startTransition(async () => {
        setError(null);
        try {
          const next = await fetchPayload();
          if (!next) return;
          setData((prev) => {
            if (key === "daily") {
              return {
                ...prev,
                generatedAt: next.generatedAt,
                editionDate: next.editionDate,
                daily: next.daily,
                schedule: next.schedule,
                categoryInfoRefresh: next.categoryInfoRefresh,
                detailCollectApiCost: next.detailCollectApiCost,
              };
            }
            if (key === "webHealth") {
              return {
                ...prev,
                generatedAt: next.generatedAt,
                webHealth: next.webHealth,
              };
            }
            return {
              ...prev,
              generatedAt: next.generatedAt,
              liveFill: next.liveFill,
            };
          });
          setSectionUpdatedAt((prev) => ({
            ...prev,
            [key]:
              key === "daily"
                ? next.daily.updatedAt
                : key === "webHealth"
                  ? next.webHealth.updatedAt
                  : next.liveFill.updatedAt,
          }));
        } catch (err) {
          setError(err instanceof Error ? err.message : "네트워크 오류");
        }
      });
    },
    [fetchPayload],
  );

  const refreshAll = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const next = await fetchPayload();
        if (!next) return;
        setData(next);
        setSectionUpdatedAt({
          daily: next.daily.updatedAt,
          webHealth: next.webHealth.updatedAt,
          liveFill: next.liveFill.updatedAt,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "네트워크 오류");
      }
    });
  }, [fetchPayload]);

  // Daily cost board — fire at 11:10 KST every day.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleNext = () => {
      const wait = msUntilNextKstTime(
        ADMIN_REFRESH_SCHEDULE.daily.hourKst,
        ADMIN_REFRESH_SCHEDULE.daily.minuteKst,
      );
      timer = setTimeout(() => {
        refreshSection("daily");
        scheduleNext();
      }, wait);
    };
    scheduleNext();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [refreshSection]);

  // Heatmap LIVE fill — every 30 minutes.
  useEffect(() => {
    const id = setInterval(
      () => refreshSection("liveFill"),
      ADMIN_REFRESH_SCHEDULE.liveFill.everyMs,
    );
    return () => clearInterval(id);
  }, [refreshSection]);

  // Web bottleneck / loading / landing — every 3 hours.
  useEffect(() => {
    const id = setInterval(
      () => refreshSection("webHealth"),
      ADMIN_REFRESH_SCHEDULE.webHealth.everyMs,
    );
    return () => clearInterval(id);
  }, [refreshSection]);

  const logout = useCallback(() => {
    startTransition(async () => {
      await fetch("/api/admin/logout", { method: "POST" });
      router.replace("/admin");
      router.refresh();
    });
  }, [router]);

  const {
    daily,
    traffic,
    webHealth,
    liveFill,
    schedule,
    categoryInfoRefresh,
    detailCollectApiCost,
  } = data;

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10 sm:px-6">
      <header className="border-b border-line pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">KinDex · Ops</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">운영 현황</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
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
          기준일 {formatKstDate(data.editionDate)} ({data.editionDate}) · 페이지 측정{" "}
          {formatKst(data.generatedAt)}
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

      <nav
        className="mt-6 flex flex-wrap gap-1.5 border-b border-line pb-3"
        role="tablist"
        aria-label="운영 현황 탭"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={
                isActive
                  ? "rounded-md border border-accent bg-accent px-2.5 py-1.5 text-sm font-semibold text-black"
                  : "rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm font-semibold text-ink hover:border-accent hover:text-accent"
              }
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div role="tabpanel">
        {activeTab === "traffic" ? (
          <Section
            title="방문자 현황"
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
        ) : null}

        {activeTab === "daily" ? (
          <Section
            title="일일 생성 · 비용"
            subtitle={`브리핑·히트맵 분석 성공/실패와 Gemini API 추정 비용(Batch 요금 기준, Live 대비 −50%). 보드 갱신 비용은 별도. · 자동 갱신 ${schedule.daily.label}`}
            meta={`기준일 ${formatKstDate(daily.dateLabel)} (${daily.dateLabel}) · 마지막 업데이트 ${formatKst(sectionUpdatedAt.daily)}`}
          >
            {!daily.hasData ? (
              <p className="rounded-lg border border-dashed border-line bg-panel px-4 py-6 text-sm text-muted">
                오늘자 ops digest가 아직 없습니다. CI 생성 잡이 커밋하면 여기에 쌓입니다.
              </p>
            ) : (
              <div className="space-y-5">
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
                    <dd className="mt-3 text-sm text-muted">
                      생성 API {daily.generationKrwLabel}
                      <span className="text-muted"> · Batch 요금</span>
                    </dd>
                  </dl>
                  <dl className="rounded-xl border border-line bg-panel px-4 py-4">
                    <dt className="text-xs text-muted">보드 갱신</dt>
                    <dd className="mt-2 text-2xl font-semibold tabular-nums text-ink">
                      {daily.boardsRefreshed}
                      <span className="ml-2 text-base font-normal text-muted">보드</span>
                    </dd>
                    <dd className="mt-3 text-sm text-muted">
                      갱신 API {daily.boardRefreshKrwLabel}
                      <span className="text-muted"> · Batch 요금</span>
                      {daily.boardRefreshFail > 0 ? ` · 실패 ${daily.boardRefreshFail}` : ""}
                    </dd>
                  </dl>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-ink">종류별</h3>
                  <p className="mt-1 text-xs text-muted">
                    투데이 브리핑 · 투데이 인사이트 · 오늘의 분석 성공 / 실패 / 글생성 API 비용 (Batch
                    요금 기준)
                  </p>
                  {daily.byArticleType.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">글 단위 내역이 아직 없습니다.</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto rounded-xl border border-line">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-board text-xs text-muted">
                          <tr>
                            <th className="px-3 py-2 font-medium">종류</th>
                            <th className="px-3 py-2 font-medium">성공</th>
                            <th className="px-3 py-2 font-medium">실패</th>
                            <th className="px-3 py-2 font-medium">스킵</th>
                            <th className="px-3 py-2 font-medium text-right">글생성 API 비용</th>
                          </tr>
                        </thead>
                        <tbody>
                          {daily.byArticleType.map((row) => (
                            <tr key={row.type} className="border-t border-line">
                              <td className="px-3 py-2.5 font-medium text-ink">{row.typeLabel}</td>
                              <td className="px-3 py-2.5 tabular-nums text-emerald-700">{row.ok}</td>
                              <td className="px-3 py-2.5 tabular-nums text-red-700">{row.fail}</td>
                              <td className="px-3 py-2.5 tabular-nums text-muted">{row.skip}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                                {row.estimatedKrwLabel}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t border-line bg-board/60 font-semibold">
                            <td className="px-3 py-2.5 text-ink">합계</td>
                            <td className="px-3 py-2.5 tabular-nums text-emerald-700">
                              {daily.byArticleType.reduce((acc, row) => acc + row.ok, 0)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-red-700">
                              {daily.byArticleType.reduce((acc, row) => acc + row.fail, 0)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-muted">
                              {daily.byArticleType.reduce((acc, row) => acc + row.skip, 0)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                              {daily.generationKrwLabel}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-ink">카테고리별</h3>
                  <p className="mt-1 text-xs text-muted">
                    채널별 성공 / 실패 / 글생성 API 비용 (Batch 요금 기준)
                  </p>
                  {daily.byCategory.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">글 단위 내역이 아직 없습니다.</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto rounded-xl border border-line">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-board text-xs text-muted">
                          <tr>
                            <th className="px-3 py-2 font-medium">카테고리</th>
                            <th className="px-3 py-2 font-medium">성공</th>
                            <th className="px-3 py-2 font-medium">실패</th>
                            <th className="px-3 py-2 font-medium">스킵</th>
                            <th className="px-3 py-2 font-medium text-right">글생성 API 비용</th>
                          </tr>
                        </thead>
                        <tbody>
                          {daily.byCategory.map((row) => (
                            <tr key={row.category} className="border-t border-line">
                              <td className="px-3 py-2.5 font-medium text-ink">{row.categoryLabel}</td>
                              <td className="px-3 py-2.5 tabular-nums text-emerald-700">{row.ok}</td>
                              <td className="px-3 py-2.5 tabular-nums text-red-700">{row.fail}</td>
                              <td className="px-3 py-2.5 tabular-nums text-muted">{row.skip}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                                {row.estimatedKrwLabel}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t border-line bg-board/60 font-semibold">
                            <td className="px-3 py-2.5 text-ink">합계</td>
                            <td className="px-3 py-2.5 tabular-nums text-emerald-700">
                              {daily.byCategory.reduce((acc, row) => acc + row.ok, 0)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-red-700">
                              {daily.byCategory.reduce((acc, row) => acc + row.fail, 0)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-muted">
                              {daily.byCategory.reduce((acc, row) => acc + row.skip, 0)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                              {daily.generationKrwLabel}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-ink">글별</h3>
                  <p className="mt-1 text-xs text-muted">
                    개별 글·키워드 성공 / 실패 / 글생성 API 비용 (Batch 요금 기준)
                  </p>
                  {daily.byItem.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">글 단위 내역이 아직 없습니다.</p>
                  ) : (
                    <div className="mt-2 max-h-[28rem] overflow-auto rounded-xl border border-line">
                      <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 bg-board text-xs text-muted">
                          <tr>
                            <th className="px-3 py-2 font-medium">글</th>
                            <th className="px-3 py-2 font-medium">카테고리</th>
                            <th className="px-3 py-2 font-medium">결과</th>
                            <th className="px-3 py-2 font-medium">구분</th>
                            <th className="px-3 py-2 font-medium text-right">글생성 API 비용</th>
                          </tr>
                        </thead>
                        <tbody>
                          {daily.byItem.map((row, index) => (
                            <tr
                              key={`${row.pipeline}:${row.category}:${row.name}:${index}`}
                              className="border-t border-line"
                            >
                              <td className="max-w-[16rem] truncate px-3 py-2.5 font-medium text-ink">
                                {row.name}
                              </td>
                              <td className="px-3 py-2.5 text-muted">{row.categoryLabel}</td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={
                                    row.status === "ok"
                                      ? "font-medium text-emerald-700"
                                      : row.status === "fail"
                                        ? "font-medium text-red-700"
                                        : "text-muted"
                                  }
                                >
                                  {row.status === "ok"
                                    ? "성공"
                                    : row.status === "fail"
                                      ? "실패"
                                      : "스킵"}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-muted">
                                {row.pipeline.includes("heatmap")
                                  ? "오늘의 분석"
                                  : row.kind === "main"
                                    ? "투데이 브리핑"
                                    : row.kind === "deep-dive" || row.pipeline.includes("briefing")
                                      ? "투데이 인사이트"
                                      : row.kind || "—"}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                                {row.estimatedKrwLabel}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Section>
        ) : null}

        {activeTab === "webHealth" ? (
          <Section
            title="웹 병목 · 로딩 · 랜딩"
            subtitle={`트렌드 스냅샷, 랜딩 캐시, published 보드 TTL. · 자동 갱신 ${schedule.webHealth.label}`}
            level={webHealth.level}
            meta={`마지막 업데이트 ${formatKst(sectionUpdatedAt.webHealth)}`}
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
        ) : null}

        {activeTab === "liveFill" ? (
          <Section
            title="히트맵 LIVE 채움"
            subtitle={`카테고리별 화면 헤드 LIVE 비율 (스냅샷·오버레이 기준). · 자동 갱신 ${schedule.liveFill.label}`}
            level={liveFill.level}
            meta={`마지막 업데이트 ${formatKst(sectionUpdatedAt.liveFill)}`}
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
        ) : null}

        {activeTab === "detailCollect" ? (
          <>
            <Section
              title="종목 상세 정보 갱신"
              subtitle="채널 구분별 권장 주기와 최근·다음 업데이트 시각(KST). 실제 조회 캐시도 이 주기에 맞춰 재검증합니다."
              meta={`정책 기준 ${formatKst(data.generatedAt)}`}
            >
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-board text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">구분</th>
                      <th className="px-3 py-2 font-medium">권장 주기</th>
                      <th className="px-3 py-2 font-medium">채널</th>
                      <th className="px-3 py-2 font-medium">최신 업데이트</th>
                      <th className="px-3 py-2 font-medium">다음 업데이트</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryInfoRefresh.map((row) => (
                      <tr key={row.id} className="border-t border-line align-top">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-ink">{row.label}</div>
                          <div className="mt-0.5 text-xs text-muted">{row.reason}</div>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-ink">{row.cadenceLabel}</td>
                        <td className="max-w-[14rem] px-3 py-2.5 text-xs text-muted">
                          {row.channelsLabel}
                        </td>
                        <td className="px-3 py-2.5 text-xs tabular-nums text-ink">
                          {formatKst(row.lastUpdatedAt)}
                        </td>
                        <td className="px-3 py-2.5 text-xs tabular-nums">
                          <span className={row.overdue ? "font-medium text-amber-800" : "text-ink"}>
                            {formatKst(row.nextUpdateAt)}
                          </span>
                          {row.overdue ? (
                            <span className="mt-0.5 block text-[11px] text-amber-700">갱신 지연</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section
              title="정보수집 API 비용 (오늘)"
              subtitle={`YouTube · OpenAI 추정 비용 (KST ${detailCollectApiCost.dayKst}).`}
              meta={`마지막 업데이트 ${formatKst(detailCollectApiCost.updatedAt)}`}
            >
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-board text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">API</th>
                      <th className="px-3 py-2 font-medium text-right">추정 비용</th>
                      <th className="px-3 py-2 font-medium">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-line align-top">
                      <td className="px-3 py-2.5 font-medium text-ink">YouTube API</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                        {detailCollectApiCost.youtube.estimatedKrwLabel}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted">
                        {detailCollectApiCost.youtube.note}
                      </td>
                    </tr>
                    <tr className="border-t border-line align-top">
                      <td className="px-3 py-2.5 font-medium text-ink">OpenAI API</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                        {detailCollectApiCost.openai.estimatedKrwLabel}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted">
                        {detailCollectApiCost.openai.note}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        ) : null}
      </div>
    </main>
  );
}
