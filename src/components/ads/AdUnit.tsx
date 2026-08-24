"use client";

import { useEffect, type ReactNode } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Renders nothing unless AdSense env vars are set, so empty placeholder
 * boxes never appear in the layout.
 */
export function AdUnit({
  slot,
  format = "auto",
}: {
  slot?: string;
  format?: "auto" | "rectangle" | "horizontal";
}) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const resolvedSlot = slot ?? process.env.NEXT_PUBLIC_ADSENSE_SLOT;

  useEffect(() => {
    if (!client || !resolvedSlot) return;
    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
    } catch {
      // Ignore duplicate pushes during HMR.
    }
  }, [client, resolvedSlot]);

  if (!client || !resolvedSlot) return null;

  return (
    <div data-monetization="adsense" className="overflow-hidden">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={resolvedSlot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

export function MonetizationSlot({
  region,
  children,
}: {
  region: "in-feed" | "in-article" | "after-content";
  children: ReactNode;
}) {
  return (
    <aside data-monetization-region={region} className="contents">
      {children}
    </aside>
  );
}
