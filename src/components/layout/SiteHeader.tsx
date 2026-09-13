import { HeaderNav } from "@/components/layout/HeaderNav";
import { HeaderRightCluster } from "@/components/layout/HeaderRightCluster";
import { RouteProgress } from "@/components/layout/RouteProgress";
import { SiteBrandLink } from "@/components/layout/SiteBrand";

export function SiteHeader() {
  return (
    <>
      <RouteProgress />
      <header className="sticky top-0 z-40 overflow-visible border-b border-line bg-board/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[72rem] items-center gap-2 overflow-visible px-4 md:gap-3">
          <SiteBrandLink />

          {/* Desktop channel nav — left-aligned so 전체 lines up with section tabs */}
          <HeaderNav />

          {/* Mobile: LIVE + theme · Desktop: LIVE + theme (search on section tabs) */}
          <div className="ml-auto flex min-w-0 items-center gap-1.5 md:contents">
            <HeaderRightCluster />
          </div>
        </div>
      </header>
    </>
  );
}
