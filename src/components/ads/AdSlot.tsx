"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

export function AdSlot({
  slot,
  format = "auto",
}: {
  slot?: string;
  format?: "auto" | "in-article" | "fluid";
}) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const resolvedSlot = slot || process.env.NEXT_PUBLIC_ADSENSE_SLOT;

  useEffect(() => {
    if (!client) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* AdSense script may still be loading */
    }
  }, [client, resolvedSlot]);

  if (!client) return null;

  return (
    <aside data-monetization="adsense" className="overflow-hidden rounded-2xl border border-line bg-panel p-2">
      <p className="mb-1 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Ad</p>
      <ins
        className="adsbygoogle block min-h-[90px] w-full"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={resolvedSlot || undefined}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
