import { HEAT_LEGEND_STOPS } from "@/lib/heatmap";

export function HeatmapLegend({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 flex-col items-end gap-1 font-sans ${className}`}
      aria-label="등락 색상 범례"
    >
      <div className="flex overflow-hidden rounded-[2px] border border-line">
        {HEAT_LEGEND_STOPS.map((stop) => (
          <div key={stop.label} className="flex w-8 flex-col items-center sm:w-9">
            <span className="h-3 w-full" style={{ background: stop.color }} />
            <span className="bg-panel px-0.5 py-0.5 text-[8px] font-semibold tabular-nums text-muted">
              {stop.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
