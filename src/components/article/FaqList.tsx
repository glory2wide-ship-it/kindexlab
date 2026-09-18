import type { PostFaq } from "@/lib/posts/types";

/**
 * FAQ rendered as native `<details>` cards.
 *
 * Using the built-in disclosure element keeps this a server component with no
 * hydration cost, which matters on a page whose whole point is to load fast.
 * Answers stay in the DOM while collapsed, so the FAQPage structured data and
 * the visible text still agree.
 *
 * Today's analysis passes `defaultOpen` so Q/A pairs start expanded.
 */
export function FaqList({
  items,
  defaultOpen = false,
  analysisSizing = false,
}: {
  items: PostFaq[];
  /** When true, every answer is visible without a click (오늘의 분석). */
  defaultOpen?: boolean;
  /**
   * 오늘의 분석 FAQ only (not magazine / briefing):
   * Q +15% then +10% vs text-sm; A −5% then −3% vs article body, darker ink.
   */
  analysisSizing?: boolean;
}) {
  if (!items?.length) return null;

  // Cumulative vs shared baseline: Q 1.15×1.10, A 0.95×0.97.
  const questionStyle = analysisSizing
    ? ({ fontSize: "calc(0.875rem * 1.265)" } as const)
    : undefined;
  const answerStyle = analysisSizing
    ? ({ fontSize: "calc(var(--article-font-size) * 0.9215)" } as const)
    : undefined;
  const answerColorClass = analysisSizing ? "text-ink/85" : "text-muted";

  return (
    <div className="not-prose space-y-3">
      {items.map((item) => (
        <details
          key={item.question}
          open={defaultOpen || undefined}
          className="group overflow-hidden rounded-xl border border-line bg-board/30 transition-colors open:bg-panel open:shadow-sm hover:border-accent/40"
        >
          <summary
            className="flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 text-sm font-semibold leading-6 text-ink [&::-webkit-details-marker]:hidden"
            style={questionStyle}
          >
            <span className="mt-px font-sans text-xs font-bold text-accent">Q</span>
            <span className="flex-1">{item.question}</span>
            {defaultOpen ? null : (
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="mt-1 h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 7.5 10 12.5 15 7.5" />
              </svg>
            )}
          </summary>
          <div className="flex gap-3 border-t border-line px-4 py-3.5">
            <span className="mt-px font-sans text-xs font-bold text-muted">A</span>
            <p
              className={`article-prose-text flex-1 whitespace-pre-line ${answerColorClass}`}
              style={answerStyle}
            >
              {item.answer}
            </p>
          </div>
        </details>
      ))}
    </div>
  );
}
