"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { POST_CHANNELS } from "@/lib/posts/channels";

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

  return (
    <nav
      className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto text-[12px] sm:text-sm md:justify-center"
      aria-label="최상위 카테고리"
    >
      {POST_CHANNELS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.id}
            href={item.href}
            prefetch
            className={
              active
                ? "shrink-0 whitespace-nowrap rounded-md bg-panel px-2 py-1.5 font-medium text-ink md:px-3"
                : "shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 text-muted transition-colors hover:bg-panel hover:text-ink md:px-3"
            }
          >
            <CategoryLabel>{item.label}</CategoryLabel>
          </Link>
        );
      })}
    </nav>
  );
}
