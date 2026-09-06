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

  if (!resolvedSlot) {
    return (
      <aside
        data-monetization="adsense"
        className="rounded-2xl border border-dashed border-line bg-panel px-4 py-6 text-center"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Ad</p>
        <p className="mt-1 text-xs text-muted">광고 슬롯을 준비 중입니다.</p>
      </aside>
    );
  }

  return (
    <aside data-monetization="adsense" className="overflow-hidden rounded-2xl border border-line bg-panel p-2">
      <p className="mb-1 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Ad</p>
      <ins
        className="adsbygoogle block min-h-[90px] w-full"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={resolvedSlot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
