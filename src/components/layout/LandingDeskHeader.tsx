import { SITE_INDEX_HEADLINE, SITE_LANDING_HEADLINE } from "@/lib/site";

/**
 * Landing hero — desktop keeps headline copy.
 * Mobile category chips live in StickyMobileCategoryBar (page-level sticky).
 */
export function LandingDeskHeader() {
  return (
    <>
      <h1 className="sr-only md:hidden">{SITE_INDEX_HEADLINE}</h1>
      <header className="space-y-2 font-gothic max-md:hidden">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{SITE_INDEX_HEADLINE}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">{SITE_LANDING_HEADLINE}</p>
      </header>
    </>
  );
}
