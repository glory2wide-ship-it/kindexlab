import type { ReactNode } from "react";

/**
 * Subhead for a generated column.
 *
 * The two column surfaces sit at different depths — one is embedded under the
 * page's H1, the other owns it — so the tag is passed in rather than derived,
 * keeping the outline valid while the styling stays identical. All section
 * subheads (❶❷❸❹…) share one type size so odd/even levels don't look uneven.
 */
export function SectionHeading({
  as: Tag,
  children,
}: {
  as: "h2" | "h3" | "h4";
  /** Kept for call-site compatibility; visual weight is unified. */
  tone?: "major" | "minor";
  children: ReactNode;
}) {
  return (
    <Tag className="mb-4 mt-9 border-b border-line pb-2 text-[18.9px] font-semibold leading-8 tracking-tight text-ink md:text-[21px]">
      <span className="mr-2.5 inline-block h-[1.05em] w-1 translate-y-[0.15em] rounded-full bg-accent align-top" />
      {children}
    </Tag>
  );
}
