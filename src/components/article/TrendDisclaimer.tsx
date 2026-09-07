import { TREND_ANALYSIS_DISCLAIMER } from "@/lib/editorial/disclaimer";

/** Bottom-of-article disclaimer shared by briefings and 오늘의 분석. */
export function TrendDisclaimer({ className }: { className?: string } = {}) {
  return (
    <p
      className={
        className ??
        "mt-8 max-w-3xl border-t border-line pt-4 text-sm leading-6 text-muted"
      }
      data-disclaimer="trend-analysis"
    >
      {TREND_ANALYSIS_DISCLAIMER}
    </p>
  );
}
