import { TREEMAP_FRAME_CLASS } from "@/components/dashboard/treemap-config";

/**
 * Placeholder for the heatmap while its chunk downloads.
 *
 * Height/aspect matches `TreemapView` at both breakpoints; a shorter stand-in
 * would hand back layout shift on arrival, which is the metric this split is
 * meant to protect. Mirrors the near-square rank-1 + L-shaped remainder layout.
 */
export function TreemapSkeleton() {
  return (
    <div className={TREEMAP_FRAME_CLASS} role="status" aria-label="히트맵을 불러오는 중">
      <div className="flex h-full w-full flex-col gap-0.5 p-0.5">
        <div className="flex h-[37%] min-h-0 gap-0.5">
          <div className="aspect-square h-full max-w-[37%] shrink-0 animate-pulse rounded-sm bg-board/60" />
          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-3 gap-0.5">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={`top-${index}`}
                className="animate-pulse rounded-sm bg-board/60"
                style={{ animationDelay: `${index * 45}ms` }}
              />
            ))}
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-3 gap-0.5">
          {Array.from({ length: 12 }, (_, index) => (
            <div
              key={`bot-${index}`}
              className="animate-pulse rounded-sm bg-board/60"
              style={{ animationDelay: `${(index + 3) * 45}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
