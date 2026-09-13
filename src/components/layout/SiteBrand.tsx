import Link from "next/link";
import { SITE } from "@/lib/site";

/** Shared logo + wordmark width used by the header and desktop section-tab alignment. */
export function SiteBrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex min-w-0 items-center gap-2 md:gap-2.5 ${className}`}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-accent font-sans text-[11px] font-bold tracking-tight text-black">
        KD
      </span>
      <span className="min-w-0 truncate font-gothic text-[18px] font-semibold leading-tight tracking-tight md:text-[22.46px]">
        {SITE.nameKo} <span className="font-normal text-muted">/</span> {SITE.name}
      </span>
    </span>
  );
}

export function SiteBrandLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex min-w-0 shrink-0 items-center ${className}`}>
      <SiteBrandMark />
    </Link>
  );
}
