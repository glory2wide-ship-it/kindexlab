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
      {/* Headcopy → ticker/desk body → footer */}
      <div className="order-1 space-y-2">
        <CategoryDeskHeader channel={channel} />
      </div>
      {children}
      <div className="order-3">
        <ContentSlot placement="footer" adFormat="auto" />
      </div>
    </div>
  );
}
