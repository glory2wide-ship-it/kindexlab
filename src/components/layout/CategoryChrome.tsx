import type { ReactNode } from "react";
import { AdSlot } from "@/components/ads/AdSlot";
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
      <CategorySubNav channel={channel} />
      {children}
      <AdSlot format="auto" />
    </div>
  );
}
