import Link from "next/link";
import { CHANNEL_SHORT_LABEL, POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Five desk chips in one horizontal row. Mobile-only — desktop keeps HeaderNav.
 */
export function MobileCategoryBar({
  activeId,
  className = "",
}: {
  activeId?: PostChannel;
  className?: string;
}) {
  return (
    <nav
      className={`flex gap-1 md:hidden ${className}`}
      aria-label="카테고리"
    >
      {POST_CHANNELS.map((item) => {
        const active = activeId === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            prefetch={false}
            className={`inline-flex min-h-9 min-w-0 flex-1 items-center justify-center rounded-md border px-1 text-center text-[12px] font-medium leading-tight ${
              active
                ? "border-accent bg-accent text-black"
                : "border-line bg-panel text-ink hover:border-accent hover:text-accent"
            }`}
          >
            {CHANNEL_SHORT_LABEL[item.id] ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}
