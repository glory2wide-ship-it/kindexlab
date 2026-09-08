import { MobileCategoryBar } from "@/components/layout/MobileCategoryBar";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Mobile-only sticky strip under SiteHeader so 전체/엔터/… chips stay visible
 * while the page scrolls. Desktop hides this — category nav stays in HeaderNav.
 */
export function StickyMobileCategoryBar({ activeId }: { activeId?: PostChannel }) {
  return (
    <div
      className="sticky top-14 z-30 -mx-4 border-b border-line bg-board/95 px-4 py-2 backdrop-blur-md md:hidden"
      data-sticky-mobile-categories
    >
      <MobileCategoryBar activeId={activeId} />
    </div>
  );
}
