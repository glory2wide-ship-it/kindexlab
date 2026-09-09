import { TREEMAP_FRAME_CLASS } from "@/components/dashboard/treemap-config";

/**
 * Placeholder for the heatmap while its chunk downloads.
 * Rough Finviz-style squarified blocks (large leader + stepping neighbors).
 */
export function TreemapSkeleton() {
  return (
    <div className={TREEMAP_FRAME_CLASS} role="status" aria-label="히트맵을 불러오는 중">
      <div className="flex h-full w-full flex-col gap-0.5 p-0.5">
        <div className="flex min-h-0 flex-[3] gap-0.5">
          <div className="min-h-0 w-[42%] animate-pulse rounded-sm bg-board/60" />
          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-2 grid-rows-2 gap-0.5">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={`top-${index}`}
                className="animate-pulse rounded-sm bg-board/60"
                style={{ animationDelay: `${index * 40}ms` }}
              />
            ))}
          </div>
        </div>
        <div className="grid min-h-0 flex-[2] grid-cols-5 gap-0.5">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={`bot-${index}`}
              className="animate-pulse rounded-sm bg-board/60"
              style={{ animationDelay: `${(index + 4) * 40}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
