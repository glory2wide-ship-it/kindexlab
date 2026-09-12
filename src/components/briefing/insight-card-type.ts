/**
 * Typography for 투데이 인사이트 / 브리핑 “글박스” cards.
 *
 * Size history (from original badge 10 / meta 11 / body 14 / lead 18·20):
 *   all copy +10%, badge/meta +10% again, then badge/meta/title +5%.
 * Line-height: mobile +10% (again) vs prior card density; desktop keeps prior md: values.
 * Badge/meta use darker chrome tones than body muted for scanability.
 */
export const INSIGHT_CARD_TYPE = {
  badge:
    "rounded-full border border-accent/50 px-2 py-0.5 font-sans text-[12.71px] font-bold leading-[1.3189] text-[#6f580f] dark:text-[#f6d66a] md:leading-[1.09]",
  meta: "font-sans text-[13.98px] font-semibold leading-[1.3189] text-[#2a3448] dark:text-[#dde3ef] md:leading-[1.09]",
  titleLead:
    "text-[20.79px] font-semibold leading-[1.203345] tracking-tight md:text-[23.1px] md:leading-[1.2375]",
  title:
    "text-[16.17px] font-semibold leading-[1.2728rem] tracking-tight md:leading-[1.485rem]",
  body: "text-[15.4px] leading-[1.2728rem] text-muted md:leading-[1.485rem]",
  cta: "inline-flex text-[15.4px] font-medium leading-[1.2728rem] text-accent md:leading-[1.485rem]",
} as const;
