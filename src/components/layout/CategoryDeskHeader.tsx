import { CategorySubNav } from "@/components/layout/CategorySubNav";
import { MobileCategoryBar } from "@/components/layout/MobileCategoryBar";
import { getPostChannel } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Category board hero.
 * Mobile: category bar (with search) first, then submenu — no H1 title.
 * Desktop: title + description (submenu stays in CategorySubNav sticky bar).
 */
export function CategoryDeskHeader({ channel }: { channel: PostChannel }) {
  const meta = getPostChannel(channel);

  return (
    <header className="space-y-2 font-gothic">
      <h1 className="max-md:sr-only text-2xl font-semibold tracking-tight md:text-3xl">
        {meta.indexTitle}
      </h1>
      <p className="hidden max-w-2xl text-sm leading-6 text-muted md:block">{meta.description}</p>
      <MobileCategoryBar activeId={channel} />
      <div className="md:hidden">
        <CategorySubNav channel={channel} embedded />
      </div>
    </header>
  );
}
