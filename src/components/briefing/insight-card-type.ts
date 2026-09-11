/**
 * Typography for 투데이 인사이트 / 브리핑 “글박스” cards.
 *
 * Size history (from original badge 10 / meta 11 / body 14 / lead 18·20):
 *   all copy +10%, badge/meta +10% again, then badge/meta/title +5%.
 * Line-height: −10% vs the first post-size-bump values for tighter card density.
 */
export const INSIGHT_CARD_TYPE = {
  badge:
    "rounded-full border border-accent/40 px-2 py-0.5 font-sans text-[12.71px] font-semibold leading-[1.09] text-accent",
  meta: "font-sans text-[13.98px] leading-[1.09] text-muted",
  titleLead:
    "text-[20.79px] font-semibold leading-[0.9945] tracking-tight md:text-[23.1px] md:leading-[1.2375]",
  title:
    "text-[16.17px] font-semibold leading-[1.051875rem] tracking-tight md:leading-[1.485rem]",
  body: "text-[15.4px] leading-[1.051875rem] text-muted md:leading-[1.485rem]",
  cta: "inline-flex text-[15.4px] font-medium leading-[1.051875rem] text-accent md:leading-[1.485rem]",
} as const;
