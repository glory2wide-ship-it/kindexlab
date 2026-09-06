export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
      <div className="h-10 w-64 animate-pulse rounded bg-line/70" />
      <div className="h-72 animate-pulse rounded-2xl bg-line/50" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-xl bg-line/40" />
        ))}
      </div>
      <p className="text-sm text-muted">히트맵을 불러오는 중…</p>
    </div>
  );
}
