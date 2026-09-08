import { CategorySubNav } from "@/components/layout/CategorySubNav";
import { getPostChannel } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Category board hero.
 * Mobile: submenu only (chips are in GlobalStickyMobileCategoryBar).
 * Desktop: title + description (submenu stays in CategorySubNav sticky bar).
 */
export function CategoryDeskHeader({ channel }: { channel: PostChannel }) {
  const meta = getPostChannel(channel);
  const desktopTitle = meta.indexTitleDesktop ?? meta.indexTitle;
  const desktopDescription = meta.descriptionDesktop ?? meta.description;

  return (
    <header className="space-y-2 font-gothic">
      <h1 className="sr-only md:hidden">{meta.indexTitle}</h1>
      <h1 className="hidden text-2xl font-semibold tracking-tight md:block md:text-3xl">
        {desktopTitle}
      </h1>
      <p
        className={
          channel === "entertainment"
            ? "hidden max-w-3xl text-[16.8px] leading-[28.8px] text-muted md:block"
            : "hidden max-w-3xl text-sm leading-6 text-muted md:block"
        }
      >
        {desktopDescription}
      </p>
      <div className="md:hidden">
        <CategorySubNav channel={channel} embedded />
      </div>
    </header>
  );
}
