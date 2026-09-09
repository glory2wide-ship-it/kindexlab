import { TREEMAP_FRAME_CLASS } from "@/components/dashboard/treemap-config";

/**
 * Placeholder for the heatmap while its chunk downloads.
 *
 * Height/aspect matches `TreemapView` at both breakpoints; a shorter stand-in
 * would hand back layout shift on arrival, which is the metric this split is
 * meant to protect. The tile shapes mirror the real layout — one large rank-1
 * block on the left, a grid of followers on the right.
 */
export function TreemapSkeleton() {
  return (
    <div className={TREEMAP_FRAME_CLASS} role="status" aria-label="히트맵을 불러오는 중">
      <div className="flex h-full w-full gap-0.5 p-0.5">
        <div className="h-full w-[8%] animate-pulse rounded-sm bg-board/60" />
        <div className="grid h-full flex-1 grid-cols-4 grid-rows-5 gap-0.5">
          {Array.from({ length: 16 }, (_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-sm bg-board/60"
              style={{ animationDelay: `${index * 45}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
