"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KstClock } from "@/components/layout/KstClock";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { POST_CHANNELS } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-board/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-accent font-sans text-[11px] font-bold tracking-tight text-black">
            KL
          </span>
          <span className="leading-tight">
            <span className="block font-semibold tracking-tight">{SITE.name}</span>
            <span className="block text-[11px] text-muted">{SITE.tagline}</span>
          </span>
        </Link>
        <nav
          className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto text-sm md:justify-center"
          aria-label="최상위 카테고리"
        >
          {POST_CHANNELS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={
                  active
                    ? "shrink-0 rounded-md bg-panel px-3 py-1.5 font-medium text-ink"
                    : "shrink-0 rounded-md px-3 py-1.5 text-muted transition-colors hover:bg-panel hover:text-ink"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <KstClock />
          <span className="hidden items-center gap-1.5 rounded-full border border-up/30 bg-up/10 px-2.5 py-1 font-sans text-[11px] font-semibold tracking-tight text-up sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" />
            LIVE
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
