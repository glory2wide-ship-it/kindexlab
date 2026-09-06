export const SEARCH_FORM_CLASS = "relative flex items-center gap-1.5";
/** Width and type size are 20% below the prior sm/md sizes (40→32, 52→42; 14→11.2). */
export const SEARCH_INPUT_CLASS =
  "h-9 w-[5.6rem] appearance-none rounded-full border border-line bg-panel px-3 py-0 text-center text-ink outline-none placeholder:text-center placeholder:text-muted focus:border-accent sm:w-32 md:w-[10.5rem]";
export const SEARCH_INPUT_STYLE = { textAlign: "center" as const, lineHeight: "36px", fontSize: "11.2px" };
export const SEARCH_BUTTON_CLASS =
  "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-panel text-muted transition-colors hover:text-ink";
