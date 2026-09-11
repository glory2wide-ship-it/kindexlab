import { TREEMAP_FRAME_CLASS } from "@/components/dashboard/treemap-config";

/** Soft-nav pending UI for `/{category}` channel desks. */
export default function CategoryLoading() {
  return (
    <div className="space-y-6">
      <div className="h-14 animate-pulse rounded-xl border border-line/60 bg-panel" aria-hidden />
      <div
        className={`${TREEMAP_FRAME_CLASS} animate-pulse rounded-xl border border-line/60 bg-panel`}
        aria-hidden
      />
      <div className="grid animate-pulse gap-3 md:grid-cols-3" aria-hidden>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 rounded-xl border border-line/60 bg-panel" />
        ))}
      </div>
    </div>
  );
}
