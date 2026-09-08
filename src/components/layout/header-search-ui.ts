export const SEARCH_FORM_CLASS = "relative flex shrink-0 items-center gap-1.5";
/**
 * Desktop keeps a compact field. Mobile hides the field until expanded
 * (see HeaderSearch) via `max-md:hidden` on the resting input.
 */
export const SEARCH_INPUT_CLASS =
  "h-8 w-[4.2rem] appearance-none rounded-full border border-line bg-panel px-3 py-0 text-center text-ink outline-none placeholder:text-center placeholder:text-muted focus:border-accent sm:w-24 md:h-9 md:w-[7.875rem] max-md:hidden";
export const SEARCH_INPUT_EXPANDED_CLASS =
  "h-8 w-[min(14rem,52vw)] appearance-none rounded-full border border-line bg-panel px-3 py-0 text-center text-ink outline-none placeholder:text-center placeholder:text-muted focus:border-accent md:hidden";
export const SEARCH_INPUT_STYLE = { textAlign: "center" as const, lineHeight: "32px", fontSize: "12.32px" };
export const SEARCH_BUTTON_CLASS =
  "grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-panel text-muted transition-colors hover:text-ink md:h-9 md:w-9";
/** Compact icon for the section-tab row (mobile). */
export const SEARCH_BUTTON_MOBILE_CLASS =
  "grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-panel text-ink transition-colors hover:text-accent md:hidden";
