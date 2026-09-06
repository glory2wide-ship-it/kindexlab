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
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 overflow-visible px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-accent font-sans text-[11px] font-bold tracking-tight text-black">
              KL
            </span>
            <span className="leading-tight">
              <span className="block font-gothic text-sm font-semibold tracking-tight sm:text-base">
                {SITE.nameKo} <span className="font-normal text-muted">/</span> {SITE.name}
              </span>
            </span>
          </Link>
          <HeaderNav />
          <HeaderRightCluster />
        </div>
      </header>
    </>
  );
}
