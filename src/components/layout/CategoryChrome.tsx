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
    <div className="flex flex-col gap-4">
      {/* Mobile: ticker (from children) sits above this via flex order. */}
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
