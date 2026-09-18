import {
  SITE_INDEX_HEADLINE_DESKTOP,
  SITE_LANDING_SUBCOPY_LINE1,
  SITE_LANDING_SUBCOPY_LINE2,
} from "@/lib/site";

/**
 * Landing hero headcopy — shown on mobile and desktop above the ticker.
 * Category chips live in GlobalStickyMobileCategoryBar (root layout).
 * Mobile H1 stays on one line via fluid type + nowrap.
 * Mobile subcopy is two fixed lines; desktop keeps a single flowing paragraph.
 */
export function LandingDeskHeader() {
  return (
    <header className="space-y-1.5 font-gothic md:space-y-[6.12px]">
      <h1 className="whitespace-nowrap text-[clamp(16.38px,4.788vw,22.68px)] font-semibold leading-[0.8] tracking-tighter md:whitespace-normal md:text-3xl md:leading-[1.2375] md:tracking-tight">
        {SITE_INDEX_HEADLINE_DESKTOP}
      </h1>
      <p className="max-w-3xl text-[11.97px] leading-[18.24px] text-soft md:text-[16.8px] md:leading-[25.92px]">
        <span className="block md:inline">{SITE_LANDING_SUBCOPY_LINE1}</span>
        <span className="hidden md:inline"> </span>
        <span className="block md:inline">{SITE_LANDING_SUBCOPY_LINE2}</span>
      </p>
    </header>
  );
}
