function publicSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(raw)) return raw;
  // Vercel serves www; apex 308s to www. Canonical / sitemap / robots must
  // use the non-redirecting host so Search Console indexing stays clean.
  return "https://www.kindexlab.com";
}

export const SITE_INDEX_HEADLINE = "킨덱스! / KinDex";

/** Head copy on the landing page hero, above the unified heatmap. */
export const SITE_LANDING_HEADLINE =
  "실시간 검색어보다 넓고, 뉴스보다 빠르게. 엔터·경제·정치·문화·여행의 지금을 지수로 확인하세요!";

/** Landing H1 / subcopy (mobile + desktop). */
export const SITE_INDEX_HEADLINE_DESKTOP =
  "지금 대한민국에서 뭐가 뜨고 있는지, 10초 만에";
export const SITE_LANDING_SUBCOPY_LINE1 = "실시간 검색어보다 넓고, 뉴스보다 빠르게.";
export const SITE_LANDING_SUBCOPY_LINE2 =
  "엔터·경제·정치·문화·여행의 지금을 지수로 확인하세요!";
/** Single-line form for meta / desktop-friendly joins. */
export const SITE_LANDING_HEADLINE_DESKTOP = `${SITE_LANDING_SUBCOPY_LINE1} ${SITE_LANDING_SUBCOPY_LINE2}`;

export const SITE = {
  name: "KinDex",
  nameKo: "킨덱스",
  company: "디엘파크주식회사",
  companyShort: "디엘파크",
  tagline: "THINK KOR.",
  description:
    "K POP, 셀럽, 방송, 인플루언서, 음원, TV 시청률, 웹툰, 영화, 숏폼/SNS, 모바일·PC·콘솔 게임을 주식 지수(INDEX)처럼 보여주는 트렌드 랭킹. kindexlab.com · 디엘파크가 운영합니다.",
  domain: "kindexlab.com",
  url: publicSiteUrl(),
  locale: "ko_KR",
  contactEmail: (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "").trim() || "glory2wide@gmail.com",
} as const;
