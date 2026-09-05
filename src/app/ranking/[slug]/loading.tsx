export default function RankingLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 md:px-6">
      <div className="h-8 w-48 animate-pulse rounded bg-line/70" />
      <div className="h-40 animate-pulse rounded-2xl bg-line/50" />
      <div className="h-80 animate-pulse rounded-2xl bg-line/40" />
      <p className="text-sm text-muted">종목 상세를 불러오는 중…</p>
    </div>
  );
}
