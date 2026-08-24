export const SITE = {
  name: "EnterBuzz",
  nameKo: "엔터버즈",
  company: "디엘파크주식회사",
  tagline: "실시간 화제 시세판",
  description:
    "K-POP, 셀럽, 방송, 인플루언서, 실시간 음원 차트와 시청률을 주식 시세판처럼 보여주는 트렌드 랭킹 플랫폼. 디엘파크주식회사가 운영합니다.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "ko_KR",
} as const;
