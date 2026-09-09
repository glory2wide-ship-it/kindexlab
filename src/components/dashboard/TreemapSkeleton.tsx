import { TREEMAP_FRAME_CLASS } from "@/components/dashboard/treemap-config";

/**
 * Placeholder for the heatmap while its chunk downloads.
 *
 * Mirrors the live layout: near-square rank-1 top-left, rank-2 directly under
 * it, remaining tiles in the right/bottom L-region.
 */
export function TreemapSkeleton() {
  return (
    <div className={TREEMAP_FRAME_CLASS} role="status" aria-label="히트맵을 불러오는 중">
      <div className="flex h-full w-full gap-0.5 p-0.5">
        <div className="flex h-full w-[37%] shrink-0 flex-col gap-0.5">
          <div className="aspect-square w-full animate-pulse rounded-sm bg-board/60" />
          <div className="min-h-0 flex-1 animate-pulse rounded-sm bg-board/60" />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5">
          <div className="grid min-h-0 flex-[3] grid-cols-3 grid-rows-2 gap-0.5">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={`right-${index}`}
                className="animate-pulse rounded-sm bg-board/60"
                style={{ animationDelay: `${index * 45}ms` }}
              />
            ))}
          </div>
          <div className="grid min-h-0 flex-[2] grid-cols-4 gap-0.5">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={`bot-${index}`}
                className="animate-pulse rounded-sm bg-board/60"
                style={{ animationDelay: `${(index + 6) * 45}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
