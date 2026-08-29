/**
 * Monetization placement for generated bodies.
 *
 * The rebuild stores a Markdown/MDX body alongside the structured article, and
 * this module is what puts the AdSense container above every H2 and the
 * affiliate shelf under the FAQ. Doing it here rather than asking the model for
 * it keeps placement deterministic — a prompt that "usually" emits the slot
 * produces pages with missing inventory.
 */

export type PremiumSlotPlacement = "intro" | "mid" | "footer";

function adClient(): string {
  return process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
}

function adSlot(): string {
  return process.env.NEXT_PUBLIC_ADSENSE_SLOT ?? "";
}

/**
 * AdSense in-article container. Emitted even when the account is not wired yet
 * so the layout reserves the band and switching the env var on is the only
 * remaining step.
 */
export function adsenseContainer(
  placement: PremiumSlotPlacement,
  format: "auto" | "in-article" = "in-article",
): string {
  return [
    `<div class="adsense-container" data-content-slot="${placement}" data-monetization="adsense">`,
    `  <ins class="adsbygoogle"`,
    `    style="display:block"`,
    `    data-ad-client="${adClient()}"`,
    `    data-ad-slot="${adSlot()}"`,
    `    data-ad-format="${format}"`,
    `    data-full-width-responsive="true"></ins>`,
    `</div>`,
  ].join("\n");
}

/** The dynamic shopping shelf, keyed by the article's focus keyword. */
export function affiliateWidgetTag(keyword: string, placement: PremiumSlotPlacement = "footer"): string {
  const safe = keyword.replace(/"/g, "'");
  return `<AffiliateWidget keyword="${safe}" placement="${placement}" />`;
}

/**
 * Inserts an ad container directly above every H2 and, after the FAQ block, the
 * footer ad plus the affiliate shelf. `faqAnchor` marks where the FAQ ends; when
 * it is absent the footer pair is appended.
 */
export function injectMonetization(
  markdown: string,
  keyword: string,
  options: { faqAnchor?: string } = {},
): string {
  const lines = markdown.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    if (/^##\s+\S/.test(line)) {
      out.push(adsenseContainer("mid"), "");
    }
    out.push(line);
  }

  const footer = [
    "",
    adsenseContainer("footer", "auto"),
    "",
    affiliateWidgetTag(keyword, "footer"),
    "",
  ].join("\n");

  const body = out.join("\n");
  const anchor = options.faqAnchor;
  if (anchor && body.includes(anchor)) {
    const at = body.indexOf(anchor) + anchor.length;
    return `${body.slice(0, at)}\n${footer}${body.slice(at)}`;
  }
  return `${body}\n${footer}`;
}

/** Machine-readable record of where the widgets landed, stored on the article. */
export interface PremiumPlacement {
  placement: PremiumSlotPlacement;
  kind: "adsense" | "affiliate";
}

export function describePlacements(markdown: string): PremiumPlacement[] {
  const placements: PremiumPlacement[] = [];
  const adMatches = markdown.matchAll(/data-content-slot="(intro|mid|footer)"/g);
  for (const match of adMatches) {
    placements.push({ placement: match[1] as PremiumSlotPlacement, kind: "adsense" });
  }
  if (markdown.includes("<AffiliateWidget")) {
    placements.push({ placement: "footer", kind: "affiliate" });
  }
  return placements;
}
