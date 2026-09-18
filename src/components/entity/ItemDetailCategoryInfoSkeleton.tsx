/** Skeleton for ItemDetailCategoryInfo while the progressive enrich resolves. */
export function ItemDetailCategoryInfoSkeleton() {
  return (
    <section
      className="animate-pulse rounded-2xl border border-line bg-panel p-[18px] md:p-8"
      aria-hidden
      aria-label="종목 채널 정보 불러오는 중"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-board" />
          <div className="h-6 w-48 rounded bg-board md:w-64" />
        </div>
        <div className="h-6 w-16 rounded-md bg-board" />
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-line">
        <div className="h-8 bg-board/80" />
        <div className="space-y-0 border-t border-line">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="flex gap-3 border-t border-line px-3 py-3 first:border-t-0"
            >
              <div className="h-4 w-20 rounded bg-board" />
              <div className="h-4 flex-1 rounded bg-board/70" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 space-y-2 border-t border-line pt-4">
        <div className="h-3 w-32 rounded bg-board" />
        <div className="h-4 w-full rounded bg-board/70" />
        <div className="h-4 w-11/12 rounded bg-board/70" />
        <div className="h-4 w-3/4 rounded bg-board/70" />
      </div>
    </section>
  );
}
