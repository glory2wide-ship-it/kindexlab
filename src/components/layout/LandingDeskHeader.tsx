import { SITE_INDEX_HEADLINE, SITE_LANDING_HEADLINE } from "@/lib/site";

/** Landing hero — headline and head copy above the unified heatmap. */
export function LandingDeskHeader() {
  return (
    <header className="space-y-2 font-gothic">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{SITE_INDEX_HEADLINE}</h1>
      <p className="max-w-2xl text-sm leading-6 text-muted">{SITE_LANDING_HEADLINE}</p>
    </header>
  );
}
