import type { ReactNode } from "react";
import { CategoryDeskHeader } from "@/components/layout/CategoryDeskHeader";
import { ContentSlot } from "@/components/monetization/ContentSlot";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Category chrome: desk header + page body.
 * Section tabs live in the root layout (mobile + desktop) so every screen
 * shares the same sticky slot.
 */
export function CategoryChrome({
  channel,
  children,
}: {
  channel: PostChannel;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      {/*
        Mobile: ticker (children order-1) → header (order-2) → desk (order-3).
        Section tabs are site-wide above <main>; only the board H1 stays here.
      */}
      <div className="order-2 space-y-2 md:order-0">
        <CategoryDeskHeader channel={channel} />
      </div>
      {children}
      <div className="order-3 md:order-3">
        <ContentSlot placement="footer" adFormat="auto" />
      </div>
    </div>
  );
}
