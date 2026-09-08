import Link from "next/link";
import { HeaderNav } from "@/components/layout/HeaderNav";
import { HeaderRightCluster } from "@/components/layout/HeaderRightCluster";
import { RouteProgress } from "@/components/layout/RouteProgress";
import { SITE } from "@/lib/site";

export function SiteHeader() {
  return (
    <>
      <RouteProgress />
      <header className="sticky top-0 z-40 overflow-visible border-b border-line bg-board/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 overflow-visible px-4 md:justify-between md:gap-3">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2 md:gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-accent font-sans text-[11px] font-bold tracking-tight text-black">
              KD
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-gothic text-sm font-semibold tracking-tight">
                <span className="md:hidden">{SITE.name}</span>
                <span className="hidden text-[22.46px] leading-tight md:inline">
                  {SITE.nameKo} <span className="font-normal text-muted">/</span> {SITE.name}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-normal leading-none tracking-tight text-muted md:hidden">
                실시간 관심이슈 랭킹
              </span>
            </span>
          </Link>

          {/* Desktop channel nav — unchanged placement */}
          <HeaderNav />

          {/* Mobile: LIVE + theme + search (far right) · Desktop: full right cluster */}
          <div className="ml-auto flex min-w-0 items-center gap-1.5 md:contents">
            <HeaderRightCluster />
          </div>
        </div>
      </header>
    </>
  );
}
