import { productPrice } from "@/lib/affiliate/price";
import type { AffiliateProvider } from "@/lib/affiliate/types";

/** Secondary KR storefront. Swap in partner deep links once a program id lands. */
export const tossProvider: AffiliateProvider = {
  id: "toss",
  label: "Toss Shopping",
  isConfigured: (market) => market.country === "KR",
  searchUrl(query) {
    return `https://shopping.toss.im/search?q=${encodeURIComponent(query)}`;
  },
  copy: {
    shelfHeading: (entityName) => `${entityName} 관련 상품 모아보기`,
    shelfIntro: "토스 쇼핑에서 유사 상품의 가격대를 함께 확인할 수 있습니다.",
    cta: "토스 쇼핑에서 보기 →",
    railCta: (query) => `토스 쇼핑에서 '${query}' 보기`,
    disclosure: "제휴 링크를 통해 구매 시 일정액의 수수료를 제공받을 수 있습니다.",
  },
  formatPrice: (product, market) => productPrice(product, market) ?? "",
};
