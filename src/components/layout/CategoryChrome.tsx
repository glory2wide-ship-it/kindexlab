import type { ReactNode } from "react";
import { CategoryDeskHeader } from "@/components/layout/CategoryDeskHeader";
import { CategorySubNav } from "@/components/layout/CategorySubNav";
import { ContentSlot } from "@/components/monetization/ContentSlot";
import type { PostChannel } from "@/lib/posts/types";

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
        Mobile order: ticker (from children, order-1) → subnav/header (2) → desk (3).
        Desktop: board H1 (ranking only) → sticky section tabs (same place on every
        section page) → page body. Sticky tabs are desktop-only inside CategorySubNav.
        Children must be fragments/Suspense — not a single order:0 wrapper.
      */}
      <div className="order-2 space-y-2 md:order-1">
        <CategoryDeskHeader channel={channel} />
      </div>
      <div className="order-2 md:order-1">
        <CategorySubNav channel={channel} />
      </div>
      {children}
      <div className="order-3 md:order-3">
        <ContentSlot placement="footer" adFormat="auto" />
      </div>
    </div>
  );
}
