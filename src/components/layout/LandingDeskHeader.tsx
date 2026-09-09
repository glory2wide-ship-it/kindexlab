import {
  SITE_INDEX_HEADLINE_DESKTOP,
  SITE_LANDING_HEADLINE_DESKTOP,
} from "@/lib/site";

/**
 * Landing hero headcopy — shown on mobile and desktop above the ticker.
 * Category chips live in GlobalStickyMobileCategoryBar (root layout).
 */
export function LandingDeskHeader() {
  return (
    <header className="space-y-1.5 font-gothic md:space-y-2">
      <h1 className="text-[21px] font-semibold leading-snug tracking-tight md:text-3xl">
        {SITE_INDEX_HEADLINE_DESKTOP}
      </h1>
      <p className="max-w-3xl text-[14px] leading-6 text-muted md:text-[16.8px] md:leading-[28.8px]">
        {SITE_LANDING_HEADLINE_DESKTOP}
      </p>
    </header>
  );
}
