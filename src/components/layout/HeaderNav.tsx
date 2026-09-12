"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useActiveChannelOverride } from "@/components/providers/ActiveChannelProvider";
import { POST_CHANNELS } from "@/lib/posts/channels";
import { resolveChannelFromPath } from "@/lib/posts/resolve-channel-from-path";

function CategoryLabel({ children }: { children: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className={pending ? "opacity-60" : undefined} aria-busy={pending || undefined}>
      {children}
      {pending ? <span className="sr-only"> 이동 중</span> : null}
    </span>
  );
}

export function HeaderNav() {
  const pathname = usePathname();
  const router = useRouter();
  const override = useActiveChannelOverride();
  // Ranking/board detail routes encode the desk in the slug; prefer that over a
  // blank override so /ranking/travel-… does not flash another category.
  const activeChannel = override ?? resolveChannelFromPath(pathname || "/");
  const allActive = !activeChannel && pathname === "/";

  return (
    <nav
      className="hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto text-[15.4px] md:flex"
      aria-label="최상위 카테고리"
    >
      <Link
        href="/"
        prefetch={false}
        onPointerEnter={() => {
          if (!allActive) router.prefetch("/");
        }}
        className={
          allActive
            ? "shrink-0 whitespace-nowrap rounded-md bg-panel px-2 py-1.5 font-medium text-ink md:px-3"
            : "shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 font-semibold text-soft transition-colors hover:bg-panel hover:text-ink md:px-3"
        }
      >
        <CategoryLabel>전체</CategoryLabel>
      </Link>
      {POST_CHANNELS.map((item) => {
        const active = activeChannel
          ? activeChannel === item.id
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.id}
            href={item.href}
            prefetch={false}
            onPointerEnter={() => {
              if (!active) router.prefetch(item.href);
            }}
            className={
              active
                ? "shrink-0 whitespace-nowrap rounded-md bg-panel px-2 py-1.5 font-medium text-ink md:px-3"
                : "shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 font-semibold text-soft transition-colors hover:bg-panel hover:text-ink md:px-3"
            }
          >
            <CategoryLabel>{item.label}</CategoryLabel>
          </Link>
        );
      })}
    </nav>
  );
}
