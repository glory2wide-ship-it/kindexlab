function publicSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(raw)) return raw;
  return "https://kindexlab.com";
}

export const SITE = {
  name: "KindexLab",
  nameKo: "킨덱스랩",
  company: "디엘파크주식회사",
  companyShort: "디엘파크",
  tagline: "실시간 화제 시세판",
  description:
    "K-POP, 셀럽, 방송, 인플루언서, 실시간 음원 차트, 시청률, 웹툰, 숏폼/SNS, 모바일·PC·콘솔 게임을 주식 시세판처럼 보여주는 트렌드 랭킹. kindexlab.com · 디엘파크가 운영합니다.",
  domain: "kindexlab.com",
  url: publicSiteUrl(),
  locale: "ko_KR",
  contactEmail: (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "").trim() || "glory2wide@gmail.com",
} as const;
