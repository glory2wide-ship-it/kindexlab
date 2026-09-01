function publicSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(raw)) return raw;
  return "https://kindexlab.com";
}

export const SITE_INDEX_HEADLINE = "킨덱스랩! / KOREA INDEX LAB.";

/** Head copy on the landing page hero, above the unified heatmap. */
export const SITE_LANDING_HEADLINE =
  "엔터·정치·경제·문화·여행 데스크를 한 판에 올린 통합 지수 보드입니다. 타일 우측 상단이 출처 데스크입니다.";

export const SITE = {
  name: "KOREA INDEX LAB.",
  nameKo: "킨덱스랩",
  company: "디엘파크주식회사",
  companyShort: "디엘파크",
  tagline: "THINK KOR.",
  description:
    "K-POP, 셀럽, 방송, 인플루언서, 실시간 음원 차트, 시청률, 웹툰, 숏폼/SNS, 모바일·PC·콘솔 게임을 주식 지수(INDEX)처럼 보여주는 트렌드 랭킹. kindexlab.com · 디엘파크가 운영합니다.",
  domain: "kindexlab.com",
  url: publicSiteUrl(),
  locale: "ko_KR",
  contactEmail: (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "").trim() || "glory2wide@gmail.com",
} as const;
