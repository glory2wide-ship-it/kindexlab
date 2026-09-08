import {
  SITE_INDEX_HEADLINE,
  SITE_INDEX_HEADLINE_DESKTOP,
  SITE_LANDING_HEADLINE_DESKTOP,
} from "@/lib/site";

/**
 * Landing hero — desktop keeps headline copy.
 * Mobile category chips live in GlobalStickyMobileCategoryBar (root layout).
 * Visible H1/subcopy below are desktop-only (`max-md:hidden`).
 */
export function LandingDeskHeader() {
  return (
    <>
      <h1 className="sr-only md:hidden">{SITE_INDEX_HEADLINE}</h1>
      <header className="space-y-2 font-gothic max-md:hidden">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {SITE_INDEX_HEADLINE_DESKTOP}
        </h1>
        <p className="max-w-3xl text-[16.8px] leading-[28.8px] text-muted">
          {SITE_LANDING_HEADLINE_DESKTOP}
        </p>
      </header>
    </>
  );
}
