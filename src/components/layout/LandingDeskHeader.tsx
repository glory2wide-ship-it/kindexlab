import Link from "next/link";
import { POST_CHANNELS } from "@/lib/posts/channels";
import { SITE_INDEX_HEADLINE, SITE_LANDING_HEADLINE } from "@/lib/site";

/** Landing hero — desktop keeps headline copy; mobile shows 5 category chips instead. */
export function LandingDeskHeader() {
  return (
    <header className="space-y-2 font-gothic">
      <h1 className="max-md:sr-only text-2xl font-semibold tracking-tight md:text-3xl">
        {SITE_INDEX_HEADLINE}
      </h1>
      <p className="hidden max-w-2xl text-sm leading-6 text-muted md:block">{SITE_LANDING_HEADLINE}</p>
      <nav className="flex flex-wrap gap-2 md:hidden" aria-label="카테고리">
        {POST_CHANNELS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            prefetch={false}
            className="inline-flex min-h-10 items-center rounded-full border border-line bg-panel px-3.5 text-sm font-medium text-ink hover:border-accent hover:text-accent"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
