import type { AffiliateProduct } from "@/lib/types";
import type { PoliticsEntityType } from "@/lib/politics/types";

export interface PoliticsCatalogEntry {
  name: string;
  nameEn: string;
  type: PoliticsEntityType;
  aliases?: string[];
  tags: string[];
  searchQuery: string;
}

function goods(name: string, query: string): AffiliateProduct[] {
  return [
    {
      id: `pol-${name}-1`,
      name: `${query} 관련 시사 도서`,
      brand: "큐레이션",
      priceKrw: 18900,
      reason: `${name} 이슈와 함께 찾는 시사·정책 자료`,
      searchQuery: query,
      category: "시사",
    },
    {
      id: `pol-${name}-2`,
      name: "정부 지원금 안내",
      brand: "큐레이션",
      priceKrw: 9900,
      reason: "정책·지원금 키워드 검색 수요",
      searchQuery: "정부 지원금",
      category: "정책",
    },
  ];
}

export const POLITICS_CATALOG: PoliticsCatalogEntry[] = [
  { name: "국회 본회의", nameEn: "National Assembly", type: "headline_news", tags: ["국회"], searchQuery: "시사 주간지" },
  { name: "대선 경선", nameEn: "Presidential primary", type: "headline_news", tags: ["대선"], searchQuery: "대선 도서" },
  { name: "공천 갈등", nameEn: "Nomination fight", type: "headline_news", tags: ["공천"], searchQuery: "정치 에세이" },
  { name: "예산안 심의", nameEn: "Budget review", type: "headline_news", tags: ["예산"], searchQuery: "경제 정책 도서" },
  { name: "연금 개혁", nameEn: "Pension reform", type: "headline_news", tags: ["연금"], searchQuery: "연금 가이드" },
  { name: "부동산 정책", nameEn: "Housing policy", type: "headline_news", tags: ["부동산"], searchQuery: "부동산 정책" },
  { name: "외교 안보", nameEn: "Diplomacy", type: "headline_news", tags: ["외교"], searchQuery: "국제정치 도서" },
  { name: "노동 입법", nameEn: "Labor bills", type: "headline_news", tags: ["노동"], searchQuery: "노동법 해설" },

  { name: "더불어민주당", nameEn: "Democratic Party", type: "party_support", aliases: ["민주당"], tags: ["여야"], searchQuery: "정치학 개론" },
  { name: "국민의힘", nameEn: "People Power Party", type: "party_support", aliases: ["국힘"], tags: ["여야"], searchQuery: "한국 정당" },
  { name: "조국혁신당", nameEn: "Rebuilding Korea Party", type: "party_support", tags: ["원내"], searchQuery: "시사 잡지" },
  { name: "개혁신당", nameEn: "Reform Party", type: "party_support", tags: ["원내"], searchQuery: "정치 에세이" },
  { name: "진보당", nameEn: "Progressive Party", type: "party_support", tags: ["원내"], searchQuery: "진보 정치" },
  { name: "기본소득당", nameEn: "Basic Income Party", type: "party_support", tags: ["원내"], searchQuery: "기본소득" },
  { name: "사회민주당", nameEn: "Social Democratic Party", type: "party_support", tags: ["원내"], searchQuery: "사회민주주의" },
  { name: "무소속", nameEn: "Independents", type: "party_support", tags: ["원내"], searchQuery: "국회 해설" },

  { name: "이재명", nameEn: "Lee Jae-myung", type: "politician_support", tags: ["대선"], searchQuery: "이재명 도서" },
  { name: "김문수", nameEn: "Kim Moon-soo", type: "politician_support", tags: ["대선"], searchQuery: "시사 도서" },
  { name: "한동훈", nameEn: "Han Dong-hoon", type: "politician_support", tags: ["여야"], searchQuery: "정치 에세이" },
  { name: "이준석", nameEn: "Lee Jun-seok", type: "politician_support", tags: ["원내"], searchQuery: "이준석 도서" },
  { name: "조국", nameEn: "Cho Kuk", type: "politician_support", tags: ["원내"], searchQuery: "조국 도서" },
  { name: "오세훈", nameEn: "Oh Se-hoon", type: "politician_support", tags: ["지자체"], searchQuery: "서울 정책" },
  { name: "김동연", nameEn: "Kim Dong-yeon", type: "politician_support", tags: ["지자체"], searchQuery: "경제 정책" },
  { name: "박찬대", nameEn: "Park Chan-dae", type: "politician_support", tags: ["원내"], searchQuery: "국회 해설" },
  { name: "배현진", nameEn: "Bae Hyun-jin", type: "politician_support", tags: ["원내"], searchQuery: "시사 도서" },
  { name: "정청래", nameEn: "Jung Chung-rae", type: "politician_support", tags: ["원내"], searchQuery: "정치 에세이" },

  { name: "유시민", nameEn: "Yoo Si-min", type: "political_pundit", tags: ["평론"], searchQuery: "유시민 도서" },
  { name: "진중권", nameEn: "Jin Jung-kwon", type: "political_pundit", tags: ["평론"], searchQuery: "진중권 도서" },
  { name: "전원책", nameEn: "Jeon Won-chaek", type: "political_pundit", tags: ["평론"], searchQuery: "시사 토론" },
  { name: "김어준", nameEn: "Kim Eo-jun", type: "political_pundit", tags: ["시사"], searchQuery: "김어준 도서" },
  { name: "박형준", nameEn: "Park Hyung-joon", type: "political_pundit", tags: ["평론"], searchQuery: "정치학" },
  { name: "이낙연", nameEn: "Lee Nak-yon", type: "political_pundit", tags: ["시사"], searchQuery: "시사 주간지" },
  { name: "최강욱", nameEn: "Choi Kang-wook", type: "political_pundit", tags: ["평론"], searchQuery: "시사 도서" },
  { name: "김근식", nameEn: "Kim Geun-sik", type: "political_pundit", tags: ["평론"], searchQuery: "북한 문제" },

  { name: "김용민TV", nameEn: "Kim Yong-min TV", type: "political_influencer", tags: ["유튜브"], searchQuery: "마이크" },
  { name: "가로세로연구소", nameEn: "Garosero Research", type: "political_influencer", aliases: ["가세연"], tags: ["유튜브"], searchQuery: "웹캠" },
  { name: "신의한수", nameEn: "Shinui Hansu", type: "political_influencer", tags: ["유튜브"], searchQuery: "이어폰" },
  { name: "딴지일보", nameEn: "Ddanzi", type: "political_influencer", tags: ["SNS"], searchQuery: "시사 잡지" },
  { name: "이봉규TV", nameEn: "Lee Bong-kyu TV", type: "political_influencer", tags: ["유튜브"], searchQuery: "삼각대" },
  { name: "신의 한 수", nameEn: "Divine Move", type: "political_influencer", tags: ["유튜브"], searchQuery: "스마트폰 거치대" },
  { name: "정치인 숏츠", nameEn: "Politician shorts", type: "political_influencer", tags: ["숏폼"], searchQuery: "숏폼 조명" },
  { name: "시사 클립", nameEn: "Current-affairs clips", type: "political_influencer", tags: ["숏폼"], searchQuery: "무선 마이크" },

  { name: "KBS 뉴스9", nameEn: "KBS News 9", type: "political_ratings", tags: ["지상파"], searchQuery: "뉴스 이어폰" },
  { name: "MBC 뉴스데스크", nameEn: "MBC Newsdesk", type: "political_ratings", tags: ["지상파"], searchQuery: "홈시네마" },
  { name: "SBS 8뉴스", nameEn: "SBS 8 News", type: "political_ratings", tags: ["지상파"], searchQuery: "TV 스탠드" },
  { name: "JTBC 뉴스룸", nameEn: "JTBC Newsroom", type: "political_ratings", tags: ["종합편성"], searchQuery: "뉴스 구독" },
  { name: "YTN", nameEn: "YTN", type: "political_ratings", tags: ["보도"], searchQuery: "라디오" },
  { name: "연합뉴스TV", nameEn: "Yonhap News TV", type: "political_ratings", tags: ["보도"], searchQuery: "뉴스 알림" },
  { name: "TV조선 뉴스", nameEn: "TV Chosun News", type: "political_ratings", tags: ["종합편성"], searchQuery: "시사 주간지" },
  { name: "채널A 뉴스", nameEn: "Channel A News", type: "political_ratings", tags: ["종합편성"], searchQuery: "시사 잡지" },

  { name: "대선", nameEn: "Presidential race", type: "political_search", tags: ["검색"], searchQuery: "대선 가이드" },
  { name: "총선", nameEn: "General election", type: "political_search", tags: ["검색"], searchQuery: "선거 제도" },
  { name: "탄핵", nameEn: "Impeachment", type: "political_search", tags: ["검색"], searchQuery: "헌법 해설" },
  { name: "공천", nameEn: "Nomination", type: "political_search", tags: ["검색"], searchQuery: "정당 정치" },
  { name: "지지율", nameEn: "Approval rating", type: "political_search", tags: ["검색"], searchQuery: "여론조사" },
  { name: "특검", nameEn: "Special counsel", type: "political_search", tags: ["검색"], searchQuery: "형사법" },
  { name: "계엄", nameEn: "Martial law", type: "political_search", tags: ["검색"], searchQuery: "현대사" },
  { name: "개헌", nameEn: "Constitutional reform", type: "political_search", tags: ["검색"], searchQuery: "헌법 개정" },

  { name: "서울 기후동행카드", nameEn: "Climate Card", type: "local_policy", tags: ["서울"], searchQuery: "교통카드" },
  { name: "경기 청년기본소득", nameEn: "Gyeonggi youth income", type: "local_policy", tags: ["경기"], searchQuery: "청년 적금" },
  { name: "부산 15분 도시", nameEn: "Busan 15-minute city", type: "local_policy", tags: ["부산"], searchQuery: "도시계획" },
  { name: "인천 교통카드", nameEn: "Incheon transit", type: "local_policy", tags: ["인천"], searchQuery: "교통카드" },
  { name: "대구 도시철도", nameEn: "Daegu metro", type: "local_policy", tags: ["대구"], searchQuery: "교통카드" },
  { name: "광주 문화도시", nameEn: "Gwangju culture city", type: "local_policy", tags: ["광주"], searchQuery: "공연 티켓" },
  { name: "대전 과학수도", nameEn: "Daejeon science", type: "local_policy", tags: ["대전"], searchQuery: "과학 도서" },
  { name: "제주 관광정책", nameEn: "Jeju tourism", type: "local_policy", tags: ["제주"], searchQuery: "제주 여행" },

  { name: "국민취업지원제도", nameEn: "National employment support", type: "subsidy", tags: ["고용"], searchQuery: "취업 준비" },
  { name: "청년도약계좌", nameEn: "Youth leap account", type: "subsidy", tags: ["청년"], searchQuery: "청년도약계좌" },
  { name: "디딤돌대출", nameEn: "Didimdol loan", type: "subsidy", tags: ["주거"], searchQuery: "디딤돌대출" },
  { name: "에너지바우처", nameEn: "Energy voucher", type: "subsidy", tags: ["에너지"], searchQuery: "에너지바우처" },
  { name: "부모급여", nameEn: "Parental benefit", type: "subsidy", tags: ["보육"], searchQuery: "부모급여" },
  { name: "기초연금", nameEn: "Basic pension", type: "subsidy", tags: ["복지"], searchQuery: "기초연금" },
  { name: "근로장려금", nameEn: "EITC", type: "subsidy", tags: ["세정"], searchQuery: "근로장려금" },
  { name: "자녀장려금", nameEn: "Child tax credit", type: "subsidy", tags: ["세정"], searchQuery: "자녀장려금" },
  { name: "청년내일저축계좌", nameEn: "Youth tomorrow savings", type: "subsidy", tags: ["청년"], searchQuery: "청년내일저축계좌" },
  { name: "전세보증금 반환보증", nameEn: "Jeonse deposit guarantee", type: "subsidy", tags: ["주거"], searchQuery: "전세보증금" },
];

export function politicsProducts(entry: PoliticsCatalogEntry): AffiliateProduct[] {
  return goods(entry.name, entry.searchQuery);
}

export function catalogByType(type: PoliticsEntityType): PoliticsCatalogEntry[] {
  return POLITICS_CATALOG.filter((item) => item.type === type);
}

export function matchPoliticsCatalog(text: string): PoliticsCatalogEntry[] {
  const hay = text.replace(/\s+/g, "");
  return POLITICS_CATALOG.filter((item) => {
    const names = [item.name, item.nameEn, ...(item.aliases ?? [])];
    return names.some((name) => name && (hay.includes(name.replace(/\s+/g, "")) || text.includes(name)));
  });
}
