/**
 * Typography for 투데이 인사이트 / 브리핑 “글박스” cards.
 * Baseline was badge 10 / meta 11 / body text-sm(14) / lead text-lg(18)·xl(20);
 * all sizes are +10% so landing, category rails, and magazine cards stay in sync.
 */
export const INSIGHT_CARD_TYPE = {
  badge:
    "rounded-full border border-accent/40 px-2 py-0.5 font-sans text-[11px] font-semibold text-accent",
  meta: "font-sans text-[12.1px] text-muted",
  titleLead:
    "text-[19.8px] font-semibold leading-[1.105] tracking-tight md:text-[22px] md:leading-snug",
  title:
    "text-[15.4px] font-semibold leading-[1.16875rem] tracking-tight md:leading-[1.65rem]",
  body: "text-[15.4px] leading-[1.16875rem] text-muted md:leading-[1.65rem]",
  cta: "inline-flex text-[15.4px] font-medium leading-[1.16875rem] text-accent md:leading-[1.65rem]",
} as const;
