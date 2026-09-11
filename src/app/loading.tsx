import { TREEMAP_FRAME_CLASS } from "@/components/dashboard/treemap-config";

/**
 * Route-level pending UI for soft navigations to `/`.
 * Matches the landing heatmap + desk skeletons so ISR misses do not flash blank.
 */
export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <div className="h-16 animate-pulse rounded-xl border border-line/60 bg-panel" aria-hidden />
        <div
          className={`${TREEMAP_FRAME_CLASS} animate-pulse rounded-xl border border-line/60 bg-panel`}
          aria-hidden
        />
        <div className="grid animate-pulse gap-4 md:grid-cols-2 xl:grid-cols-5" aria-hidden>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-40 rounded-xl border border-line/60 bg-panel" />
          ))}
        </div>
      </div>
      <div className="h-36 animate-pulse rounded-xl border border-line/60 bg-panel" aria-hidden />
    </div>
  );
}
