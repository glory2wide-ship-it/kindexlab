import { MobileCategoryBar } from "@/components/layout/MobileCategoryBar";
import { SITE_INDEX_HEADLINE, SITE_LANDING_HEADLINE } from "@/lib/site";

/** Landing hero — desktop keeps headline copy; mobile shows 5 category chips in one row. */
export function LandingDeskHeader() {
  return (
    <header className="space-y-2 font-gothic">
      <h1 className="max-md:sr-only text-2xl font-semibold tracking-tight md:text-3xl">
        {SITE_INDEX_HEADLINE}
      </h1>
      <p className="hidden max-w-2xl text-sm leading-6 text-muted md:block">{SITE_LANDING_HEADLINE}</p>
      <MobileCategoryBar />
    </header>
  );
}
