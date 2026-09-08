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
        Mobile: ticker (children order-1) → header/subnav (order-2) → desk (order-3).
        Desktop: header + sticky section tabs must stay above page bodies.
        Board children use md:order-2/3; briefing/archive/about default to order-0,
        so chrome uses md:order-0 (not order-1) or those pages paint first and hide the tabs.
      */}
      <div className="order-2 space-y-2 md:order-0">
        <CategoryDeskHeader channel={channel} />
      </div>
      <div className="order-2 md:order-0">
        <CategorySubNav channel={channel} />
      </div>
      {children}
      <div className="order-3 md:order-3">
        <ContentSlot placement="footer" adFormat="auto" />
      </div>
    </div>
  );
}
