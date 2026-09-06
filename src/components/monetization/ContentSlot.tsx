import { AdSlot } from "@/components/ads/AdSlot";

export type ContentSlotPlacement = "intro" | "mid" | "footer";

const PLACEMENT_CLASS: Record<ContentSlotPlacement, string> = {
  intro: "my-9 min-h-[90px]",
  mid: "my-10 min-h-[120px]",
  footer: "my-10 min-h-[160px]",
};

/**
 * Reserved layout space for AdSense units and future partner widgets
 * (Coupang Partners, Toss Shopping). The wrapper stays in the DOM even when no
 * unit is configured so inserting one later does not shift the article, but it
 * only claims height once an ad client exists — otherwise the reserved band
 * reads as dead air between the column and the affiliate shelf below it.
 *
 * The body carries no imagery, so an active slot is boxed and given wide
 * gutters: it needs to read as its own band rather than as a gap in the prose,
 * which is also what keeps it from being mistaken for editorial content.
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
      className={`not-prose w-full ${
        reserved
          ? `${PLACEMENT_CLASS[placement]} rounded-xl border border-line/60 bg-board/20 px-3 py-4`
          : ""
      }`}
    >
      <AdSlot format={adFormat} />
      <div data-partner-slot={placement} data-partner-label={label} className="empty:hidden" />
    </div>
  );
}
