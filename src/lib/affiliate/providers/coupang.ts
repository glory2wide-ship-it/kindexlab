import { productPrice } from "@/lib/affiliate/price";
import type { AffiliateProvider } from "@/lib/affiliate/types";

const PARTNER_ID = process.env.NEXT_PUBLIC_COUPANG_PARTNER_ID ?? "000000";

export const coupangProvider: AffiliateProvider = {
  id: "coupang",
  label: "Coupang Partners",
  isConfigured: (market) => market.country === "KR",
  searchUrl(query) {
    const encoded = encodeURIComponent(query);
    return `https://www.coupang.com/np/search?q=${encoded}&chan=kindexlab&subid=${PARTNER_ID}`;
  },
  copy: {
    shelfHeading: (entityName) => `${entityName} 관련 아이템 최저가 비교`,
    shelfIntro:
      "방송·화보에서 언급되거나 착용된 스타일과 비슷한 상품을 큐레이션했습니다. 가격은 제휴몰 기준으로 변동될 수 있습니다.",
    cta: "쿠팡에서 최저가 보기 →",
    railCta: (query) => `쿠팡에서 '${query}' 보기`,
    disclosure:
      "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.",
  },
  formatPrice: (product, market) => productPrice(product, market) ?? "",
};
