import type { ReactNode } from "react";

/**
 * Subhead for a generated column.
 *
 * The two column surfaces sit at different depths — one is embedded under the
 * page's H1, the other owns it — so the tag is passed in rather than derived,
 * keeping the outline valid while the styling stays identical. Major heads get
 * an accent rail and a rule so a reader scrolling a long, image-free body can
 * find the section breaks at a glance.
 */
export function SectionHeading({
  as: Tag,
  tone = "major",
  children,
}: {
  as: "h2" | "h3" | "h4";
  tone?: "major" | "minor";
  children: ReactNode;
}) {
  if (tone === "minor") {
    return (
      <Tag className="mb-3 mt-7 text-base font-semibold leading-7 tracking-tight text-ink">
        <span className="border-b-2 border-accent/30 pb-0.5">{children}</span>
      </Tag>
    );
  }

  return (
    <Tag className="mb-4 mt-9 border-b border-line pb-2 text-lg font-semibold leading-8 tracking-tight text-ink md:text-xl">
      <span className="mr-2.5 inline-block h-[1.05em] w-1 translate-y-[0.15em] rounded-full bg-accent align-top" />
      {children}
    </Tag>
  );
}
