import { AdSlot } from "@/components/ads/AdSlot";

export type ContentSlotPlacement = "intro" | "mid" | "footer";

const PLACEMENT_CLASS: Record<ContentSlotPlacement, string> = {
  intro: "min-h-[90px]",
  mid: "min-h-[120px]",
  footer: "min-h-[160px]",
};

/**
 * Reserved layout space for AdSense units and future partner widgets
 * (Coupang Partners, Toss Shopping). The wrapper stays in the DOM even when no
 * unit is configured so inserting one later does not shift the article, but it
 * only claims height once an ad client exists — otherwise the reserved band
 * reads as dead air between the column and the affiliate shelf below it.
 */
export function ContentSlot({
  placement,
  label,
  adFormat = "in-article",
}: {
  placement: ContentSlotPlacement;
  label?: string;
  adFormat?: "auto" | "in-article" | "fluid";
}) {
  const reserved = Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);

  return (
    <div
      data-content-slot={placement}
      className={`not-prose w-full ${reserved ? `my-8 ${PLACEMENT_CLASS[placement]}` : ""}`}
    >
      <AdSlot format={adFormat} />
      <div data-partner-slot={placement} data-partner-label={label} className="empty:hidden" />
    </div>
  );
}
