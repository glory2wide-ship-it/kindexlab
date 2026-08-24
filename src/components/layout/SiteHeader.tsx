import Link from "next/link";
import { KstClock } from "@/components/layout/KstClock";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { SITE } from "@/lib/site";

const nav = [
  { href: "/", label: "시세판" },
  { href: "/briefing", label: "일일 브리핑" },
  { href: "/briefing/archive", label: "아카이브" },
  { href: "/about", label: "소개" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-board/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-accent font-mono text-xs font-bold text-black">
            EB
          </span>
          <span className="leading-tight">
            <span className="block font-semibold tracking-tight">{SITE.name}</span>
            <span className="block text-[11px] text-muted">{SITE.tagline}</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-muted transition-colors hover:bg-panel hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <KstClock />
          <span className="hidden items-center gap-1.5 rounded-full border border-up/30 bg-up/10 px-2.5 py-1 font-mono text-[11px] text-up sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" />
            LIVE
          </span>
          <ThemeToggle />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 text-sm md:hidden">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-md px-3 py-1 text-muted hover:bg-panel hover:text-ink"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
