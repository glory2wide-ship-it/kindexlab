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
    <div className="space-y-4">
      {/* Sync H1 — streams with the layout before desk Suspense resolves. */}
      <CategoryDeskHeader channel={channel} />
      <CategorySubNav channel={channel} />
      {children}
      <ContentSlot placement="footer" adFormat="auto" />
    </div>
  );
}
