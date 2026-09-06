export default function CategoryLoading() {
  return (
    <div className="space-y-6" aria-busy aria-label="카테고리 페이지 불러오는 중">
      <div className="h-8 w-56 animate-pulse rounded bg-line/70" />
      <div className="h-[28rem] animate-pulse rounded-2xl bg-line/50" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-line/40" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-line/40" />
    </div>
  );
}
