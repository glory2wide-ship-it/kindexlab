import type { ReactNode } from "react";
import { AdSlot } from "@/components/ads/AdSlot";
import { CategoryDeskHeader } from "@/components/layout/CategoryDeskHeader";
import { CategorySubNav } from "@/components/layout/CategorySubNav";
import type { PostChannel } from "@/lib/posts/types";

export function CategoryChrome({
  channel,
  children,
}: {
  channel: PostChannel;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <CategoryDeskHeader channel={channel} />
      <CategorySubNav channel={channel} />
      {children}
      <AdSlot format="auto" />
    </div>
  );
}
