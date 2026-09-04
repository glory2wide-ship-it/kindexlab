import type { PostFaq } from "@/lib/posts/types";

/**
 * FAQ rendered as native `<details>` cards.
 *
 * Using the built-in disclosure element keeps this a server component with no
 * hydration cost, which matters on a page whose whole point is to load fast.
 * Answers stay in the DOM while collapsed, so the FAQPage structured data and
 * the visible text still agree.
 */
export function FaqList({ items }: { items: PostFaq[] }) {
  if (!items?.length) return null;

  return (
    <div className="not-prose space-y-3">
      {items.map((item) => (
        <details
          key={item.question}
          className="group overflow-hidden rounded-xl border border-line bg-board/30 transition-colors open:bg-panel open:shadow-sm hover:border-accent/40"
        >
          <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 text-sm font-semibold leading-6 text-ink [&::-webkit-details-marker]:hidden">
            <span className="mt-px font-sans text-xs font-bold text-accent">Q</span>
            <span className="flex-1">{item.question}</span>
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
          </summary>
          <div className="flex gap-3 border-t border-line px-4 py-3.5">
            <span className="mt-px font-sans text-xs font-bold text-muted">A</span>
            <p className="article-prose-text flex-1 whitespace-pre-line text-muted">{item.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
